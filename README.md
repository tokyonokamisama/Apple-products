# 果选 · Apple 全线产品选购指南

面向中国大陆用户的 Apple 产品中文选购网站，收录 7 个品类、27 款国行在售产品，价格核对自 Apple 中国大陆官网在线商店（2026-11-19）。

| 品类 | 产品 |
| --- | --- |
| iPhone | iPhone Duo（折叠屏）、iPhone 18 Pro Max、iPhone 18 Pro、iPhone Air、iPhone 17、iPhone 17e、iPhone 16 / 16 Plus |
| Mac | MacBook Neo、MacBook Air、MacBook Pro、MacBook Pro（PROLED XDR）、iMac、Mac mini、Mac Studio |
| iPad | iPad Pro、iPad Air、iPad、iPad mini |
| Apple Watch | Ultra 4、Series 12、SE 3 |
| AirPods | AirPods Pro 3、AirPods 5、AirPods Max 2 |
| Vision | Apple Vision Pro（M5） |
| HomePod | HomePod、HomePod mini 2 |

## 功能

- **发布会式开场**：滚动驱动的 3D 动画，iPhone Duo 转身、从合上切换到展开，文字逐句出现，并且直接讲出它的代价。
- **七个产品章节**：每个品类一章。左侧 3D 舞台随滚动旋转，右侧评测卡逐张滑过，包括一句话结论、关键数字、优点和缺点。
- **官方 3D 模型**：21 款产品使用由 Apple 官方 AR 模型转换的 glTF（`assets/3d/`），在任何浏览器里都能拖动旋转、双指缩放，并能切换官方配色；iPhone Duo 可以折叠 / 展开，MacBook 可以开合。在 iPhone / iPad 上还能用 AR 把设备按真实大小放到桌面上。
- **完整评测页**：六维评分、全部优缺点（“官网不会告诉你”）、“为什么值得买”、适合 / 不适合的人、同价位替代选择、关键规格、官方实拍图集。
- **并排对比**：最多 3 款，对比价格、评分、优缺点与规格。
- **帮我选**：按品类、预算、偏好推荐三款，每款都附一条你需要接受的代价。
- **搜索**：按 `/` 或 `⌘K` 搜索产品、芯片、用途或缺点。
- 全站只用一个 WebGL 画布，模型按需加载（每个 1–6 MB，meshopt 压缩），适配 iPad / iPhone Safari。

## 换电脑方案页

`plan/index.html` 是一个独立的单页（图片全部内嵌，不依赖站点其他文件）：给家长看的换电脑说明，包括现在这台戴尔 Vostro 15 5510 的问题、想换的 MacBook Pro 14，以及 11 个方案的价格核对、优缺点和长期路线。部署后地址为 `https://<用户名>.github.io/<仓库名>/plan/`。

## 苹果格子动态壁纸

`wallpaper/index.html` 是一个独立的全屏动态壁纸页：黑白苹果 logo 格子，鼠标经过翻转、点击放出波纹，鼠标静止时自动流动。按 `S` 打开设置（格子大小、配色、速度、省电模式），按 `F` 全屏。部署后地址为 `https://<用户名>.github.io/<仓库名>/wallpaper/`，可以填进 Lively Wallpaper（Windows）或 Plash（macOS）当桌面壁纸。

## 本地运行

纯静态网站，无需安装依赖或构建。由于使用 ES Module，需要通过本地服务器打开（直接双击 `index.html` 无法加载模块）：

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/pages.yml`。合并到 `main` 分支后：

1. 打开仓库 **Settings → Pages**，把 **Source** 设为 **GitHub Actions**。
2. 推送到 `main`（或在 Actions 页手动运行 “Deploy to GitHub Pages”），即可在 `https://<用户名>.github.io/<仓库名>/` 访问。

> 注意：GitHub 免费账户的**私有仓库无法使用 GitHub Pages**。需要先把仓库设为公开（Settings → General → Danger Zone → Change visibility），或者用 Vercel / Netlify / Cloudflare Pages 导入这个仓库部署（它们支持私有仓库，选“静态站点”、无需构建命令）。

页面不依赖任何外部 CDN，图片都在仓库里，国内访问更稳定。

## 目录结构

```
index.html          页面结构
css/style.css       样式
js/data.js          产品数据（价格、规格）
js/review.js        评测内容：结论、优缺点、说服理由、替代选择、评分
js/media.js         官方产品图、配色图与 AR 模型链接
js/models3d.js      3D 模型清单（姿态、配色变体、默认角度）
js/stage3d.js       3D 舞台（Three.js）
js/app.js           页面交互
assets/3d/          由官方 USDZ 转换的 glTF 模型
assets/thumbs/      3D 渲染缩略图
assets/p/           官方产品图（WebP）
vendor/three/       Three.js r170（MIT 许可）
```

## 数据说明

- 价格为**国行官网起售价**，核对于 2026-11-19，不含教育优惠、国家补贴和以旧换新折抵。苹果会不定期调价，购买前请以 [Apple 中国大陆官网](https://www.apple.com.cn/) 为准。修改 `js/data.js` 里的 `price` 字段即可更新。
- Apple TV 与 HomeView 未在中国大陆官网销售，因此未收录。
- 优缺点里的数字来自 Apple 官网技术规格页；评分与观点是本站的判断。
- 产品图片与 3D 模型版权归 Apple 所有，仅用于选购参考；AR 模型直接链接到 apple.com.cn。
- 本站是独立的选购指南，与 Apple Inc. 无关联。产品名称为其各自所有者的商标。

## 更新 3D 模型

`tools/usd2glb.py` 可以把 Apple 官网的 AR 模型（`.usdz`）转换成网页用的 glTF，支持官方配色变体（KHR_materials_variants）、姿态变体和多层材质；`tools/opt.sh` 用 gltf-transform 压缩贴图和几何。

```bash
pip install usd-core numpy pillow
npm i -g @gltf-transform/cli
# spec.json: {"sources": [{"file": "x.usdz", "variant": "Silver", "select": {"Color": "Silver", "Pose": "Open"}}, ...]}
python3 tools/usd2glb.py out.raw.glb spec.json
tools/opt.sh out.raw.glb assets/3d/out.glb 1024
```
