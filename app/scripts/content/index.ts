// @ts-ignore
import $ from 'jquery'
// @ts-ignore
import Cookies from 'js-cookie'
import { injectVirtualRoot, injectVirtualStyle } from './injects'

const contentRun = async () => {
    console.log(`weibo backup content script ready`)
}

window.addEventListener('load', () => {
    // 备份接口需要微博页面里的 XSRF-TOKEN；content script 读取后提供给 API 层统一使用。
    globalThis.xsrfToken = Cookies.get(`XSRF-TOKEN`)
    getMyUid()
    injectVirtualRoot()
    injectVirtualStyle()

    contentRun()
})

const getMyUid = () => {
    let myUid = ''
    $(document).ready(function () {
        const navDiv = $('div.woo-tab-nav')
        const myPageLink = navDiv?.find('a[href*="/u/"]')

        if (myPageLink.length > 0) {
            const myPageLinkValue = myPageLink.attr('href')
            myUid = (myPageLinkValue && myPageLinkValue.match(/\/u\/([\w\W]+)/)?.[1]) || ``
            globalThis.myUid = myUid
        }
    })
    return myUid
}
