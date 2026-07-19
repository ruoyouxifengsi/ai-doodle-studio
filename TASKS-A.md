# TASKS-A（前端 · 搭档）

> 你的 7 天任务。粒度到"改哪个文件、加什么函数、验收标准"。不加没列的功能。不改 `worker/`。

## 开工前（Day 0）

1. 读完 `CLAUDE.md` 和 `SPEC.md`
2. clone 仓库到本地
3. 本地跑：进入仓库根目录 `python -m http.server 8000`，浏览器开 `http://localhost:8000`
4. 手机测试：手机连同一 WiFi，浏览器开 `http://<你电脑内网 IP>:8000`
5. 每天开工先 `git pull`

**如果本地跑不起来、手机连不上，先在群里说，别改代码调试**。

## Day 1：三屏骨架 + 画布 Hello World

### 要做

- 建 `index.html`：三个 `<section>`：`.scene-select`、`.canvas-page`、`.result-page`。默认只 `.scene-select` 可见（用 `.active` 类切换）
- 建 `css/main.css`：全局 reset、三屏切换（`section { display: none } section.active { display: block }`）、mobile-first 布局
- 建 `js/scenes.js`：导出 6 个场景元数据数组
  ```js
  export const SCENES = [
    { id: 'seaside', name: '海边', silhouette: 'scenes/seaside.svg' },
    { id: 'forest',  name: '森林', silhouette: 'scenes/forest.svg' },
    { id: 'space',   name: '太空', silhouette: 'scenes/space.svg' },
    { id: 'park',    name: '公园', silhouette: 'scenes/park.svg' },
    { id: 'home',    name: '家',   silhouette: 'scenes/home.svg' },
    { id: 'school',  name: '校园', silhouette: 'scenes/school.svg' },
  ]
  ```
- 建 `js/canvas.js`：导出 `initCanvas(containerEl, sceneId)` 函数
  - 用 fabric.js 在容器里建 720×1280 画布
  - 支持手指触摸涂鸦（fabric.js 的 `isDrawingMode = true`）
  - 默认颜色黑色、粗细 5
- 建 `js/app.js`：入口
  - 读 `SCENES` 渲染 6 张场景卡片到首页
  - 绑定点击：切到画布页 + `initCanvas`
- `scenes/*.svg`：先用 6 个占位色块 SVG（一个纯色矩形就行，后期替换）
- fabric.js 用 CDN 引入到 `index.html`：`<script src="https://cdn.jsdelivr.net/npm/fabric@5/dist/fabric.min.js"></script>`

### 验收

- iPhone Safari、Android Chrome 打开，看到 6 个场景
- 点场景 → 进入画布 → 手指涂鸦能画线，黑色，粗细 5px
- 无 JS 报错

## Day 2：工具栏

### 要做

- `index.html`：画布页底部加 `.canvas-toolbar`：4 个颜色圆点（红/黄/蓝/黑）+ 撤销 + 清空 + 生成
- `css/main.css`：工具栏 `position: fixed; bottom: 0`，儿童向大按钮（min-height 60px），色块用圆形
- `js/canvas.js`：新增
  - `setColor(hex)`：切换画笔颜色
  - `undo()`：撤销上一笔（fabric.js 里维护一个 stack）
  - `clear()`：清空所有涂鸦，保留底图
- `js/app.js`：绑定工具栏点击

### 验收

- 能切颜色继续画
- 撤销能一笔笔往回删
- 清空只删涂鸦不删底图

## Day 3：场景剪影底图 + 生成按钮（联调 mock）

### 要做

- `js/canvas.js`：`initCanvas` 加载对应 `scenes/<id>.svg` 作底图，锁定 `selectable=false, evented=false`
- 建 `js/api.js`：
  ```js
  const API_ENDPOINT = 'https://api.xinlu-ai.xin/api/generate'
  export async function generateImage(canvasBase64, sceneId, styleVariant = 'cartoon') {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mock': 'true',  // 第一版联调开 mock，Day 6 去掉
      },
      body: JSON.stringify({ canvas_image: canvasBase64, scene_id: sceneId, style_variant: styleVariant }),
    })
    return await res.json()
  }
  ```
- `js/app.js`：绑定"生成"按钮：
  - 导出画布为 base64（fabric.js `canvas.toDataURL('image/png')`）
  - 切到加载页
  - 调 `generateImage`
  - 成功 → 切到结果页显示图；失败 → alert 错误提示

### 验收

- 涂完点生成 → 加载页 2 秒 → 结果页显示 mock 图
- 网络断开 → alert "网络出错"

## Day 4：加载页 + 结果页

### 要做

- `index.html`：
  - 加载页：卡通角色 PNG + "AI 正在画..." + CSS 旋转动画
  - 结果页：全屏图（`object-fit: contain`）+ 底部按钮（保存二维码 / 重画 / 打印）
- `css/main.css`：加载动画只用 CSS `@keyframes`，不引 JS 动画库
- `js/app.js`：把三屏切换封装成 `showScreen(name)`，`state.currentScreen` 追踪

### 验收

- 完整 4 屏流程无卡顿，Android + iOS 都测过
- 加载动画不卡

## Day 5：二维码 + 保存

### 要做

- CDN 引入 qrcode.js：`<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5/build/qrcode.min.js"></script>`
- 结果页"保存二维码"按钮：点击生成含 `image_url` 的二维码浮层
- 浮层文案："扫码后长按图片保存到相册"

**注意**：qrcode.js 是本项目允许的第二个 CDN 依赖。加其他任何依赖前，先在群里问。

### 验收

- 用另一部手机扫码能看到大图
- 长按能保存到相册

## Day 6：接真 API + UI 打磨

### 要做

- `js/api.js`：去掉 `X-Mock: true` header，`API_ENDPOINT` 换 B 部署好的真 Worker URL
- 端到端跑：涂鸦 → AI 真出图 → 展示
- `css/main.css`：字号加大（正文 18px+）、按钮圆角、暖色调（`--color-primary` 用暖橙或暖黄）、加卡通引导角色 PNG

### 验收

- iPhone / Android / 微信浏览器打开全走通
- 生成结果实际能看

## Day 7：真孩子测试 + 修 bug

### 要做

- 找 2-3 个 6-9 岁孩子（队员亲戚）实测
- 记录卡壳点
- 只修最影响体验的 3 个问题
- **别加新功能**

### 验收

- 孩子能独立走完 4 屏，不用大人手把手教

## 每天下班前

- `git commit` + `git push`（直接推 main，不开分支）
- 群里发一句今天进展 + 明天要做什么
- 如果时间超预算，说，别硬撑

## 禁止清单（再强调）

- 不写单元测试
- 不加 React、Vue、Angular
- 不加 Tailwind、Sass
- 不加构建工具
- 不加 SEO meta（用户扫码进）
- 不加深色模式
- 不加国际化
- 不加 PWA、Service Worker
- 不改 `worker/`
- 不改 `SPEC.md` 的接口协议
- 不改错误码枚举
- 不加 CDN 依赖（fabric.js 和 qrcode.js 之外）
