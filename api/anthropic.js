// Vercel 서버리스 thin proxy for Anthropic.
// 학생이 헤더 X-API-Key로 본인 키를 직접 보낸다. 서버는 키를 저장하지 않음.

export const config = { runtime: 'edge' }

const ANTHROPIC_VERSION = '2023-06-01'

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
  }

  const key = req.headers.get('x-api-key') || process.env.ANTHROPIC_API_KEY
  if (!key) {
    return new Response(JSON.stringify({ error: 'Anthropic API 키가 필요합니다.' }), { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), { status: 400 })
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  })

  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  })
}
