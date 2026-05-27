import useStudentStore from '../store/studentStore.js'

const ANTHROPIC_URL = '/api/anthropic'
const OPENAI_IMAGE_URL = '/api/openai-image'

function anthropicHeaders() {
  const key = useStudentStore.getState().anthropicKey
  const h = { 'content-type': 'application/json' }
  if (key) h['x-api-key'] = key
  return h
}

function openaiHeaders() {
  const key = useStudentStore.getState().openaiKey
  const h = { 'content-type': 'application/json' }
  if (key) h['x-openai-key'] = key
  return h
}

/**
 * 일반 텍스트 응답 (워밍업·한계·도구 등 거의 모든 곳).
 * @param {object} opts
 * @param {string} opts.model — 기본 claude-haiku-4-5-20251001
 * @param {Array}  opts.messages
 * @param {string} [opts.system]
 * @param {number} [opts.maxTokens]
 * @param {Array}  [opts.tools]
 * @returns {Promise<{text: string, raw: any}>}
 */
export async function callClaude({
  model = 'claude-haiku-4-5-20251001',
  messages,
  system,
  maxTokens = 1024,
  tools,
}) {
  const body = { model, max_tokens: maxTokens, messages }
  if (system) body.system = system
  if (tools) body.tools = tools

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(),
    body: JSON.stringify(body),
  })
  const raw = await res.json()
  if (!res.ok) throw new Error(raw.error?.message || raw.error || 'Claude 호출 실패')

  // text 블록만 모음 (tool_use는 raw에 보존)
  const text = (raw.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
  return { text, raw }
}

/**
 * 시각화용 — GlowScript JS 코드 생성 (2차시 BattleMode 호환).
 */
export async function generateGlowscriptCode(prompt) {
  const { text } = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    messages: [
      {
        role: 'user',
        content: `glow.js (GlowScript 3.2) 3D 코드 생성기. 설명을 코드로 변환하라.
반드시 코드만 출력. 설명/안내/질문 절대 금지. 마크다운/코드펜스 금지.
아무리 짧은 설명이라도 최선을 다해 코드로 변환하라.

API: sphere({pos:vec(x,y,z), radius:r, color:color.red})
사용 가능 도형: sphere, box({size:vec(w,h,d)}), cylinder({axis:vec()}), cone({axis:vec()}), arrow, ring({axis:vec(), thickness:t}), ellipsoid({size:vec()})

⚠ 색 표현 규칙 — 매우 중요:
- 정의된 color 상수만 사용 가능: color.red, color.blue, color.green, color.white, color.black, color.yellow, color.orange, color.cyan, color.magenta, color.purple
- color.brown / color.gray / color.pink / color.gold 같은 건 GlowScript에 없다 → 절대 사용 금지. ReferenceError가 난다.
- 그 외 색은 반드시 vec(r,g,b)로 표현 (r,g,b는 0~1). 예시:
  · 갈색 = vec(0.55, 0.27, 0.07)
  · 진한 갈색 = vec(0.4, 0.2, 0.05)
  · 회색 = vec(0.5, 0.5, 0.5)
  · 분홍 = vec(1, 0.6, 0.7)
  · 하늘색 = vec(0.5, 0.8, 1)
  · 살구색 = vec(1, 0.8, 0.6)

기타 규칙:
- scene/canvas 선언 불필요.
- 절대로 alert/prompt/confirm/print/console.log 호출하지 말 것.
- import / from / def 같은 Python 문법 금지. 순수 JavaScript만.

설명: ${prompt}`,
      },
    ],
  })
  return text.replace(/^```(?:javascript|js|python)?\n?/m, '').replace(/\n?```$/m, '').trim()
}

/**
 * 2차시 시각화 — 프롬프트 자기 점검용 평가 (Sonnet).
 * AI가 만든 코드가 목표 장면과 얼마나 비슷한지 0~100.
 */
export async function evaluateVisualPrompt({ prompt, generatedCode, targetCode }) {
  const { text } = await callClaude({
    model: 'claude-sonnet-4-6',
    maxTokens: 600,
    messages: [
      {
        role: 'user',
        content: `3D 장면 프롬프트 평가 — 고등학생 대상, 후하게 평가하라.
학생은 화면 왼쪽에 보이는 [목표 예시 그림]을 눈으로 본 뒤, AI에게 그 그림을 만들도록 [학생 프롬프트]를 작성한다.

⚠ 채점 철학 — 반드시 지켜라:
- 이 활동은 "AI에게 시각적 장면을 설명하는 연습"이다. 학생이 왼쪽 그림과 "비슷한 장면"을 만들었다면 90점 이상 줘라.
- 완벽함이 아니라 "핵심을 잡았는가"를 본다. 학생이 그림의 주요 객체·색·구성을 알아볼 수 있게 묘사했으면 후하게 90~100점.
- 작은 디테일 누락(미세한 위치 차이, 정확한 개수의 ±1~2 차이, 약간 다른 색조)은 감점 사유가 아니다.
- 명백히 다른 장면을 묘사한 경우(목표는 탁자 위 사과인데 프롬프트는 산과 나무)에만 60점 이하로 낮춰라.
- 짧고 간결한 프롬프트도 핵심을 짚었다면 만점에 가까울 수 있다. 길이로 점수 주지 말 것.

score 세부 기준 — 학생 프롬프트가 목표 그림의 다음 요소들을 얼마나 반영했는가:
- 객체 종류 (sphere/box/cylinder 등 또는 그것에 대응하는 한국어 표현 — "공", "상자", "기둥" 등 자연스러운 표현도 인정) → 40%
- 색상 (주요 색만 맞으면 OK, 정확한 색조까지 따지지 말 것) → 30%
- 객체 개수 / 반복 구조 (대략적으로 맞으면 OK, "여러 개", "줄지어" 같은 표현도 인정) → 20%
- 상대적 위치/배치 ("위에", "옆에", "둘러싸고" 같은 표현이면 충분) → 10%

❌ 절대 감점하지 말 것:
- 크기·비율 (학생은 화면에서 크기를 정밀하게 측정할 수 없으므로 채점 대상 아님)
- 좌표·수치 같은 절대값 (학생은 시각적으로만 보고 묘사하므로 요구하지 말 것)
- 도형 이름의 정확한 영어 표기 ("공"도 sphere로 인정, "타원"도 ellipsoid로 인정)

💯 점수 가이드라인 (이 기준대로 줘라):
- 95~100점: 목표 그림의 주요 객체·색·구성을 모두 자연스럽게 묘사
- 90~94점: 핵심 객체·색은 다 짚었지만 한두 가지 세부(배치 표현 등)가 약간 누락
- 80~89점: 핵심은 잡았지만 객체 하나가 빠지거나 색이 한두 개 틀림
- 70~79점: 절반 정도 묘사, 중요 요소 누락
- 60점 이하: 명백히 다른 장면을 묘사했거나 프롬프트가 거의 비어있음

⚠ 점수 일관성 규칙:
- ct_scores 4개 항목(추상화·패턴인식·분해·알고리즘)은 각각 0~25점.
- score(0~100)는 반드시 ct_scores 4개 항목의 합과 같아야 한다.
- 즉 score = abstract + pattern + decomp + algorithm.
- 위 점수 가이드라인에 맞춰 총점을 정한 뒤, 그 총점을 4개 ct 항목에 분배하라.
- 두 값이 어긋나면 안 된다.

[목표 코드 — 화면 왼쪽에 학생이 보고 묘사해야 하는 그림]
${targetCode}

[학생 프롬프트 — 이것이 위 목표 그림을 묘사하기에 적절한지 평가하라]
${prompt}

[AI가 생성한 코드 — 학생 프롬프트가 목표대로 작동했는지 확인하는 보조 자료]
${generatedCode}

JSON만 응답:
{"score":0~100,"ct_scores":{"abstract":0~25,"pattern":0~25,"decomp":0~25,"algorithm":0~25},"feedback":"2줄 피드백 — 학생 프롬프트가 목표 그림을 묘사하는 데 어떤 점이 좋았고 어떤 점이 부족한지","improvements":["프롬프트를 어떻게 고치면 목표 그림과 더 가까워질지"]}`,
      },
    ],
  })

  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('평가 JSON 파싱 실패')
  const parsed = JSON.parse(m[0])

  // score와 ct_scores 일관성 강제: score = ct 4개 항목 합 (0~100 클램프)
  const ct = parsed.ct_scores || {}
  const clamp = (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.min(25, Math.round(n)))
  }
  const abstract = clamp(ct.abstract)
  const pattern = clamp(ct.pattern)
  const decomp = clamp(ct.decomp)
  const algorithm = clamp(ct.algorithm)
  parsed.ct_scores = { abstract, pattern, decomp, algorithm }
  parsed.score = abstract + pattern + decomp + algorithm

  return parsed
}

/**
 * OpenAI gpt-image-2 호출 (3차시). base64 이미지 반환.
 */
export async function generateImage({ prompt, size = '1024x1024' }) {
  // quality: 'medium' + jpeg → 생성 ~15~30초 / 응답 0.5~1MB.
  // (quality:'auto'/'high'는 복잡한 프롬프트에서 1~2분 걸려 Vercel 60s 타임아웃)
  const res = await fetch(OPENAI_IMAGE_URL, {
    method: 'POST',
    headers: openaiHeaders(),
    body: JSON.stringify({
      prompt,
      size,
      n: 1,
      quality: 'medium',
      output_format: 'jpeg',
    }),
  })

  // Vercel 함수 타임아웃 등에서 plain-text 오류가 올 수 있어 안전하게 파싱
  const bodyText = await res.text()
  let raw
  try {
    raw = JSON.parse(bodyText)
  } catch {
    throw new Error(
      `이미지 생성 서버 오류 (HTTP ${res.status}): ${bodyText.slice(0, 200)}`,
    )
  }
  if (!res.ok) throw new Error(raw.error?.message || raw.error || 'OpenAI 호출 실패')

  const first = raw.data?.[0]
  if (first?.b64_json) return { b64: first.b64_json, raw }
  if (first?.url) return { url: first.url, raw }
  throw new Error('이미지 응답 형식을 알 수 없음')
}
