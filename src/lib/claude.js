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
학생은 [목표 예시 그림]을 눈으로 보고, AI에게 설명해서 그 그림과 비슷한 장면을 만들려고 한다.

⚠ score(0~100) 채점 원칙 — 반드시 지켜라:
- score는 오직 [목표 코드]가 그리는 장면과 [AI가 생성한 코드]가 그리는 장면의 시각적 유사도만으로 결정한다.
- [학생 프롬프트]의 문장이 길고 구체적이고 잘 쓰여 있어도, 생성된 코드가 목표와 안 비슷하면 점수는 낮다.
- 반대로 학생 프롬프트가 짧고 단순해도 생성된 코드가 목표와 충분히 비슷하면 점수는 높다.
- "잘 쓴 프롬프트인지"가 아니라 "결과가 예시 그림처럼 보이는지"만 본다.
- 두 코드가 그릴 장면이 시각적으로 거의 다르면 score는 30점 이하로 낮춰라.

score 채점 기준 (목표 그림과의 시각적 유사도):
- 객체 종류 일치 (sphere/box/cylinder 등) → 매우 중요 (30%)
- 색상 일치 → 중요 (25%)
- 객체 수 일치 → 중요 (20%)
- 상대적 위치/배치 → 보통 (15%)
- 상대적 크기 비율 → 보통 (10%)

감점하지 말 것: 절대 수치 차이 (좌표·크기 절댓값 등). 예시 그림과 "비슷하게" 보이면 충분.

ct_scores는 학생 프롬프트의 사고 과정을 보고 매겨도 된다(분해·패턴·추상화·알고리즘).
단, score는 위 원칙에 따라 코드 비교로만 결정.

[목표 코드 — 학생이 보고 묘사한 그림]
${targetCode}

[학생 프롬프트 — score에 영향 주지 말 것]
${prompt}

[AI가 생성한 코드 — 이것과 위 목표 코드의 유사도로 score 결정]
${generatedCode}

JSON만 응답:
{"score":0~100,"ct_scores":{"abstract":0~25,"pattern":0~25,"decomp":0~25,"algorithm":0~25},"feedback":"2줄 피드백 — 목표 그림과 어떤 점이 같고 어떤 점이 다른지","improvements":["개선할 점"]}`,
      },
    ],
  })

  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('평가 JSON 파싱 실패')
  return JSON.parse(m[0])
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
