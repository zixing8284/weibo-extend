import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { AppState } from './store'
import { fetchToGetBlog, fetchToSearchProfile, fetchToGetMyFav } from './API'
import { WeiboExtendState, WeiboPopType } from './interface'
import { saveBlogToZip } from '../utils/tools'
import _ from 'lodash'
import dayjs from 'dayjs'

export const getWeiboExtendState = (state: AppState): WeiboExtendState => state.weiboExtend

const initialState: WeiboExtendState = {
    showFloatingPopup: false,
    showWeiboPop: WeiboPopType.hidden,
    onePageCount: 100,
}

interface ISaveweiboQueueProps {
    uid: string
    pageIndex?: number
    start?: number
    startDate?: Date
    endDate?: Date
    isMyFav?: boolean
}

export const saveWeiboQueue = createAsyncThunk(
    'weiboExtendSlice/saveWeiboQueue',
    async (
        {
            uid = '',
            pageIndex: paramsPageIndex = 1,
            start: paramsStart,
            startDate,
            endDate,
            isMyFav,
        }: ISaveweiboQueueProps,
        { dispatch, getState }: any
    ) => {
        const weiboExtendState: WeiboExtendState = getWeiboExtendState(getState())
        let pageIndex = paramsPageIndex || 1
        const otherUid = uid || ''
        const start = paramsStart || 0

        dispatch(
            updateState({
                stopSaving: false,
                showWeiboPop: isMyFav ? WeiboPopType.savingFav : WeiboPopType.saving,
                currentSavingWeiboCount: start,
                currentSavingWeiboPicCount: 0,
                currentSavingWeiboVideoCount: 0,
                totalCountSaveingWeibo: pageIndex < 2 ? 0 : weiboExtendState.totalCountSaveingWeibo || 0,
            })
        )

        if (!otherUid) return

        const startTimeShortSpan = (startDate && dayjs(startDate).unix()) || undefined
        // 微博搜索接口按秒过滤，结束日期如果取当天 00:00 会漏掉当天内容，所以这里向后补一天。
        const endTimeShortSpan = (endDate && dayjs(endDate).add(1, 'day').unix()) || undefined
        const onePageCount =
            (weiboExtendState.onePageCount && weiboExtendState.onePageCount > 0
                ? weiboExtendState.onePageCount
                : 100) || 100

        let isEnd = false
        let onePageList: Record<string, any>[] = []
        let totalCountSaveingWeibo = weiboExtendState.totalCountSaveingWeibo || 0

        // 一次 zip 打太大会让 JSZip 占用大量内存，也会让浏览器下载触发很晚；这里按用户设置分批抓取并打包。
        while (onePageList.length < onePageCount) {
            const blogsResp = isMyFav
                ? await fetchToGetMyFav({ uid: otherUid, pageIndex })
                : startTimeShortSpan && endTimeShortSpan
                  ? await fetchToSearchProfile({ uid: otherUid, pageIndex, startTimeShortSpan, endTimeShortSpan })
                  : await fetchToGetBlog({ uid: otherUid, pageIndex })

            pageIndex++

            const { list, hasMore, total } = blogsResp?.data || {}
            const currentList = list || []
            totalCountSaveingWeibo = total || totalCountSaveingWeibo
            dispatch(updateState({ totalCountSaveingWeibo }))

            onePageList = onePageList.concat(currentList)
            isEnd = !hasMore

            if (!hasMore || _.isEmpty(currentList)) break
        }

        if (_.isEmpty(onePageList)) {
            dispatch(
                updateState({
                    showWeiboPop: WeiboPopType.completed,
                    currentSavingWeiboPicCount: 0,
                    currentSavingWeiboVideoCount: 0,
                })
            )
            return null
        }

        const attachedName = isMyFav
            ? `${uid}_Favorites`
            : startDate && endDate
              ? dayjs(startDate).format('YYYYMMDD') + '_' + dayjs(endDate).format('YYYYMMDD')
              : `total`

        await saveBlogToZip({
            myBlog: onePageList,
            start,
            isMyFav,
            attachedName,
            eachCallback: ({ weiboCount, weiboPicCount, weiboVideoCount }) => {
                const { stopSaving } = getWeiboExtendState(getState())

                // 当前下载已经交给 XHR/JSZip 执行，无法可靠地中断全部进行中的请求；刷新页面是最确定的停止方式。
                if (stopSaving) {
                    location.reload()
                }

                dispatch(
                    updateState({
                        currentSavingWeiboCount: start + weiboCount,
                        currentSavingWeiboPicCount: weiboPicCount || 0,
                        currentSavingWeiboVideoCount: weiboVideoCount || 0,
                    })
                )
            },
        })

        const { stopSaving } = getWeiboExtendState(getState())
        if (isEnd || stopSaving) {
            dispatch(
                updateState({
                    showWeiboPop: WeiboPopType.completed,
                    currentSavingWeiboPicCount: 0,
                    currentSavingWeiboVideoCount: 0,
                })
            )
            return null
        }

        // 当前批次完成后再递归进入下一批，保证每个 zip 的体积和内存占用可控。
        dispatch(
            saveWeiboQueue({
                uid: otherUid,
                pageIndex,
                startDate,
                endDate,
                start: start + (onePageList?.length || 0),
                isMyFav,
            })
        )
    }
)

export const savingMyFav = createAsyncThunk(
    'weiboExtendSlice/savingMyFav',
    async ({ uid }: Pick<ISaveweiboQueueProps, 'uid'>, { dispatch }: any) => {
        dispatch(
            updateState({
                showFloatingPopup: false,
                stopSaving: false,
                showWeiboPop: WeiboPopType.savingFav,
            })
        )
        dispatch(saveWeiboQueue({ uid, isMyFav: true }))
    }
)

export const weiboExtendSlice = createSlice({
    name: 'weiboExtendSlice',
    initialState,
    reducers: {
        updateShowFloatingPopup: (state, action: PayloadAction<boolean>) => {
            return { ...state, showFloatingPopup: action.payload }
        },
        updateState: (state, action: PayloadAction<Partial<WeiboExtendState>>) => {
            return { ...state, ...action.payload }
        },
    },
})

export const { updateState, updateShowFloatingPopup } = weiboExtendSlice.actions
export default weiboExtendSlice.reducer
