import JSZip from 'jszip'
const FileSaver = require('file-saver')
import _ from 'lodash'
import {
    fetchToGetImageBlobByXHR,
    fetchToGetImageBlobByCloudflare,
    fetchToGetVideoBlobByXHR,
    fetchToGetLongText,
} from './fetches'
import { favIcon32 } from './constants'

const IMAGE_DOWNLOAD_CONCURRENCY = 3
const VIDEO_DOWNLOAD_CONCURRENCY = 1

export const sleep = (sec: number) => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, sec * 1000)
    })
}

interface ISaveBlogToZipProps {
    myBlog: Record<string, any>[]
    start?: number
    isMyFav?: boolean
    attachedName?: string
    eachCallback?: (info: any) => void
}

type ImageInfo = { picName: string; url: string }
type VideoInfo = Record<string, any>

const mapWithConcurrency = async <T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>
) => {
    if (_.isEmpty(items)) return

    let nextIndex = 0
    const workerCount = Math.min(Math.max(concurrency, 1), items.length)
    const workers = Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex
            nextIndex++
            await worker(items[currentIndex], currentIndex)
        }
    })

    await Promise.all(workers)
}

export const saveBlogToZip = async ({ myBlog, start, isMyFav, attachedName, eachCallback }: ISaveBlogToZipProps) => {
    const zip = new JSZip()
    start = (start || 0) + 1
    const end = start - 1 + (myBlog?.length || 0)
    const range = `${start}_${end}`
    const userInfo = myBlog?.[0]?.user || {}
    const { screen_name, idstr } = userInfo || {}
    const zipFileName = _.compact(isMyFav ? [attachedName, range] : [idstr, screen_name, attachedName, range]).join('_')

    const extensionId = chrome.runtime.id
    const weibSaveFolder = `chrome-extension://${extensionId}/weiboSave`
    const indexHtmlName = `index.html`,
        weibosaveJsName = `weibosave.js`,
        weibosaveCssName = `weibosave.css`
    const indexHtml = `${weibSaveFolder}/${indexHtmlName}`
    const weibosaveJs = `${weibSaveFolder}/scripts/${weibosaveJsName}`
    const weibosaveCss = `${weibSaveFolder}/style/${weibosaveCssName}`

    // zip 需要能离线打开，所以把查看器的 HTML/JS/CSS 一起复制进压缩包，而不是依赖扩展继续存在。
    const [indexHtmlText, weibosaveJsText, weibosaveCssText] = await Promise.all([
        fetchFileStringFromExtension(indexHtml),
        fetchFileStringFromExtension(weibosaveJs),
        fetchFileStringFromExtension(weibosaveCss),
    ])
    const container = zip.folder(zipFileName) as JSZip
    container.file('index.html', indexHtmlText)
    const assetsFolder = container.folder('assets')
    assetsFolder?.file('favicon.ico', favIcon32, { base64: true })
    const scriptsFolder = assetsFolder?.folder('scripts')
    scriptsFolder?.file(weibosaveJsName, weibosaveJsText)
    const styleFolder = assetsFolder?.folder('style')
    styleFolder?.file(weibosaveCssName, weibosaveCssText)
    await convertBlogList({ isMyFav, myBlog, zipContainer: assetsFolder, eachCallback })

    zip.generateAsync({ type: 'blob' }).then(content => {
        FileSaver.saveAs(content, `${zipFileName}.zip`)
    })
}

const fetchFileStringFromExtension = async (fileUrl: string): Promise<string> => {
    const response = await fetch(fileUrl)
    return response.text()
}

const collectImageInfo = (blogItem: Record<string, any>): ImageInfo[] => {
    const { pic_infos, pic_num, mix_media_info } = blogItem || {}
    const picShows =
        !pic_num || _.isEmpty(pic_infos)
            ? []
            : _.compact(
                  _.map(pic_infos, (picInfo, picKey) => {
                      const url = picInfo?.large?.url || picInfo?.largest?.url || undefined
                      if (!url) return undefined
                      return {
                          picName: matchImageOrVideoFromUrl(url) || `${picKey}.jpg`,
                          url,
                      }
                  })
              )

    if (!_.isEmpty(mix_media_info?.items)) {
        _.forEach(mix_media_info.items, item => {
            const { type, data } = item || {}
            if (type !== `pic`) return

            const url = data?.large?.url || data?.largest?.url || undefined
            if (!url) return

            picShows.push({
                picName: matchImageOrVideoFromUrl(url) || `${data?.pic_id}.jpg`,
                url,
            })
        })
    }

    return picShows
}

const collectVideoInfo = (blogItem: Record<string, any>): VideoInfo[] => {
    const { page_info, mix_media_info } = blogItem || {}
    const tempVideoList: VideoInfo[] = []

    if (!_.isEmpty(page_info?.media_info)) {
        tempVideoList.push(page_info.media_info)
    }

    if (!_.isEmpty(mix_media_info?.items)) {
        _.forEach(mix_media_info.items, item => {
            const { type, data } = item || {}
            if (type === `video` && !_.isEmpty(data?.media_info)) {
                tempVideoList.push({ ...data.media_info })
            }
        })
    }

    return tempVideoList
}

const convertBlogList = async ({
    myBlog,
    zipContainer,
    isMyFav,
    eachCallback,
}: ISaveBlogToZipProps & { zipContainer: JSZip | null; eachCallback?: (info: any) => void }): Promise<void> => {
    const imageFolder = zipContainer?.folder('image')
    const videoFolder = zipContainer?.folder('video')
    const userInfo = myBlog?.[0]?.user || {}
    const finalList: typeof myBlog = []
    const imageDownloadCache = new Map<string, Promise<Blob | null>>()
    const videoDownloadCache = new Map<string, Promise<Blob | null>>()
    const savedImageNames = new Set<string>()
    const savedVideoNames = new Set<string>()
    let weiboCount = 0

    for (let blogItem of myBlog) {
        weiboCount++
        let weiboPicCount = 0,
            weiboVideoCount = 0
        const mediaInfoList: Record<string, any>[] = []
        const retweetedMediaInfoList: Record<string, any>[] = []
        const tempVideoList = collectVideoInfo(blogItem)
        const {
            created_at,
            attitudes_count,
            attitudes_status,
            comments_count,
            id,
            idstr,
            mid,
            pic_ids,
            pic_infos,
            pic_num,
            region_name,
            source,
            text,
            text_raw,
            retweeted_status,
            reposts_count,
            title,
            user,
            mblogid,
            isLongText,
        } = blogItem || {}

        const picShows = collectImageInfo(blogItem)
        eachCallback && eachCallback({ weiboCount, weiboPicCount: 0, weiboVideoCount: 0 })

        // 微博图片 CDN 容易因为请求密集或防盗链失败；这里使用小并发，避免原来逐张串行的极慢体验，也避免无限 Promise.all 触发风控。
        await mapWithConcurrency(picShows, IMAGE_DOWNLOAD_CONCURRENCY, async picShow => {
            weiboPicCount++
            await saveImageToZip({ picShow, imageFolder, imageDownloadCache, savedImageNames })
            eachCallback && eachCallback({ weiboCount, weiboPicCount })
        })

        let retweetedBlog: Record<string, any> = {}
        if (!_.isEmpty(retweeted_status)) {
            const retweetedStatusPicShows = collectImageInfo(retweeted_status)
            tempVideoList.push(...collectVideoInfo(retweeted_status))

            await mapWithConcurrency(retweetedStatusPicShows, IMAGE_DOWNLOAD_CONCURRENCY, async retweetPicShow => {
                weiboPicCount++
                await saveImageToZip({ picShow: retweetPicShow, imageFolder, imageDownloadCache, savedImageNames })
                eachCallback && eachCallback({ weiboCount, weiboPicCount })
            })

            const retweetFromUser = _.isEmpty(retweeted_status?.user)
                ? undefined
                : {
                      id: retweeted_status.user?.id,
                      idstr: retweeted_status.user?.idstr,
                      profile_url: retweeted_status.user?.profile_url,
                      profile_image_url: retweeted_status.user?.profile_image_url,
                      screen_name: retweeted_status.user?.screen_name,
                  }

            let retweetedTextRaw = retweeted_status.text_raw
            if (retweeted_status.isLongText && retweeted_status.mblogid) {
                // 长文正文不在列表接口里完整返回，必须额外请求一次，否则离线查看器只能看到截断内容。
                retweetedTextRaw = (await fetchToGetLongText({ mblogId: retweeted_status.mblogid })) || retweetedTextRaw
            }
            retweetedBlog = {
                reposts_count: retweeted_status.reposts_count,
                user: retweetFromUser,
                created_at: retweeted_status.created_at,
                attitudes_count: retweeted_status.attitudes_count,
                attitudes_status: retweeted_status.attitudes_status,
                comments_count: retweeted_status.comments_count,
                id: retweeted_status.id,
                mid: retweeted_status.mid,
                idstr: retweeted_status.idstr,
                pic_ids: retweeted_status.pic_ids,
                pic_infos: retweeted_status.pic_infos,
                picShows: retweetedStatusPicShows,
                pic_num: retweeted_status.pic_num,
                region_name: retweeted_status.region_name,
                source: retweeted_status.source,
                text: retweeted_status.text,
                text_raw: retweetedTextRaw,
            }
        }

        if (!_.isEmpty(tempVideoList)) {
            // 视频体积通常远大于图片，默认保持串行，避免多个大文件同时下载导致页面卡顿或触发网络错误。
            await mapWithConcurrency(tempVideoList, VIDEO_DOWNLOAD_CONCURRENCY, async videoInfo => {
                const { author_mid, h265_mp4_hd, mp4_720p_mp4, mp4_hd_url, media_id, format = 'mp4' } = videoInfo || {}
                const videoUrl = h265_mp4_hd || mp4_720p_mp4 || mp4_hd_url
                const videoFileName = `${media_id}.${format}`

                if (author_mid == mid) {
                    mediaInfoList.push({ format, author_mid, media_id, url: videoUrl })
                } else if (author_mid == retweetedBlog?.mid) {
                    retweetedMediaInfoList.push({ format, author_mid, media_id, url: videoUrl })
                }

                weiboVideoCount++
                await saveVideoToZip({ videoUrl, videoFileName, videoFolder, videoDownloadCache, savedVideoNames })
                eachCallback && eachCallback({ weiboCount, weiboVideoCount })
            })
        }

        if (!_.isEmpty(retweetedMediaInfoList) && !_.isEmpty(retweetedBlog)) {
            retweetedBlog.mediaInfoList = retweetedMediaInfoList
        }

        let textRaw = text_raw
        if (isLongText && mblogid) {
            textRaw = (await fetchToGetLongText({ mblogId: mblogid })) || textRaw
        }

        // myblog.js 只保留离线查看器需要的字段，降低 zip 内 JSON 体积，也减少微博接口结构变化带来的兼容风险。
        finalList.push({
            reposts_count,
            created_at,
            attitudes_count,
            attitudes_status,
            comments_count,
            id,
            idstr,
            mid,
            pic_ids,
            pic_infos,
            picShows,
            pic_num,
            region_name,
            source,
            text,
            text_raw: textRaw,
            retweetedBlog,
            mediaInfoList,
            title: title?.text ? { text: title.text } : undefined,
            user: {
                avatar_hd: user?.avatar_hd,
                avatar_large: user?.avatar_large,
                idstr: user?.idstr,
                id: user?.idstr,
                profile_image_url: user?.profile_image_url,
                profile_url: user?.profile_url,
                screen_name: user?.screen_name,
            },
        })
    }

    const userPicUrl = userInfo?.avatar_hd || userInfo?.profile_image_url || userInfo?.avatar_large || undefined
    if (userPicUrl) {
        userInfo.picShow = matchImageOrVideoFromUrl(userPicUrl)
        const picBlob = await fetchToGetImageBlobByXHR({ imageUrl: userPicUrl })
        if (picBlob) {
            imageFolder?.file(userInfo.picShow, picBlob)
        }
    }

    const myBlogJson: Record<string, any> = {
        list: finalList,
    }
    if (userInfo && !isMyFav) {
        myBlogJson.user = userInfo
    }
    zipContainer?.file('myblog.js', `window.myblog=${JSON.stringify(myBlogJson)}`)
}

const saveImageToZip = async ({
    picShow,
    imageFolder,
    imageDownloadCache,
    savedImageNames,
}: {
    picShow: ImageInfo
    imageFolder?: JSZip | null
    imageDownloadCache: Map<string, Promise<Blob | null>>
    savedImageNames: Set<string>
}) => {
    if (!picShow?.url || !picShow?.picName || savedImageNames.has(picShow.picName)) return

    const cacheKey = picShow.picName
    const cachedRequest = imageDownloadCache.get(cacheKey)
    const imageRequest = cachedRequest || getImageRetry({ imageUrl: picShow.url, picName: picShow.picName })
    imageDownloadCache.set(cacheKey, imageRequest)

    const picBlob = await imageRequest
    if (picBlob && !savedImageNames.has(picShow.picName)) {
        imageFolder?.file(picShow.picName, picBlob)
        savedImageNames.add(picShow.picName)
    }
}

const saveVideoToZip = async ({
    videoUrl,
    videoFileName,
    videoFolder,
    videoDownloadCache,
    savedVideoNames,
}: {
    videoUrl?: string
    videoFileName: string
    videoFolder?: JSZip | null
    videoDownloadCache: Map<string, Promise<Blob | null>>
    savedVideoNames: Set<string>
}) => {
    if (!videoUrl || !videoFileName || savedVideoNames.has(videoFileName)) return

    const cachedRequest = videoDownloadCache.get(videoFileName)
    const videoRequest = cachedRequest || fetchToGetVideoBlobByXHR({ videoUrl })
    videoDownloadCache.set(videoFileName, videoRequest)

    const videoBlob = await videoRequest
    if (videoBlob && !savedVideoNames.has(videoFileName)) {
        videoFolder?.file(videoFileName, videoBlob)
        savedVideoNames.add(videoFileName)
    }
}

export const matchImageOrVideoFromUrl = (url: string) => {
    return url?.match(/\/([\da-zA-Z]+\.[a-z0-9]{3,4})(\?|$)/)?.[1] || ''
}

const getImageRetry = async ({ imageUrl, picName }: { imageUrl: string; picName?: string }) => {
    const isVipPage = imageUrl?.includes(`zzx.sinaimg.cn`)
    if (isVipPage) {
        // vplus 或部分专属图片常规 XHR 容易失败，先走代理补偿。
        return fetchToGetImageBlobByCloudflare({ imageUrl })
    }

    const picBlob = await fetchToGetImageBlobByXHR({ imageUrl })
    if (picBlob) {
        return picBlob
    }

    if (!picName) return null

    if (/wx\d\.sinaimg\.cn/.test(imageUrl)) {
        return fetchToGetImageBlobByCloudflare({
            imageUrl,
            host: `weibo-xhr-image.127321.xyz`,
        })
    }

    // 新浪图床偶尔某个 CDN 节点不可用；用文件名换一个 wx 节点重试，能补回部分失败图片。
    const randomImageCDN = Math.floor(Math.random() * 3) + 1
    const retryUrl = `https://wx${randomImageCDN}.sinaimg.cn/large/${picName}`
    return fetchToGetImageBlobByXHR({ imageUrl: retryUrl, retryDelay: true })
}
