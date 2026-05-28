// Vercel Edge proxy for OpenAI gpt-image-2 (3차시) — SSE streaming.
// 학생이 헤더 X-OpenAI-Key로 본인 키를 직접 보낸다.
//
// ⚠ Hobby 플랜은 Node 60s/Edge 25s가 한계인데, gpt-image-2의 복잡한 프롬프트는
// quality:'low'에서도 60s를 넘긴다. 해결: Edge + stream:true + partial_images:1.
// 첫 partial이 ~3초에 도착해 Edge의 25s "initial response" 한계를 가볍게 통과하고,
// 그 뒤 스트리밍은 최대 30분까지 유지된다.

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
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      ...body,
      stream: true,
      partial_images: 1,
    }),
  })

  // 4xx/5xx는 보통 JSON 에러로 옴 — 그대로 패스스루
  if (!upstream.ok) {
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    })
  }

  // SSE 스트림을 그대로 클라이언트로 흘려보낸다
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  })
}
