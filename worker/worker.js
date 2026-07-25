const CORS_PROD_ALLOWED = new Set([
  'https://canvas.xinlu-ai.xin',
])

const MOCK_IMAGE_URL = 'https://picsum.photos/seed/xinlu-mock/720/1280'

const MAX_CANVAS_BYTES = 2 * 1024 * 1024

const DASHSCOPE_CREATE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis'
const DASHSCOPE_TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks/'
const WANX_MODEL = 'wanx2.1-imageedit'
const WANX_FUNCTION = 'doodle'
const OVERALL_TIMEOUT_MS = 30000
const POLL_INTERVAL_MS = 2000
const RATE_LIMIT_WINDOW_MS = 60000
const RATE_LIMIT_MAX = 10
const rateBuckets = new Map()

const STYLE_CORE =
  '儿童绘本插画，保留涂鸦的主体、位置和轮廓，补充完整细节，线条清晰，色彩明亮，画面温暖可爱，适合低年级儿童'

const SCENE_PROMPTS = {
  seaside: `${STYLE_CORE}，阳光下的海边，有蓝色海水、沙滩和天空`,
  forest: `${STYLE_CORE}，生机勃勃的森林，有树木、草地和阳光`,
  space: `${STYLE_CORE}，奇妙的太空，有星球、星星和深蓝色宇宙`,
  park: `${STYLE_CORE}，晴朗的社区公园，有树木、草地、道路和天空`,
  home: `${STYLE_CORE}，温馨的家，有房屋、家具和生活气息`,
  school: `${STYLE_CORE}，明亮友好的校园，有教学楼、操场和树木`,
}

const TAG_PROMPTS = {
  sun: '太阳',
  boat: '船',
  fish: '鱼',
  crab: '螃蟹',
  person: '人物（保留头部、身体和四肢）',
  tree: '树木（保留树干和树冠）',
  flower_grass: '花草',
  quadruped_animal: '四脚动物（保留身体、头部、四条腿和尾巴）',
  bird: '鸟',
  astronaut: '宇航员',
  rocket: '火箭',
  planet: '星球',
  alien: '外星人',
  star: '星星',
  dog: '小狗（保留身体、头部、四条腿和尾巴）',
  bench: '长椅',
  pet: '宠物',
  furniture: '家具',
  house: '房子',
  toy: '玩具',
  school_building: '教学楼',
  ball: '球',
  book: '书本',
}

const SCENE_TAGS = {
  seaside: ['sun', 'boat', 'fish', 'crab', 'person'],
  forest: ['tree', 'flower_grass', 'quadruped_animal', 'bird', 'person'],
  space: ['astronaut', 'rocket', 'planet', 'alien', 'star'],
  park: ['tree', 'flower_grass', 'person', 'dog', 'bench'],
  home: ['person', 'pet', 'furniture', 'house', 'toy'],
  school: ['person', 'school_building', 'ball', 'tree', 'book'],
}

const IMPLEMENTED_STYLE_VARIANT = 'cartoon'

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return corsPreflight(request)

    if (request.method !== 'POST') {
      return jsonError(request, 400, 'INVALID_INPUT', '仅支持 POST')
    }

    const url = new URL(request.url)
    if (url.pathname !== '/api/generate') {
      return jsonError(request, 400, 'INVALID_INPUT', '路径不存在')
    }

    if (!consumeRateLimit(request)) {
      return jsonError(request, 429, 'RATE_LIMIT', '请稍等 30 秒')
    }

    let body
    try {
      body = await request.json()
    } catch {
      return jsonError(request, 400, 'INVALID_INPUT', 'JSON 解析失败')
    }

    if (!body || !body.canvas_image || !body.scene_id) {
      return jsonError(request, 400, 'INVALID_INPUT', '缺少必填字段')
    }

    if (!SCENE_PROMPTS[body.scene_id]) {
      return jsonError(request, 400, 'INVALID_INPUT', '场景不存在')
    }

    const objectTags = validateObjectTags(body.scene_id, body.object_tags)
    if (!objectTags) {
      return jsonError(request, 400, 'INVALID_INPUT', '请选择 1 至 3 个画面内容')
    }
    const scenePrompt = buildScenePrompt(body.scene_id, objectTags)

    const styleVariant = body.style_variant || IMPLEMENTED_STYLE_VARIANT
    if (styleVariant !== IMPLEMENTED_STYLE_VARIANT) {
      return jsonError(request, 400, 'INVALID_INPUT', '暂不支持该绘画风格')
    }

    const canvasBytes = getCanvasBytes(body.canvas_image)
    if (canvasBytes === null || canvasBytes === 0 || canvasBytes > MAX_CANVAS_BYTES) {
      return jsonError(request, 400, 'INVALID_INPUT', '画布图片超限或格式错')
    }

    const isMock = request.headers.get('X-Mock') === 'true'
    if (isMock) {
      await sleep(2000)
      return jsonSuccess(request, {
        image_url: MOCK_IMAGE_URL,
        request_id: crypto.randomUUID(),
      })
    }

    const apiKey = env.DASHSCOPE_API_KEY
    if (!apiKey) {
      return jsonError(request, 500, 'API_ERROR', '服务未配置密钥')
    }

    try {
      const imageUrl = await callWanxWithRetry(body.canvas_image, scenePrompt, apiKey)
      return jsonSuccess(request, {
        image_url: imageUrl,
        request_id: crypto.randomUUID(),
      })
    } catch (err) {
      const code = err.code || 'API_ERROR'
      return jsonError(request, 200, code, err.message || 'AI 累了休息一下，请稍后重试')
    }
  },
}

async function callWanxWithRetry(baseImage, prompt, apiKey) {
  const deadline = Date.now() + OVERALL_TIMEOUT_MS
  let lastError

  for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt += 1) {
    try {
      return await callWanx(baseImage, prompt, apiKey, deadline)
    } catch (err) {
      const code = err.code || 'API_ERROR'
      lastError = err.code ? err : upstreamError(code, 'AI 累了休息一下，请稍后重试')
      if (code !== 'API_ERROR' || attempt === 1) throw lastError
      await sleep(500)
    }
  }

  throw lastError || upstreamError('API_TIMEOUT', '网络慢，请重试')
}

async function callWanx(baseImage, prompt, apiKey, deadline) {
  const createRes = await fetchWithTimeout(
    DASHSCOPE_CREATE_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: WANX_MODEL,
        input: { function: WANX_FUNCTION, prompt, base_image_url: baseImage },
        parameters: { n: 1, is_sketch: true },
      }),
    },
    remaining(deadline),
  )

  const createData = await createRes.json().catch(() => null)
  const taskId = createData && createData.output && createData.output.task_id
  if (!createRes.ok || !taskId) {
    if (isContentUnsafe(createData)) throw upstreamError('CONTENT_UNSAFE', '再画一张试试')
    throw upstreamError('API_ERROR', 'AI 累了休息一下，请稍后重试')
  }

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    const pollRes = await fetchWithTimeout(
      DASHSCOPE_TASK_URL + taskId,
      { headers: { Authorization: `Bearer ${apiKey}` } },
      remaining(deadline),
    )
    const pollData = await pollRes.json().catch(() => null)
    const output = pollData && pollData.output
    const status = output && output.task_status

    if (status === 'SUCCEEDED') {
      const url = output.results && output.results[0] && output.results[0].url
      if (!url) throw upstreamError('API_ERROR', 'AI 累了休息一下，请稍后重试')
      return url
    }
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      if (isContentUnsafe(output)) throw upstreamError('CONTENT_UNSAFE', '再画一张试试')
      throw upstreamError('API_ERROR', 'AI 累了休息一下，请稍后重试')
    }
  }

  throw upstreamError('API_TIMEOUT', '网络慢，请重试')
}

function remaining(deadline) {
  return Math.max(0, deadline - Date.now())
}

function validateObjectTags(sceneId, tags) {
  if (!Array.isArray(tags) || tags.length < 1 || tags.length > 3) return null
  if (tags.some((tag) => typeof tag !== 'string')) return null
  const uniqueTags = [...new Set(tags)]
  if (uniqueTags.length !== tags.length) return null
  const allowedTags = SCENE_TAGS[sceneId]
  if (!allowedTags || uniqueTags.some((tag) => !allowedTags.includes(tag))) return null
  return uniqueTags
}

function buildScenePrompt(sceneId, tags) {
  const objects = tags.map((tag) => TAG_PROMPTS[tag]).join('、')
  return `${SCENE_PROMPTS[sceneId]}。输入涂鸦明确包含：${objects}。必须按照原位置和轮廓识别这些内容，不得忽略、替换或改成其他物体，再将它们绘本化并自然融入场景`
}

function upstreamError(code, message) {
  const e = new Error(message)
  e.code = code
  return e
}

function isContentUnsafe(output) {
  const text = JSON.stringify(output || {}).toLowerCase()
  return [
    'inspection',
    'safety',
    'risk',
    'inappropriate',
    'nsfw',
    '敏感',
    '违规',
  ].some((keyword) => text.includes(keyword))
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw upstreamError('API_TIMEOUT', '网络慢，请重试')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function getCanvasBytes(canvasImage) {
  if (typeof canvasImage !== 'string') return null
  const match = canvasImage.match(/^data:image\/png;base64,([A-Za-z0-9+/\s]+={0,2})$/)
  if (!match) return null
  const base64 = match[1].replace(/\s/g, '')
  if (!base64 || base64.length % 4 !== 0) return null
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

function consumeRateLimit(request) {
  const forwarded = request.headers.get('X-Forwarded-For') || ''
  const ip = request.headers.get('CF-Connecting-IP') || forwarded.split(',')[0].trim() || 'local'
  const now = Date.now()

  if (rateBuckets.size > 1000) {
    for (const [key, value] of rateBuckets) {
      if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key)
    }
  }

  const bucket = rateBuckets.get(ip)

  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 })
    return true
  }

  bucket.count += 1
  return bucket.count <= RATE_LIMIT_MAX
}

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (CORS_PROD_ALLOWED.has(origin)) return true
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true
  return false
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = isAllowedOrigin(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Mock',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

function corsPreflight(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

function jsonSuccess(request, data) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  })
}

function jsonError(request, status, code, message) {
  return new Response(
    JSON.stringify({ success: false, error_code: code, error_message: message }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
    },
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
