// Vercel 서버리스 proxy for OpenAI gpt-image-2 (3차시).
// 학생이 헤더 X-OpenAI-Key로 본인 키를 직접 보낸다.
//
// ⚠ Edge 런타임은 사용 금지: 이미지 생성이 25초를 넘기면 Vercel이 plain-text
// 오류("An error occurred...")를 반환해서 클라이언트의 res.json() 파싱이 깨진다.
// Node 런타임 + maxDuration 60s 로 해결 (runtime은 미지정이 곧 Node 기본).

// Vercel CLI 빌드 검증 결과: runtime 허용값은 "edge" | "experimental-edge" | "nodejs"
// 'nodejs20.x' 같은 버전 접미 형태는 deploy_failed 에러로 빌드를 깨뜨림.
export const config = {
  runtime: 'nodejs',
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
