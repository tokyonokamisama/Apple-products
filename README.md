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

- **官方产品图**：每款产品都使用 Apple 官网商店的产品图，可切换配色（真实配色图片）、左右滑动浏览多角度图集、点按放大细看。
- **官方 3D / AR 模型**：21 款产品带有 Apple 官方 AR Quick Look 模型。在 iPhone / iPad 的 Safari 中点“AR 查看 3D”，可以 360° 旋转模型或把它放到桌面上看实际大小；电脑上会提示改用 iPhone / iPad 打开，Mac 可下载 USDZ 文件用“预览”查看。
- **筛选与排序**：按品类、预算上限筛选，按推荐、价格、发布时间排序；每个品类都有“快速决策”入口。
- **并排对比**：最多 3 款产品并排比较规格，可只看不同项。
- **帮我选**：回答品类、预算、看重点三个问题，给出匹配度最高的三款与理由。
- **搜索**：按 `/` 或 `⌘K` 搜索产品、芯片或用途（如“降噪”“M5”“折叠”）。
- **可分享链接**：详情页地址形如 `#/iphone-17`。
- 适配 iPad、手机与桌面浏览器（iPadOS / iOS 15 及以上的 Safari），无任何外部依赖。

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
js/data.js          产品数据（价格、规格、选购建议）
js/media.js         产品图片、配色图与官方 AR 模型链接
js/app.js           页面交互
assets/p/           官方产品图（WebP）
```

## 数据说明

- 价格为**国行官网起售价**，核对于 2026-11-19，不含教育优惠、国家补贴和以旧换新折抵。苹果会不定期调价，购买前请以 [Apple 中国大陆官网](https://www.apple.com.cn/) 为准。修改 `js/data.js` 里的 `price` 字段即可更新。
- Apple TV 与 HomeView 未在中国大陆官网销售，因此未收录。
- 产品图片与 AR 模型版权归 Apple 所有，仅用于选购参考；AR 模型直接链接到 apple.com.cn。
- 本站是独立的选购指南，与 Apple Inc. 无关联。产品名称为其各自所有者的商标。
