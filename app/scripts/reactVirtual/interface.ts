export interface WeiboExtendState {
    showFloatingPopup?: boolean
    showWeiboPop: WeiboPopType
    savingUid?: string
    stopSaving?: boolean
    onePageCount?: number
    totalCountSaveingWeibo?: number
    currentSavingWeiboCount?: number
    currentSavingWeiboPicCount?: number
    currentSavingWeiboVideoCount?: number
}

export enum WeiboPopType {
    hidden = `hidden`,
    typeSelect = `typeSelect`,
    saving = `saving`,
    savingFav = `savingFav`,
    stop = `stop`,
    completed = `completed`,
}
