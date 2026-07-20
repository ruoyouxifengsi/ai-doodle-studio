const CORS_PROD_ALLOWED = new Set([
  'https://canvas.xinlu-ai.xin',
])

const MOCK_IMAGE_URL = 'https://picsum.photos/seed/xinlu-mock/720/1280'

const MAX_CANVAS_BYTES = 2 * 1024 * 1024

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

    return jsonError(request, 500, 'API_ERROR', '真实 API 待 Day 2 接入')
  },
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
