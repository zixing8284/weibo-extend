# 微博备份

这是一个专注于微博备份的浏览器扩展。当前只保留两个核心功能：

- 备份当前用户微博
- 备份我的收藏

备份包会下载为 zip，包含离线查看所需的 `index.html`、脚本、样式、微博数据、图片、视频和用户头像。解压后打开 `index.html` 即可查看。

## 使用方式

1. 在浏览器扩展管理页加载 `extension/` 目录。
2. 打开微博用户主页，点击右侧悬浮按钮，选择 `备份当前用户微博`。
3. 可选择 `全部` 或 `按日期`，也可以调整 `单次打包条数`。
4. 打开自己的收藏页面，点击悬浮按钮，选择 `备份我的收藏`。

备份期间请不要关闭当前页面。扩展会按批次生成 zip，降低单次打包过大带来的内存压力。

## 速度说明

备份慢主要来自媒体下载：图片、视频和长文都需要额外请求。为了避免微博风控，代码不会无限并发下载；当前实现使用保守的小并发下载图片，视频仍保持低并发，并保留短随机退避。这样比完全串行更快，同时比无上限并发更稳。

## 开发命令

```bash
npm run check-types
npm run weibosave
npm run pack:extensionscript
npm run css:virtualpage
npm run build:extension
```

## 代码结构

- `app/scripts/content/`：content script 和虚拟 UI 注入
- `app/scripts/reactVirtual/`：悬浮按钮、备份弹窗、Redux 状态和微博列表 API
- `app/scripts/utils/tools.ts`：zip 生成、媒体抽取、并发下载和离线数据整理
- `app/scripts/utils/fetches.ts`：图片、视频、长文下载
- `weiboSave/`：zip 内离线 HTML 查看器
- `extension/manifest.json`：Manifest V3 扩展配置
