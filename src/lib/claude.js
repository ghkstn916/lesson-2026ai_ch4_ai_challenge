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
        content: `glow.js 3D 코드 생성기. 설명을 코드로 변환하라.
반드시 코드만 출력. 설명/안내/질문 절대 금지.
아무리 짧은 설명이라도 최선을 다해 코드로 변환하라.

API: sphere({pos:vec(x,y,z), radius:r, color:color.red})
vec(x,y,z), color.red/blue/green/white/black/yellow/orange/cyan/magenta
sphere, box({size:vec(w,h,d)}), cylinder({axis:vec()}), cone, arrow, pyramid, ring, ellipsoid
scene/canvas 선언 불필요.

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
        content: `3D 장면 프롬프트 평가. 학생은 3D 장면을 눈으로 보고 설명한다.

채점 기준 (시각적 유사도 중심):
- 객체 종류 일치 (sphere/box/cylinder 등) → 매우 중요 (30%)
- 색상 일치 → 중요 (25%)
- 객체 수 일치 → 중요 (20%)
- 상대적 위치/배치 → 보통 (15%)
- 상대적 크기 비율 → 보통 (10%)

감점하지 말 것: 절대 수치 차이 (좌표, 크기 등).

[목표 코드]
${targetCode}

[학생 프롬프트]
${prompt}

[AI가 생성한 코드]
${generatedCode}

JSON만 응답:
{"score":0~100,"ct_scores":{"abstract":0~25,"pattern":0~25,"decomp":0~25,"algorithm":0~25},"feedback":"2줄 피드백","improvements":["개선할 점"]}`,
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
