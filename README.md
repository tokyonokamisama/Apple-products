# 果选 · Apple 全线产品选购指南

一个面向中国大陆用户的 Apple 产品中文选购网站，收录 7 个品类、28 款在售产品：

| 品类 | 产品 |
| --- | --- |
| iPhone | iPhone Duo（折叠屏）、iPhone 18 Pro Max、iPhone 18 Pro、iPhone Air、iPhone 17、iPhone 17e |
| Mac | MacBook Neo、MacBook Air、MacBook Pro、MacBook Pro（PROLED XDR）、iMac、Mac mini、Mac Studio |
| iPad | iPad Pro、iPad Air、iPad、iPad mini |
| Apple Watch | Ultra 4、Series 12、SE 3 |
| AirPods | AirPods Pro 3、AirPods 5、AirPods Max 2 |
| Vision | Apple Vision Pro（M5） |
| 家居 | HomeView、Apple TV 4K、HomePod、HomePod mini |

## 功能

- **实时 3D 查看**：每款产品都有用 Three.js 程序化生成的 3D 模型，可拖动旋转、缩放、切换正面 / 背面 / 侧面 / 俯视视角，切换配色预览。部分产品带交互动作：iPhone Duo 折叠、MacBook 合盖、AirPods 打开充电盒、iPad 显示 Apple Pencil。
- **筛选与排序**：按品类、预算上限筛选，按推荐、价格、发布时间排序；每个品类都有“快速决策”入口。
- **并排对比**：最多 3 款产品并排比较规格，可只看不同项，对比列表会记在浏览器里。
- **帮我选**：回答品类、预算、看重点三个问题，给出匹配度最高的三款产品与理由。
- **搜索**：按 `/` 或 `⌘K` / `Ctrl K` 搜索产品、芯片或用途（如“降噪”“M5”“折叠”）。
- **可分享链接**：详情页地址形如 `#/iphone-17`，直接打开即可定位到对应产品。
- 适配手机、平板与桌面，支持“减少动态效果”系统设置。

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

Three.js 已放在 `vendor/three/`，不依赖外部 CDN，国内访问更稳定。

## 目录结构

```
index.html          页面结构
css/style.css       样式
js/data.js          产品数据（价格、规格、选购建议）
js/models.js        程序化 3D 模型
js/viewer.js        渲染器、详情查看器、首页展示与缩略图生成
js/app.js           页面交互
vendor/three/       Three.js r170（MIT 许可）
```

## 数据说明

- 价格为**国行参考起售价**，整理于 2026-11-19，来自公开报道与官方发布信息，不含教育优惠、国家补贴和以旧换新折抵。苹果会不定期调价，购买前请以 [Apple 中国大陆官网](https://www.apple.com.cn/) 为准。
- AirPods Max 2、HomeView、Apple TV 4K 暂未核实到可靠的国行价格，页面上标注为“待核实”。修改 `js/data.js` 里的 `price` 字段即可更新。
- 3D 模型为示意造型，按大致比例建模，配色仅供参考。
- 本站是独立的选购指南，与 Apple Inc. 无关联。产品名称为其各自所有者的商标。
