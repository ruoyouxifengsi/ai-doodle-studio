# CLAUDE.md

> 这个仓库有硬规则。session 开始必须先读完这个文件和 SPEC.md，再动手。不确定的一律停下问人，不要自己拍板。

## 项目是什么

儿童 AI 涂鸦画室：一个手机 H5 网页，孩子在预设场景剪影上涂鸦，Cloudflare Worker 代理调用通义万相 img2img，输出儿童插画，可打印。

服务对象：暑期托管班的 30 个 2-3 年级随迁子女。摇篮杯参赛技术产品。

## 技术栈（锁死，不许换、不许升级、不许加）

- **前端**：纯 HTML5 + ES6 module + fabric.js（CDN 引入）
- **无构建工具**：不用 webpack、vite、rollup、esbuild、parcel
- **无框架**：不用 Vue、React、Svelte、Angular、Solid
- **CSS**：原生 CSS，禁止 Tailwind、UnoCSS、Sass、Less
- **响应式**：mobile-first + `@media (min-width: 768px)`
- **后端**：Cloudflare Worker（`worker/` 目录）
- **AI API**：阿里通义万相 wanx-v1 img2img
- **部署**：GitHub Pages（`canvas.xinlu-ai.xin`）+ Cloudflare Worker（`api.xinlu-ai.xin`）
- **主域名**：`xinlu-ai.xin`（owner 已购买）

## 目录结构（锁死，不许改）

```
/
├── index.html            入口，三屏
├── css/main.css          主样式
├── js/
│   ├── app.js            主入口 + 状态机
│   ├── canvas.js         fabric.js 画布模块
│   ├── scenes.js         场景元数据
│   └── api.js            调用 Worker 的 fetch 封装
├── scenes/               6 个 SVG 剪影
├── worker/
│   ├── worker.js
│   └── wrangler.toml
├── CLAUDE.md
├── SPEC.md
├── TASKS-A.md            前端（搭档）
└── TASKS-B.md            AI/后端（owner）
```

不许自己加目录、加文件类型、加 `src/`、`dist/`、`components/`、`utils/`。

## 分工边界

- **A（搭档，前端）**：只改 `index.html`、`css/`、`js/`、`scenes/`
- **B（owner，AI/后端）**：只改 `worker/`
- **共享**：`SPEC.md`——改接口协议前两人必须在群里对齐

A 不许碰 `worker/`。B 不许碰前端文件。发现对方那半有 bug，去群里说，不要越权改。

## 禁止清单

不许做以下事，除非用户明确同意：

1. 加新依赖（npm 包、CDN 库）
2. 改 `SPEC.md` 的接口协议、错误码、场景 id
3. 改目录结构
4. 重构或"顺手清理"未沟通过的代码
5. 加测试框架（jest、vitest、cypress、playwright）
6. 加代码格式化配置（prettier、eslint、editorconfig）
7. 写 `README.md` 或其他文档文件
8. 加注释——除非 WHY 不明显，不写 WHAT 型注释
9. 改另一半的文件
10. `git push --force`、`git reset --hard`、`rm -rf` 而不问
11. 加账号系统、分享、评论、点赞、后台管理
12. 加深色模式、国际化、SEO meta、PWA、Service Worker
13. 兼容 IE、老版微信内置浏览器（低于 2020 年）
14. 加数据上报、埋点、第三方 SDK

## 命名规范

- CSS 类：`kebab-case`（`.scene-card`、`.canvas-toolbar`）
- JS 函数：`camelCase`（`renderCanvas`、`fetchGenerated`）
- JS 常量：`UPPER_SNAKE`（`API_ENDPOINT`、`MAX_CANVAS_SIZE`）
- 场景 id：小写英文（`seaside`、`forest`、`space`、`park`、`home`、`school`）
- CSS 变量：`--kebab-case`（`--color-primary`）

## Session 开工必读顺序

1. 读 `CLAUDE.md`（本文件）
2. 读 `SPEC.md`
3. 读你那一半的 TASKS 文件
4. `git status` 看当前状态
5. `git pull` 拉最新

不要读另一半的 TASKS，除非需要理解接口。

## Git 规范（简化，2 人小队直推 main）

- **直接推 main**，不开分支、不发 PR
- 开工前先 `git pull` 拉最新
- 完成一个能跑的小步骤就 `git commit && git push`，不要攒一整天
- commit 前本地跑一次（前端：`python -m http.server` 打开 index.html；worker：`wrangler dev`）
- commit 消息中文短句，不加 emoji，不加 `Co-Authored-By`
- 一次 commit 只做一件事
- pull 时如果提示冲突（罕见——A 只改前端 B 只改 worker），不要自己 merge，去群里说

## 遇到以下情况必须停下问人

- SPEC.md 的接口协议看不明白
- 需要新场景 id 或改场景模板
- 需要改错误码枚举
- 需要 API Key、域名、Worker 部署 URL
- 发现另一半的 bug
- 时间超预算（今天没做完就说，别硬撑加班）
- 想加任何一个"这个如果加上更好"的功能——先问，别加

## 不做假设

- SPEC.md 没写的功能都不做
- 不"顺手加"分享/评论/点赞/账号
- 不"顺手支持"其他浏览器/其他设备/其他语言
- 不"顺手兼容"低版本浏览器
- 不"顺手重构"看着别扭的代码
- 不"顺手抽"一个工具函数——三行重复没关系

## 写代码风格

- 不写文档字符串，不写 JSDoc
- 不写 `// TODO`——要 TODO 就直接不做
- 单文件不超过 300 行，超了先问要不要拆
- 优先扁平结构，不搞五层嵌套
