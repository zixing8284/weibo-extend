import React from 'react'
import { useAppSelector, useAppDispatch } from '../hooks'
import { getWeiboExtendState, updateState, updateShowFloatingPopup, savingMyFav } from '../slice'
import { floatingPopupList } from '../constants'
import { WeiboPopType } from '../interface'

const FloatingPopup: React.FC = () => {
  const state = useAppSelector(getWeiboExtendState)
  const dispatch = useAppDispatch()
  const { showFloatingPopup } = state || {}

  const handleSaveWeibo = () => {
    const currentUrl = new URL(document.location.href)
    const urlPath = currentUrl.pathname || window.location.pathname
    const theUid = urlPath?.match(/u\/(\d+)/)?.[1] || urlPath?.match(/^\/(\d+)/)?.[1] || ``
    dispatch(updateShowFloatingPopup(false))

    if (!theUid) {
      setTimeout(() => alert(`请先访问个人主页，再进行备份！`), 50)
      return
    }

    dispatch(
      updateState({
        stopSaving: false,
        showWeiboPop: WeiboPopType.typeSelect,
        savingUid: theUid,
      })
    )
  }

  const handleSaveMyFav = () => {
    const currentUrl = document.location.href || ``
    const theUid = currentUrl?.match(/u\/page\/fav\/(\d+)/)?.[1] || ``
    dispatch(updateShowFloatingPopup(false))

    if (!theUid) {
      setTimeout(() => alert(`请先进入我的收藏，再进行备份！`), 50)
      return
    }

    dispatch(savingMyFav({ uid: theUid }))
  }

  const handles: Record<string, () => void> = {
    handleSaveWeibo,
    handleSaveMyFav,
  }

  if (!showFloatingPopup) return null

  return (
    <div className="max-h-80 overflow-y-scroll overflow-x-hidden w-52 bg-gray-200 shadow-md rounded-lg right-4 absolute bottom-11">
      <div className="flex px-3 py-4 flex-col gap-2 text-sm font-semibold">
        {floatingPopupList.map((floatingPopupItem, itemIndex) => {
          const { title, onClick } = floatingPopupItem || {}
          return (
            <div
              key={`floating_popuplist_${itemIndex}`}
              className="cursor-pointer flex-item h-8 flex items-center align-middle rounded-md hover:bg-gray-300 pl-2"
              onClick={() => handles[onClick]?.()}
            >
              <span className="text-center">{title}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FloatingPopup
