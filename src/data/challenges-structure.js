/**
 * 4차시 구조화 미션. PRD §3.4 A안 — 같은 정보가 형식에 따라 어떻게 다르게 표현되는지.
 * 데이터가 흘러감: Level 1 JSON → Level 2 SVG → Level 3 HTML 표
 */

export const STRUCTURE_CHALLENGES = [
  {
    id: 'structure-json',
    level: 1,
    emoji: '🧱',
    format: 'json',
    title: 'JSON 자기소개',
    description:
      '"정보를 칸칸이 정리한 메모지"로 자기소개를 표현해보자. 스키마는 자유롭게 확장 가능.',
    schemaDoc: `{
  "name": "string",
  "grade": "string (예: 3-5)",
  "interests": ["string", ...],
  "dream_career": "string",
  "one_line_motto": "string"
  // 추가 필드는 자유롭게 추가 가능
}`,
    requiredKeys: ['name', 'grade', 'interests', 'dream_career', 'one_line_motto'],
    hint: 'AI에게 "다음 정보를 JSON 한 덩어리로 출력해줘. 마크다운 없이." 같이 형식 제약을 명시하세요.',
  },
  {
    id: 'structure-svg',
    level: 2,
    emoji: '🎴',
    format: 'svg',
    title: 'SVG 자기소개 카드',
    description:
      'Level 1의 JSON 정보를 한 장의 SVG 카드(400×600)로. 같은 정보가 시각으로 변신.',
    requiredFeatures: ['<svg', 'width=', 'height='],
    minColors: 2,
    minTextLength: 30,
    hint: '필수: 이름·학년·진로·좌우명 텍스트, 도형 1개 이상, 색상 2종 이상. AI에게 "코드 펜스 없이 <svg> 태그만 출력" 지시.',
  },
  {
    id: 'structure-html',
    level: 3,
    emoji: '📅',
    format: 'html',
    title: 'HTML 표로 내 일주일',
    description:
      '내 한 주 시간표를 <table>로 정리하자. 과목·동아리·자습 시간 등.',
    requiredFeatures: ['<table', '</table', '<th', '<td'],
    hint: '월~일 또는 평일/주말 분류 자유. AI에게 "코드 펜스 없이 <table> ... </table>만 출력" 지시.',
  },
]

// 위험 태그 블랙리스트 (가벼운 sanitize — sanitize-html 같은 무거운 라이브러리 미사용, PRD §3.4)
const FORBIDDEN = /<\s*(script|iframe|object|embed|link|meta|style|form|input|button)|on\w+\s*=|javascript:/i

export function sanitizeOutput(s) {
  if (!s) return s
  return s.replace(FORBIDDEN, '<!-- 차단된 태그/속성 -->')
}

// ── 자동 검증 ────────────────────────────────────────────────────────────────
export function validateJSON(output, requiredKeys) {
  try {
    const parsed = JSON.parse(output)
    const missing = requiredKeys.filter((k) => !(k in parsed))
    return {
      parsed: true,
      hasAllKeys: missing.length === 0,
      missing,
      data: parsed,
    }
  } catch (e) {
    return { parsed: false, hasAllKeys: false, missing: requiredKeys, error: e.message }
  }
}

export function validateSVG(output, c) {
  const hasOpening = /<svg[\s>]/i.test(output)
  const hasClosing = /<\/svg>/i.test(output)
  const textMatch = output.match(/>([^<]+)</g) || []
  const textContent = textMatch.join('').replace(/[><]/g, '').trim()
  const colorMatches = output.match(/(?:fill|stroke|stop-color)\s*=\s*"([^"]+)"|#[0-9a-fA-F]{3,6}/g) || []
  const uniqueColors = new Set(colorMatches.map((c) => c.toLowerCase()))
  return {
    hasOpening,
    hasClosing,
    valid: hasOpening && hasClosing,
    textLength: textContent.length,
    hasEnoughText: textContent.length >= (c.minTextLength || 0),
    colorCount: uniqueColors.size,
    hasEnoughColors: uniqueColors.size >= (c.minColors || 0),
  }
}

export function validateHTML(output) {
  const features = ['<table', '</table', '<th', '<td']
  const checks = Object.fromEntries(
    features.map((f) => [f, new RegExp(f, 'i').test(output)])
  )
  return {
    ...checks,
    valid: Object.values(checks).every((v) => v),
  }
}

// ── 친절한 에러 메시지 (PRD §3.4) ────────────────────────────────────────────
export function humanizeError(err) {
  const m = err.match(/position (\d+)/)
  if (m) return `${m[1]}번째 글자 근처에서 문법 오류 — 쉼표나 따옴표가 빠졌을 수 있어요.`
  if (/unexpected token/i.test(err)) return '예상치 못한 문자가 있어요. 중괄호·대괄호·따옴표가 짝이 맞는지 확인하세요.'
  return err
}
