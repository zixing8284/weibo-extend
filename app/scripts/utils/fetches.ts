import _ from 'lodash'
import { sleep } from './tools'

const MEDIA_REQUEST_JITTER_SECONDS = 0.35
const MEDIA_RETRY_JITTER_SECONDS = 0.8
const VIDEO_REQUEST_JITTER_SECONDS = 0.2
const LONG_TEXT_JITTER_SECONDS = 0.35

interface IBaseFetchProps {
    url: string
    method?: 'POST' | 'GET'
    body?: Record<string, any>
    headers?: Record<string, any>
}

const baseFetch = ({ url, body, method = 'POST', headers }: IBaseFetchProps) => {
    const requestHeaders = _.omitBy(
        {
            accept: 'application/json, text/plain, */*',
            'x-requested-with': 'XMLHttpRequest',
            'x-xsrf-token': globalThis.xsrfToken,
            'content-type': 'application/json;charset=UTF-8',
            ...headers,
        },
        _.isNil
    )

    return fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
    })
}

const fetchBlobByXHR = async (url: string): Promise<Blob | null> => {
    return new Promise<Blob | null>(resolve => {
        const xhr = new XMLHttpRequest()
        xhr.open('get', url)
        xhr.responseType = 'blob'
        xhr.onload = () => {
            resolve(xhr.status >= 200 && xhr.status < 300 ? (xhr.response as Blob) : null)
        }
        xhr.onerror = () => resolve(null)
        xhr.send()
    })
}

export const fetchToGetImageBlobByXHR = async ({
    imageUrl,
    retryDelay = false,
}: {
    imageUrl: string
    retryDelay?: boolean
}): Promise<null | Blob> => {
    if (!imageUrl) return null

    try {
        const responseBlob = await fetchBlobByXHR(imageUrl)
        await sleep(Math.random() * (retryDelay ? MEDIA_RETRY_JITTER_SECONDS : MEDIA_REQUEST_JITTER_SECONDS))
        return responseBlob
    } catch (e) {
        console.log(`fetchToGetImageBlobByXHR`, e)
    }
    return null
}

export const fetchToGetImageBlobByCloudflare = async ({
    imageUrl,
    host,
    retryDelay = true,
}: {
    imageUrl: string
    host?: string
    retryDelay?: boolean
}): Promise<null | Blob> => {
    if (!imageUrl) return null

    try {
        const proxyUrl = `https://${host || 'weibo-image-fetch.127321.xyz'}/?url=${encodeURIComponent(imageUrl)}`
        const responseBlob = await fetchBlobByXHR(proxyUrl)
        await sleep(Math.random() * (retryDelay ? MEDIA_RETRY_JITTER_SECONDS : MEDIA_REQUEST_JITTER_SECONDS))
        return responseBlob
    } catch (e) {
        console.log(`fetchToGetImageBlobByCloudflare`, e)
    }
    return null
}

export const fetchToGetVideoBlobByXHR = async ({ videoUrl }: { videoUrl: string }): Promise<null | Blob> => {
    if (!videoUrl) return null

    try {
        const responseBlob = await fetchBlobByXHR(videoUrl)
        await sleep(Math.random() * VIDEO_REQUEST_JITTER_SECONDS)
        return responseBlob
    } catch (e) {
        console.log(`fetchToGetVideoBlobByXHR`, e)
    }
    return null
}

export const fetchToGetLongText = async ({ mblogId }: { mblogId?: string }) => {
    if (!mblogId) return null

    try {
        const response = await baseFetch({
            url: `//weibo.com/ajax/statuses/longtext?id=${mblogId}`,
            method: 'GET',
        })

        const result = await response.json()
        const { longTextContent } = result?.data || {}
        await sleep(Math.random() * LONG_TEXT_JITTER_SECONDS)
        return longTextContent || null
    } catch (e) {
        console.log(`fetchToGetLongText`, e)
    }
    return null
}
