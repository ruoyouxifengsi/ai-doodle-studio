# Day 5+6 验收汇报

## 导出 PNG 分辨率

- **实际宽高**：720 × 1280 px（固定）
- **实现方式**：生成按钮点击时，临时将画布切到 `setZoom(1) + setWidth(720) + setHeight(1280)` 再导出，导出后立即恢复原尺寸和 zoom，对显示和触控无影响。

## 请求体大小

- 720×1280 白底 + SVG 剪影 + 涂鸦笔迹
- PNG 压缩后约 50–200 KB，远低于 2 MB 上限

## 真实生成

- `js/api.js` 已删除 `X-Mock: true` header
- API 端点：`https://api.xinlu-ai.xin/api/generate`

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `js/api.js` | 删除 X-Mock header，直连真实 API |
| `js/canvas.js` | fitCanvas 使用 setWidth/setHeight；SVG 加载使用 fabric.Image.fromURL；笔刷 5px |
| `js/app.js` | 导出前临时切 720×1280 全分辨率；currentImageUrl 追踪；QR 浮层逻辑 |
| `index.html` | qrcode.js CDN；QR 浮层 DOM |
| `css/screens.css` | QR 浮层样式 |

## Day 5 验收项

- [x] CDN 引入 qrcode.js（第二个 CDN 依赖，合规）
- [x] 结果页"保存二维码"弹出浮层，含 image_url 的二维码
- [x] 浮层文案："打开相机或扫码工具对准二维码，扫码后长按图片保存到相册"
- [x] 点击遮罩或关闭按钮可关闭浮层

## Day 6 验收项

- [x] 删除 X-Mock header
- [x] API_ENDPOINT 保持 https://api.xinlu-ai.xin/api/generate
- [x] 导出 PNG 固定 720×1280
- [x] 页面显示尺寸和触控坐标不受影响
- [x] 4 屏端到端流程：选场景 → 涂鸦 → 真实 AI 生成 → 结果页

## 修复记录

| 问题 | 修复 |
|------|------|
| 背景不覆盖画板（CSS-only fitCanvas 与 SVG 加载交互问题） | fitCanvas 还原 setWidth/setHeight，SVG 加载还原 fabric.Image.fromURL |
| 导出分辨率随屏幕缩放 | 导出前临时切全分辨率再恢复 |
