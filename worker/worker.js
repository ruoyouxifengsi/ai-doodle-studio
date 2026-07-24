const CORS_PROD_ALLOWED = new Set([
  'https://canvas.xinlu-ai.xin',
])

const MOCK_IMAGE_URL = 'https://picsum.photos/seed/xinlu-mock/720/1280'

const MAX_CANVAS_BYTES = 2 * 1024 * 1024

const DASHSCOPE_CREATE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis'
const DASHSCOPE_TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks/'
const WANX_MODEL = 'wanx2.1-imageedit'
const WANX_FUNCTION = 'stylization_all'
const OVERALL_TIMEOUT_MS = 30000
const POLL_INTERVAL_MS = 2000
const RATE_LIMIT_WINDOW_MS = 60000
const RATE_LIMIT_MAX = 10
const rateBuckets = new Map()

const STYLE_CORE =
  'cute children picture book illustration, clean bold outlines, flat bright cheerful colors, simple kawaii shapes, smooth clean coloring, safe for young kids'

const SCENE_PROMPTS = {
  seaside: `${STYLE_CORE}, warm sunny seaside palette`,
  forest: `${STYLE_CORE}, fresh green forest palette`,
  space: `${STYLE_CORE}, deep starry night palette`,
  park: `${STYLE_CORE}, sunny green park palette`,
  home: `${STYLE_CORE}, cozy warm indoor palette`,
  school: `${STYLE_CORE}, bright friendly classroom palette`,
}

const SCENE_STRENGTHS = {
  seaside: 0.5,
  forest: 0.5,
  space: 0.5,
  park: 0.5,
  home: 0.5,
  school: 0.5,
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

    const scenePrompt = SCENE_PROMPTS[body.scene_id]
    if (!scenePrompt) {
      return jsonError(request, 400, 'INVALID_INPUT', '场景不存在')
    }

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

    let strength = SCENE_STRENGTHS[body.scene_id]
    if (typeof body.strength === 'number' && body.strength >= 0 && body.strength <= 1) {
      strength = body.strength
    }

    try {
      const imageUrl = await callWanxWithRetry(body.canvas_image, scenePrompt, strength, apiKey)
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

async function callWanxWithRetry(baseImage, prompt, strength, apiKey) {
  const deadline = Date.now() + OVERALL_TIMEOUT_MS
  let lastError

  for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt += 1) {
    try {
      return await callWanx(baseImage, prompt, strength, apiKey, deadline)
    } catch (err) {
      const code = err.code || 'API_ERROR'
      lastError = err.code ? err : upstreamError(code, 'AI 累了休息一下，请稍后重试')
      if (code !== 'API_ERROR' || attempt === 1) throw lastError
      await sleep(500)
    }
  }

  throw lastError || upstreamError('API_TIMEOUT', '网络慢，请重试')
}

async function callWanx(baseImage, prompt, strength, apiKey, deadline) {
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
        parameters: { n: 1, strength },
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
