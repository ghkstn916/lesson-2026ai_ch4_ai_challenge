// Vercel 서버리스 proxy for OpenAI gpt-image-2 (3차시).
// 학생이 헤더 X-OpenAI-Key로 본인 키를 직접 보낸다.
//
// ⚠ Edge 런타임은 사용 금지: 이미지 생성이 25초를 넘기면 Vercel이 plain-text
// 오류("An error occurred...")를 반환해서 클라이언트의 res.json() 파싱이 깨진다.
// Node 런타임 + maxDuration 60s 로 해결 (runtime은 미지정이 곧 Node 기본).

// runtime을 명시적 버전으로 박는다. Vercel은 'nodejs' 같은 불완전 값은 무시하고
// 이전 Edge 메타데이터로 폴백하는 사례가 있어 25s 한계가 계속 적용됨.
export const config = {
  runtime: 'nodejs20.x',
  maxDuration: 60,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  const key = req.headers['x-openai-key'] || process.env.OPENAI_API_KEY
  if (!key) {
    res.status(400).json({ error: 'OpenAI API 키가 필요합니다.' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

  let upstream
  try {
    upstream = await fetch('https://api.openai.com/v1/images/generations', {
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
  } catch (e) {
    res.status(502).json({ error: { message: `upstream fetch 실패: ${e.message}` } })
    return
  }

  const text = await upstream.text()
  res.status(upstream.status)
  res.setHeader('content-type', 'application/json')
  res.send(text)
}
