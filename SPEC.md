# SPEC.md

> 产品定义 + 接口协议。改这个文件里的接口、错误码、场景 id、字段名，必须两人先在群里对齐再改。

## 产品定义

孩子在手机上打开 H5 网页，从 6 个场景里选一个，进入画布看到场景剪影，用手指涂鸦叠加，点"生成"后 10-15 秒 AI 出图，可保存/打印。

## 明确不做

- 账号、登录、注册
- 分享到微信/QQ/朋友圈的社交传播链路
- 作品评论、点赞、排行榜
- 家长端、老师端
- 后台管理
- 作品长期存储（隐私 + 合规）

## 用户旅程（4 屏）

1. **首页**：6 张场景大图，孩子点一个进入
2. **画布页**：显示场景剪影作底图，孩子在上层涂鸦，底部工具栏（4-6 个颜色 + 撤销 + 清空 + 生成）
3. **加载页**：等待 10-15 秒，卡通角色 + 进度动画
4. **结果页**：全屏 AI 生成图 + 底部按钮（保存二维码 + 重画 + 打印）

## 场景模板（锁死 6 个）

| id | 中文名 | 剪影文件 | prompt 主关键词（给 B） |
|----|--------|---------|---------------------|
| seaside | 海边 | `scenes/seaside.svg` | ocean, sandy beach, seagulls, sunny |
| forest | 森林 | `scenes/forest.svg` | forest, tall trees, sunlight through leaves |
| space | 太空 | `scenes/space.svg` | outer space, planets, stars, spaceship |
| park | 公园 | `scenes/park.svg` | park, green lawn, benches, flowers |
| home | 家 | `scenes/home.svg` | cozy living room, warm light, furniture |
| school | 校园 | `scenes/school.svg` | schoolyard, classroom, blackboard, children |

具体 prompt 细节由 B 在 `worker/worker.js` 里维护。A 只用 id 引用，不关心 prompt 内容。

## 画布规范

- 尺寸：宽 720px × 高 1280px（9:16 竖屏，固定）
- 底图：场景剪影 SVG，不可编辑，锁定为背景
- 涂鸦层：孩子只在上层画
- 颜色：4-6 个预设色块（红/黄/蓝/绿/黑/棕），不做自由取色
- 笔刷：单一粗细（5px 左右），不做粗细选择

## 接口协议

**Endpoint**：`POST https://api.xinlu-ai.xin/api/generate`

**Request Body**（JSON）：

```json
{
  "canvas_image": "data:image/png;base64,iVBOR...",
  "scene_id": "seaside",
  "style_variant": "cartoon"
}
```

字段：

- `canvas_image`：base64 编码的画布 PNG，含涂鸦叠加在剪影上的完整画面。大小 ≤ 2 MB
- `scene_id`：见场景表，固定 6 个之一
- `style_variant`：`cartoon` | `watercolor` | `pixel`。第一版只实现 `cartoon`，另两个是接口预留

**Response 成功**（HTTP 200）：

```json
{
  "success": true,
  "image_url": "https://api.xinlu-ai.xin/images/<uuid>.png",
  "request_id": "<uuid>"
}
```

**Response 失败**（HTTP 200，success=false）：

```json
{
  "success": false,
  "error_code": "CONTENT_UNSAFE",
  "error_message": "生成内容不适合展示，请重新画"
}
```

错误码枚举（锁死）：

| error_code | 含义 | 前端处理 |
|-----------|------|---------|
| INVALID_INPUT | 参数错误（缺字段、图片格式错、超 2MB）| 提示"数据出错，请重试" |
| CONTENT_UNSAFE | AI 输出被安全过滤 | 提示"再画一张试试" |
| API_TIMEOUT | 上游超时（30 秒未拿到结果）| 提示"网络慢，请重试" |
| API_ERROR | 上游错误 | 提示"AI 累了休息一下，请稍后重试" |
| RATE_LIMIT | 触发限流 | 提示"请稍等 30 秒" |

HTTP 状态码：

- 400：请求格式错（body 不是 JSON、字段缺失）
- 429：Worker 层限流
- 500：Worker 内部异常
- 502：上游 API 挂了

前端遇到非 200 统一提示"网络出错，请重试"，不用区分状态码。

## Mock 模式（联调用）

Worker 必须支持 mock：

- 请求头 `X-Mock: true` 时，无视上游 API，2 秒后返回固定示意图 URL
- Mock 图片 URL 第一版用 `https://picsum.photos/seed/xinlu-mock/720/1280`（picsum 稳定固定图），后期换成 owner 上传到仓库的真示意图

A 在 B 没搭好前，全程用 mock 联调前端。B 搭好真 API 后，A 去掉 mock header 联调生产。

## 图片规范

- 画布输出：PNG，base64，720×1280
- AI 输出：PNG，1024×1820 左右（9:16），Worker 存到 R2 或 Cloudflare Images
- 存储期：24 小时后过期删除（合规 + 节省成本）

## 隐私

- 前端不 localStorage 存孩子涂鸦、生成图、任何标识
- Worker 不记录 canvas_image 内容到日志
- 生成图 24 小时过期
- 不接第三方埋点/分析

## 遗留（遇到问人）

- 场景剪影 SVG 谁画/找/买——群里定
- 卡通引导角色 PNG 谁提供——群里定
- 打印链路（社区打印机型号）——队长现场确认
- 儿童图像授权书——队长跟街道办确认
