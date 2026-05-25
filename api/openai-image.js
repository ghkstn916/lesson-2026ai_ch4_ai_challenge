// Vercel 서버리스 proxy for OpenAI gpt-image-2 (3차시).
// 학생이 헤더 X-OpenAI-Key로 본인 키를 직접 보낸다.

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
  }

  const key = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY
  if (!key) {
    return new Response(JSON.stringify({ error: 'OpenAI API 키가 필요합니다.' }), { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), { status: 400 })
  }

  const upstream = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      ...body,
    }),
  })

  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  })
}
