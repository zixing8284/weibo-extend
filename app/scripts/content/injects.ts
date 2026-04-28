import { weiboExtendClassNames, weiboExtendVirtualRootId } from '../utils/constants'
import { renderVirtualPage } from '../reactVirtual/virtualPage'

export const injectVirtualStyle = () => {
    const linkStyleElment = document.createElement('link')
    linkStyleElment.href = `chrome-extension://${chrome.runtime.id}/virtualPage.output.css`
    linkStyleElment.rel = `stylesheet`
    document.body?.appendChild(linkStyleElment)
}

export const injectVirtualRoot = () => {
    if (document.getElementById(weiboExtendVirtualRootId)) return

    const virtualRoot = document.createElement('div')
    virtualRoot.className = weiboExtendClassNames.root
    virtualRoot.id = weiboExtendVirtualRootId
    document.body.appendChild(virtualRoot)
    renderVirtualPage()
}
