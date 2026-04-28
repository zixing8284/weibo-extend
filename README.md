# Weibo Backup

一个专注于微博备份的浏览器扩展。当前只保留两个核心功能：

- 备份当前用户微博
- 备份我的收藏

备份包会以 zip 下载到本地，包内包含离线查看所需的 `index.html`、脚本、样式、微博数据、图片、视频和用户头像。打开 zip 中的 `index.html` 即可离线查看已保存的内容。

## 使用

1. 加载 `extension/` 目录作为浏览器扩展。
2. 打开 `https://weibo.com` 的用户主页，点击右侧悬浮按钮，选择 `备份当前用户微博`。
3. 选择 `全部` 或 `按日期`，并按需要调整 `单次打包条数`。
4. 打开 `我的收藏` 页面后，点击悬浮按钮，选择 `备份我的收藏`。

备份期间不要关闭当前微博页面。扩展会按批次生成 zip，避免单个压缩包过大导致浏览器内存占用过高。

## 为什么备份会比较慢

微博图片、长文和视频都需要额外请求。旧实现完全串行下载媒体，并在每个请求后随机等待，以降低触发微博风控的概率。现在图片下载改为保守小并发，视频仍保持低并发，并保留短退避：这比原来快，但不会使用无上限 `Promise.all`，避免请求瞬间过密。

## 开发

```bash
npm run check-types
npm run weibosave
npm run pack:extensionscript
npm run css:virtualpage
npm run build:extension
```

主要源码：

- `app/scripts/content/`：微博页面 content script 和虚拟 UI 注入
- `app/scripts/reactVirtual/`：悬浮按钮、备份弹窗、Redux 状态和微博列表 API
- `app/scripts/utils/tools.ts`：zip 生成、媒体抽取、并发下载和离线数据整理
- `app/scripts/utils/fetches.ts`：图片、视频、长文下载
- `weiboSave/`：zip 内离线 HTML 查看器
- `extension/manifest.json`：Manifest V3 扩展配置

## 构建产物

`npm run build:extension` 会生成：

- `extension/content-script.js`
- `extension/virtualPage.output.css`
- `extension/weiboSave/`
- `weibo-extend.zip`
