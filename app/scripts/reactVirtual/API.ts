import { sleep } from '../utils/tools'

const API_THROTTLE_SECONDS = 0.2

interface IBaseFetchProps {
    url: string
    method?: 'POST' | 'GET'
    body?: Record<string, any>
}

const baseFetch = ({ url, body, method = 'POST' }: IBaseFetchProps) => {
    return fetch(url, {
        method,
        headers: {
            accept: 'application/json, text/plain, */*',
            'x-requested-with': 'XMLHttpRequest',
            'x-xsrf-token': globalThis.xsrfToken,
            'content-type': 'application/json;charset=UTF-8',
        },
        body: body ? JSON.stringify(body) : undefined,
    })
}

export const fetchToGetBlog = async (props: { uid: string; since_id?: string; pageIndex?: number }) => {
    let data = null,
        status = false
    const { uid, pageIndex = 1, since_id } = props || {}

    if (!uid) return { data, status }

    try {
        const response = await baseFetch({
            url: `//weibo.com/ajax/statuses/mymblog?uid=${uid}&page=${pageIndex}&feature=0${
                since_id ? '&since_id=' + since_id : ''
            }`,
            method: 'GET',
        })
        const respJson = await response.json()
        const realData = respJson?.data || {}

        // 微博接口对连续翻页比较敏感，保留很短的退避，避免纯循环瞬间打满接口。
        await sleep(API_THROTTLE_SECONDS)
        data = { ...(realData || {}), uid, hasMore: !!realData?.since_id }
        status = true
    } catch (e) {
        console.log(`fetchToGetBlog`, e)
    }

    return { data, status }
}

export const fetchToSearchProfile = async (props: {
    uid: string
    startTimeShortSpan?: number
    endTimeShortSpan?: number
    pageIndex?: number
}) => {
    let data = null,
        status = false
    const { uid, pageIndex = 1, startTimeShortSpan, endTimeShortSpan } = props || {}

    if (!uid || !startTimeShortSpan || !endTimeShortSpan) return { data, status }

    try {
        const response = await baseFetch({
            url: `//weibo.com/ajax/statuses/searchProfile?uid=${uid}&page=${pageIndex}&starttime=${startTimeShortSpan}&endtime=${endTimeShortSpan}&hasori=1&hasret=1&hastext=1&haspic=1&hasvideo=1&hasmusic=1`,
            method: 'GET',
        })
        const respJson = await response.json()
        const realData = respJson?.data || {}

        await sleep(API_THROTTLE_SECONDS)
        data = { ...(realData || {}), uid, hasMore: realData?.list?.length > 5 }
        status = true
    } catch (e) {
        console.log(`fetchToSearchProfile`, e)
    }

    return { data, status }
}

export const fetchToGetMyFav = async (props: { uid: string; pageIndex?: number }) => {
    let data = null,
        status = false
    const { uid, pageIndex = 1 } = props || {}

    if (!uid) return { data, status }

    try {
        const response = await baseFetch({
            url: `//weibo.com/ajax/favorites/all_fav?uid=${uid}&page=${pageIndex}&with_total=true`,
            method: 'GET',
        })
        const respJson = await response.json()
        const realData = respJson?.data || {}
        const { status: statusList, total_number } = realData || {}

        await sleep(API_THROTTLE_SECONDS)
        data = { ...(realData || {}), list: statusList, uid, hasMore: statusList?.length > 3, total: total_number }
        status = true
    } catch (e) {
        console.log(`fetchToGetMyFav`, e)
    }

    return { data, status }
}
