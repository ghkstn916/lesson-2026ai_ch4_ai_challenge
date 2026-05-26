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
        content: `3D 장면 프롬프트 평가.
학생은 화면 왼쪽에 보이는 [목표 예시 그림]을 눈으로 본 뒤, AI에게 그 그림을 만들도록 [학생 프롬프트]를 작성한다.

⚠ score(0~100) 채점 원칙 — 반드시 지켜라:
- score는 "학생 프롬프트가 왼쪽 목표 그림을 그리기 위한 프롬프트로 얼마나 적절한가"로 결정한다.
- 단순히 길고 화려한 프롬프트라고 점수를 주지 말 것. "목표 그림을 그리기 위한 프롬프트"로서 좋아야 한다.
- 학생 프롬프트가 목표 그림과 관계 없는 다른 장면(예: 목표는 탁자 위 사과인데 프롬프트는 산과 나무)을 묘사하면 score는 20점 이하.
- 학생 프롬프트가 짧아도 목표 그림의 핵심 요소(객체 종류·색·개수·배치)를 정확히 짚으면 점수는 높을 수 있다.
- [AI가 생성한 코드]는 학생 프롬프트가 의도대로 작동했는지 확인하는 보조 자료. 코드 결과가 목표와 다르면, 프롬프트가 모호하거나 정보가 부족했다는 신호 → 그 부분을 감점하는 근거로 사용.

score 세부 기준 — 학생 프롬프트가 목표 그림의 다음 요소들을 얼마나 정확히 짚었는가:
- 객체 종류 (sphere/box/cylinder 등 또는 그것에 대응하는 한국어 표현) → 30%
- 색상 → 25%
- 객체 수 → 20%
- 상대적 위치/배치 → 15%
- 상대적 크기 비율 → 10%

감점하지 말 것: 절대 수치(좌표·크기 절댓값 등). 학생이 "탁자 다리 4개", "위에 빨간 사과 하나" 처럼 상대적·시각적 표현을 쓰면 충분.

⚠ 점수 일관성 규칙 (중요):
- ct_scores 4개 항목(추상화·패턴인식·분해·알고리즘)은 각각 0~25점.
- score(0~100)는 반드시 ct_scores 4개 항목의 합과 같아야 한다.
- 즉 score = abstract + pattern + decomp + algorithm.
- ct_scores를 위 5가지 세부 기준(객체·색·수·위치·크기)이 프롬프트에 얼마나 잘 반영됐는지로 매기고, 그 합을 그대로 score에 넣어라.
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
  const res = await fetch(OPENAI_IMAGE_URL, {
    method: 'POST',
    headers: openaiHeaders(),
    body: JSON.stringify({ prompt, size, n: 1 }),
  })
  const raw = await res.json()
  if (!res.ok) throw new Error(raw.error?.message || raw.error || 'OpenAI 호출 실패')

  const first = raw.data?.[0]
  if (first?.b64_json) return { b64: first.b64_json, raw }
  if (first?.url) return { url: first.url, raw }
  throw new Error('이미지 응답 형식을 알 수 없음')
}
