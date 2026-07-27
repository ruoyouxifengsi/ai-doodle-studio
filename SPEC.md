# SPEC.md

> 产品定义 + 接口协议。改这个文件里的接口、错误码、场景 id、字段名，必须两人先在群里对齐再改。

## 产品定义

孩子在手机上打开 H5 网页，从 6 个场景里选一个，在浅色纯色画布上用手指涂鸦，生成前选择 1-3 个"我画了什么"语义标签，点"生成"后 AI 根据场景、标签和涂鸦轮廓出图，可保存/打印。

## 明确不做

- 账号、登录、注册
- 分享到微信/QQ/朋友圈的社交传播链路
- 作品评论、点赞、排行榜
- 家长端、老师端
- 后台管理
- 作品长期存储（隐私 + 合规）

## 用户旅程（4 屏 + 1 个标签浮层）

1. **首页**：6 张场景大图，孩子点一个进入
2. **画布页**：显示浅色纯色背景，孩子自由涂鸦，底部工具栏（4-6 个颜色 + 撤销 + 清空 + 生成）
3. **标签浮层**：点击生成后选择 1-3 个场景对应标签，说明"我画了什么"
4. **加载页**：等待 10-30 秒，卡通角色 + 进度动画
5. **结果页**：全屏 AI 生成图 + 底部按钮（保存二维码 + 继续修改 + 打印）；继续修改返回原画布并保留笔迹

## 场景与语义标签（锁死 6 个）

| id | 中文名 | 可选标签（接口值） |
|----|--------|------------------|
| seaside | 海边 | 太阳 `sun`、船 `boat`、鱼 `fish`、螃蟹 `crab`、人物 `person` |
| forest | 森林 | 树 `tree`、花草 `flower_grass`、四脚动物 `quadruped_animal`、鸟 `bird`、人物 `person` |
| space | 太空 | 宇航员 `astronaut`、火箭 `rocket`、星球 `planet`、外星人 `alien`、星星 `star` |
| park | 公园 | 树 `tree`、花草 `flower_grass`、人物 `person`、小狗 `dog`、长椅 `bench` |
| home | 家 | 人物 `person`、宠物 `pet`、家具 `furniture`、房子 `house`、玩具 `toy` |
| school | 校园 | 人物 `person`、教学楼 `school_building`、球 `ball`、树 `tree`、书本 `book` |

每次必须选择 1-3 个标签。具体 prompt 细节由 B 在 `worker/worker.js` 里维护。

## 画布规范

- 尺寸：宽 720px × 高 1280px（9:16 竖屏，固定）
- 底图：场景对应的浅色纯色背景，不加载 SVG 剪影
- 涂鸦层：孩子在纯色背景上自由画
- 颜色：4-6 个预设色块（红/黄/蓝/绿/黑/棕），不做自由取色
- 笔刷：单一粗细（5px 左右），不做粗细选择

## 接口协议

**Endpoint**：`POST https://api.xinlu-ai.xin/api/generate`

**Request Body**（JSON）：

```json
{
  "canvas_image": "data:image/png;base64,iVBOR...",
  "scene_id": "seaside",
  "object_tags": ["boat", "person"],
  "style_variant": "cartoon"
}
```

字段：

- `canvas_image`：base64 编码的画布 PNG，含浅色纯色背景和涂鸦。大小 ≤ 2 MB
- `scene_id`：见场景表，固定 6 个之一
- `object_tags`：字符串数组；必须选择当前场景允许的 1-3 个标签，不允许重复
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

- 卡通引导角色 PNG 谁提供——群里定
- 打印链路（社区打印机型号）——队长现场确认
- 儿童图像授权书——队长跟街道办确认
