# TASKS-B（AI + 后端 · owner）

> 你（KY）的 7 天任务。搭档在前端并行。别改 `index.html`、`css/`、`js/`。

## 开工前（Day 0）

1. 读完 `CLAUDE.md` 和 `SPEC.md`
2. 装 Wrangler：`npm i -g wrangler`
3. `wrangler login`（打开浏览器授权 Cloudflare 账号）
4. 注册阿里云 → 开通 DashScope → 拿 `DASHSCOPE_API_KEY`
5. 阅读通义万相 img2img 文档：https://help.aliyun.com/zh/dashscope/developer-reference/api-details-9
6. **API Key 只放 `wrangler secret`**，不要写代码、不要写 `wrangler.toml`、不要写 `.env`

## Day 1：Worker skeleton + mock 模式

### 要做

- 建 `worker/wrangler.toml`：
  ```toml
  name = "ai-doodle-studio-api"
  main = "worker.js"
  compatibility_date = "2026-01-01"
  ```
- 建 `worker/worker.js`：
  ```js
  export default {
    async fetch(request, env) {
      // CORS 预检
      if (request.method === 'OPTIONS') return corsResponse()
      if (request.method !== 'POST') return jsonError('INVALID_INPUT', '仅支持 POST')

      const url = new URL(request.url)
      if (url.pathname !== '/api/generate') return jsonError('INVALID_INPUT', '路径错')

      const isMock = request.headers.get('X-Mock') === 'true'
      const body = await request.json().catch(() => null)
      if (!body || !body.canvas_image || !body.scene_id) {
        return jsonError('INVALID_INPUT', '参数错')
      }

      if (isMock) {
        await sleep(2000)
        return jsonSuccess({
          image_url: 'https://picsum.photos/seed/xinlu-mock/720/1280',
          request_id: crypto.randomUUID(),
        })
      }

      // Day 2 起补真调用
      return jsonError('API_ERROR', '未实现')
    }
  }
  ```
- 加 CORS 头，`Access-Control-Allow-Origin` 白名单 `https://canvas.xinlu-ai.xin`（生产）和 `http://localhost:8000`（本地调试）
- 加辅助函数 `jsonSuccess`、`jsonError`、`sleep`、`corsResponse`
- 本地跑：`cd worker && wrangler dev`
- Mock 图直接用 picsum.photos（已经在代码里），不用自己上传

### 验收

- 搭档能用 `X-Mock: true` POST 你的 `wrangler dev` 地址，2 秒后拿到 mock 响应
- 群里发一下 dev worker 的 URL（`http://localhost:8787` 或 wrangler 给的 tunnel URL），让搭档能联调

## Day 2：通义万相第一次调通

### 要做

- 在 `worker/worker.js` 里非 mock 分支加真调用
- 通义万相 img2img 是异步接口：
  1. `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis` 创建任务，拿 `task_id`
  2. `GET https://dashscope.aliyuncs.com/api/v1/tasks/<task_id>` 轮询状态
  3. `SUCCEEDED` → 拿 `output.results[0].url`
- 硬编码一个测试 prompt：`"children book illustration, warm colors, cute style"`
- 用 `env.DASHSCOPE_API_KEY` 读密钥
- 30 秒超时 → 返回 `API_TIMEOUT`

### 验收

- 用 curl / Postman POST 一张涂鸦 base64，能拿到一张 AI 生成图 URL
- 通义万相后台看到调用记录
- 输出图能在浏览器打开

## Day 3：6 场景 prompt 工程

### 要做

- 在 `worker/worker.js` 建 `SCENE_PROMPTS` 常量：
  ```js
  const SCENE_PROMPTS = {
    seaside: 'children book illustration, ocean, sandy beach, seagulls, sunny day, warm colors, cute style, high quality',
    forest:  '...',
    space:   '...',
    park:    '...',
    home:    '...',
    school:  '...',
  }
  ```
- 负向 prompt 统一：`'no violence, no adult content, no scary, no dark theme, no gore'`
- 用你自己涂鸦 + 找 2-3 个小孩涂鸦（哪怕就是家里亲戚），每场景生成 5 张
- 迭代 prompt 直到 70% 输出你觉得"孩子看到会开心"

### 验收

- 6 场景各挑得出 3 张给评委看的
- 输出风格整体统一（不会一张油画一张像素画）

## Day 4：strength 调优 + 多风格预留

### 要做

- img2img 的 `strength` 参数试 0.3-0.7：
  - 太低 → 输出跟涂鸦太像，AI 没发挥
  - 太高 → 涂鸦完全丢失，孩子觉得"不是我画的"
  - 甜点大概 0.5-0.6
- 不同场景可能不同 strength（记录下来）
- `style_variant` 参数虽然只实现 `cartoon`，但代码结构留出 `watercolor`、`pixel` 的分支（返回 `INVALID_INPUT` 即可）

### 验收

- 涂鸦形状能看出来但被美化
- 输出至少让你自己觉得"值得打印一张"

## Day 5：内容安全 + 错误处理

### 要做

- 通义万相 NSFW 过滤触发 → 上游返回错误码 → 映射到 `CONTENT_UNSAFE`
- Canvas base64 大小检查（`> 2 * 1024 * 1024` 字节返回 `INVALID_INPUT`）
- 上游 30 秒超时 → `API_TIMEOUT`
- 速率限制：同一 IP（`request.headers.get('CF-Connecting-IP')`）每分钟最多 10 次，超出 `RATE_LIMIT`
  - 用 Cloudflare KV 或简单的内存 Map 都行（内存 Map 在 Worker 里不持久，可以但精度差；KV 更稳）
- 所有错误按 SPEC.md 枚举返回

### 验收

- 故意发空图 → `INVALID_INPUT`
- 故意发 3MB 图 → `INVALID_INPUT`
- 快速连发 15 次 → 第 11 次起 `RATE_LIMIT`
- 上游断连 → `API_TIMEOUT` 或 `API_ERROR`

## Day 6：部署 + 端到端联调

### 要做

- `wrangler deploy` 到生产
- Cloudflare Dashboard 配自定义域名 `api.xinlu-ai.xin`
- DNS 在 Cloudflare 上配好 A/CNAME 记录（`xinlu-ai.xin` 应该已经在 CF 上托管，Worker 挂子域名一键搞定）
- 群里发生产 URL 给搭档
- 搭档把 `API_ENDPOINT` 换成生产 URL、去掉 `X-Mock`
- 两人凑一起从 iPhone 走一遍全流程

### 验收

- 搭档手机上不改代码，涂完点生成能拿到真图
- 生产 URL 从公网可访问，CORS 正确

## Day 7：真孩子测试 + 调 prompt

### 要做

- 陪搭档一起找 2-3 个孩子实测
- 观察哪些涂鸦生成效果差（比如色彩单一、线条太少、太抽象）
- 回来调 prompt 或 strength
- 修完就停，不加新功能

### 验收

- 孩子作品有一半让家长觉得"值得打印"

## 每天下班前

- `git commit` + `git push`（直接推 main，不开分支）
- 群里发一句进展 + 明天要做什么
- 超预算就说

## 禁止清单

- 不加数据库（KV/R2 只用来存临时图和限流计数，24 小时过期）
- 不加账号系统、鉴权
- 不接第三方日志、监控、埋点
- 不重构接口协议（改 SPEC.md 要跟搭档对齐）
- 不改前端文件
- **API Key 只放 `wrangler secret`**，不放代码、`wrangler.toml`、`.env`
- 生成图 R2 存 24 小时后必须删除（合规 + 成本）
- 不启 Worker 分析（防止画布图被 CF 缓存）

## 已确定的信息

- Worker 域名：`api.xinlu-ai.xin`
- 前端域名：`canvas.xinlu-ai.xin`（CORS 白名单加这个 + `http://localhost:8000`）
- Mock 图：`https://picsum.photos/seed/xinlu-mock/720/1280`（picsum 稳定固定图）

## 遗留（遇到问人）

- 场景剪影 SVG 谁做
- 卡通引导角色 PNG 谁做
