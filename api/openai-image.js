// Vercel Edge proxy for OpenAI gpt-image-2 (3차시) — SSE streaming.
// 학생이 헤더 X-OpenAI-Key로 본인 키를 직접 보낸다.
//
// ⚠ Edge "initial response within 25s" 한계는 *우리 함수가 첫 byte를 보낸 시점*
// 기준이다. await fetch(openai)로 막아두면 OpenAI가 첫 응답을 늦게 줄 때
// 25s에 함수가 죽는다. → TransformStream으로 즉시 ": stream-start" 코멘트를
// 흘려 헤더+첫 byte를 발사하고, fetch + forward는 백그라운드 task로 돌린다.
// 그 다음엔 OpenAI completed까지 SSE 그대로 패스스루(최대 30분).

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

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  const writeEvent = async (type, payload) => {
    const line = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`
    try { await writer.write(encoder.encode(line)) } catch { /* aborted */ }
  }

  // 백그라운드 task: 즉시 첫 byte를 보낸 뒤 OpenAI를 호출하고 forward
  ;(async () => {
    try {
      // 1) 즉시 keep-alive 코멘트 — Edge의 25s "initial response" 한계 통과
      await writer.write(encoder.encode(': stream-start\n\n'))

      // 2) keep-alive ping을 10초마다 흘려 중간에도 죽지 않게
      const pingTimer = setInterval(() => {
        writer.write(encoder.encode(': ping\n\n')).catch(() => {})
      }, 10000)

      // 3) OpenAI 호출 + SSE forward
      let upstream
      try {
        upstream = await fetch('https://api.openai.com/v1/images/generations', {
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
      } catch (e) {
        clearInterval(pingTimer)
        await writeEvent('error', { type: 'error', error: { message: `upstream fetch 실패: ${e.message}` } })
        return
      }

      if (!upstream.ok) {
        clearInterval(pingTimer)
        const text = await upstream.text()
        let msg = text
        try {
          const j = JSON.parse(text)
          msg = j.error?.message || j.error || text
        } catch { /* plain text */ }
        await writeEvent('error', { type: 'error', error: { message: `OpenAI ${upstream.status}: ${msg}` } })
        return
      }

      const reader = upstream.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }
      } finally {
        clearInterval(pingTimer)
      }
    } catch (e) {
      await writeEvent('error', { type: 'error', error: { message: e.message } })
    } finally {
      try { await writer.close() } catch { /* already closed */ }
    }
  })()

  return new Response(stream.readable, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  })
}
