const API_ENDPOINT = 'https://api.xinlu-ai.xin/api/generate'

export async function generateImage(canvasBase64, sceneId, objectTags, styleVariant = 'cartoon') {
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      canvas_image: canvasBase64,
      scene_id: sceneId,
      object_tags: objectTags,
      style_variant: styleVariant,
    }),
  })

  if (!res.ok) {
    throw new Error('网络出错，请重试')
  }

  return await res.json()
}
