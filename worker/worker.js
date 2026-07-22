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

const DEFAULT_STRENGTH = 0.5

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

    if (typeof body.canvas_image !== 'string' || body.canvas_image.length > MAX_CANVAS_BYTES) {
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

    let strength = DEFAULT_STRENGTH
    if (typeof body.strength === 'number' && body.strength >= 0 && body.strength <= 1) {
      strength = body.strength
    }

    try {
      const imageUrl = await callWanx(body.canvas_image, scenePrompt, strength, apiKey)
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

async function callWanx(baseImage, prompt, strength, apiKey) {
  const deadline = Date.now() + OVERALL_TIMEOUT_MS

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
  const code = ((output && output.code) || '').toLowerCase()
  const msg = ((output && output.message) || '').toLowerCase()
  return (
    code.includes('inspection') ||
    code.includes('safety') ||
    msg.includes('inspection') ||
    msg.includes('safety') ||
    msg.includes('risk') ||
    msg.includes('敏感') ||
    msg.includes('违规')
  )
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
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
