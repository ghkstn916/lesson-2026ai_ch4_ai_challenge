import { mockSearch } from '../data/tools-mock-search.js'

/**
 * Anthropic tool_use 응답을 받았을 때 클라이언트에서 실행하는 도구들.
 * 모두 동기 또는 빠른 비동기. (외부 네트워크 없음 — 전부 로컬/모의)
 *
 * 도구 시그니처:
 *   calc(expression)            : "12345 * 6789" 같은 수식 안전 평가
 *   stats(numbers)              : 숫자 목록의 평균·중앙값·표준편차·최소·최대·합
 *   search(query)               : mock JSON DB 검색 (입시·학교·진로)
 *   unit_convert(value,from,to) : 길이·무게·시간·온도 단위 변환
 *   date_diff(from,to)          : 두 날짜 간 일수/주수 차이
 *   weekday(date?)              : 특정 날짜의 요일 (생략 시 오늘)
 *   string_count(text)          : 글자수(공백 포함/제외)·단어수·줄수
 *   random_pick(items|min,max)  : 목록에서 무작위 추첨 또는 범위 난수
 *   memo(action,key,value?)     : in-memory 메모 (save/load/list/clear)
 */

const round4 = (x) => Math.round(x * 1e4) / 1e4

// ── 안전한 수식 평가 ────────────────────────────────────────────────────────
// Function/eval 미사용. 숫자·연산자·괄호·소수점만 허용.
function evalExpression(expr) {
  if (typeof expr !== 'string') throw new Error('expression must be a string')
  const cleaned = expr.replace(/\s+/g, '')
  if (!/^[0-9+\-*/().%]+$/.test(cleaned)) {
    throw new Error('허용되지 않은 문자가 포함됨 (숫자와 + - * / ( ) % 만 허용)')
  }
  // Shunting-yard 간단 평가
  const tokens = cleaned.match(/(\d+(?:\.\d+)?|[+\-*/()%])/g)
  if (!tokens) throw new Error('빈 수식')

  // 표준 라이브러리에 안전한 evaluator가 없으니, 한정된 문자열만 허용한 뒤
  // 기준 우선순위로 직접 계산 — function 생성자도 미사용.
  const out = []
  const ops = []
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 }
  let prevType = null
  for (const t of tokens) {
    if (/^\d/.test(t)) {
      out.push(parseFloat(t))
      prevType = 'num'
    } else if (t === '(') {
      ops.push(t)
      prevType = 'op'
    } else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop())
      if (!ops.length) throw new Error('괄호 짝이 맞지 않음')
      ops.pop()
      prevType = 'num'
    } else {
      // unary minus: 토큰 -가 식의 시작 또는 (op 직후일 때
      if (t === '-' && prevType !== 'num') {
        out.push(0)
      }
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[t]) {
        out.push(ops.pop())
      }
      ops.push(t)
      prevType = 'op'
    }
  }
  while (ops.length) {
    const o = ops.pop()
    if (o === '(') throw new Error('괄호 짝이 맞지 않음')
    out.push(o)
  }
  // RPN 평가
  const stack = []
  for (const t of out) {
    if (typeof t === 'number') stack.push(t)
    else {
      const b = stack.pop()
      const a = stack.pop()
      if (a === undefined || b === undefined) throw new Error('연산자 위치 오류')
      let r
      if (t === '+') r = a + b
      else if (t === '-') r = a - b
      else if (t === '*') r = a * b
      else if (t === '/') {
        if (b === 0) throw new Error('0으로 나눔')
        r = a / b
      } else if (t === '%') r = a % b
      stack.push(r)
    }
  }
  if (stack.length !== 1) throw new Error('수식 평가 실패')
  return stack[0]
}

// ── 기초 통계 ────────────────────────────────────────────────────────────────
function computeStats({ numbers }) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new Error('numbers는 비어 있지 않은 숫자 배열이어야 함')
  }
  const nums = numbers.map(Number)
  if (nums.some((n) => Number.isNaN(n))) throw new Error('numbers에 숫자가 아닌 값이 있음')
  const n = nums.length
  const sum = nums.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const sorted = [...nums].sort((a, b) => a - b)
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return {
    count: n,
    sum: round4(sum),
    mean: round4(mean),
    median: round4(median),
    min: sorted[0],
    max: sorted[n - 1],
    stdev: round4(Math.sqrt(variance)), // 모표준편차
  }
}

// ── 단위 변환 ────────────────────────────────────────────────────────────────
const UNIT_FACTORS = {
  length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048, mile: 1609.344 },
  mass: { mg: 0.001, g: 1, kg: 1000, t: 1e6, lb: 453.59237, oz: 28.349523 },
  time: { s: 1, sec: 1, min: 60, h: 3600, hour: 3600, day: 86400 },
}
function normUnit(u) {
  const s = String(u).trim().toLowerCase()
  const map = {
    '°c': 'c', '℃': 'c', celsius: 'c', '섭씨': 'c',
    '°f': 'f', '℉': 'f', fahrenheit: 'f', '화씨': 'f',
    k: 'k', kelvin: 'k',
    meter: 'm', metre: 'm', 미터: 'm', kilometer: 'km', 킬로미터: 'km',
    centimeter: 'cm', 센티미터: 'cm', millimeter: 'mm', 인치: 'inch', 마일: 'mile',
    gram: 'g', 그램: 'g', kilogram: 'kg', 킬로그램: 'kg', pound: 'lb', 파운드: 'lb', 온스: 'oz',
    second: 's', 초: 's', minute: 'min', 분: 'min', hour: 'hour', 시간: 'hour', day: 'day', 일: 'day',
  }
  return map[s] || s
}
function unitConvert({ value, from, to }) {
  const v = Number(value)
  if (Number.isNaN(v)) throw new Error('value는 숫자여야 함')
  const f = normUnit(from)
  const t = normUnit(to)
  const temps = ['c', 'f', 'k']
  if (temps.includes(f) || temps.includes(t)) {
    if (!temps.includes(f) || !temps.includes(t)) {
      throw new Error('온도는 온도끼리만 변환 가능 (c / f / k)')
    }
    const c = f === 'c' ? v : f === 'f' ? ((v - 32) * 5) / 9 : v - 273.15
    const r = t === 'c' ? c : t === 'f' ? (c * 9) / 5 + 32 : c + 273.15
    return { value: v, from: f, to: t, category: 'temperature', result: round4(r) }
  }
  for (const cat of Object.keys(UNIT_FACTORS)) {
    const table = UNIT_FACTORS[cat]
    if (f in table && t in table) {
      return { value: v, from: f, to: t, category: cat, result: round4((v * table[f]) / table[t]) }
    }
  }
  throw new Error(`지원하지 않거나 서로 다른 분류의 단위입니다: ${from} → ${to}`)
}

// ── 요일 찾기 (date 생략 시 오늘) ──────────────────────────────────────────────
function weekdayOf({ date }) {
  let d
  if (date) {
    const m = String(date).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (!m) throw new Error('date는 YYYY-MM-DD 형식이어야 함')
    d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  } else {
    d = new Date()
  }
  if (Number.isNaN(d.getTime())) throw new Error('잘못된 날짜')
  const names = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return { date: `${yyyy}-${mm}-${dd}`, weekday: names[d.getDay()], isToday: !date }
}

// ── 글자수 세기 ────────────────────────────────────────────────────────────────
function stringCount({ text }) {
  if (typeof text !== 'string') throw new Error('text는 문자열이어야 함')
  const words = (text.trim().match(/\S+/g) || []).length
  return {
    chars: text.length,
    charsNoSpace: text.replace(/\s/g, '').length,
    words,
    lines: text === '' ? 0 : text.split(/\n/).length,
  }
}

// ── 무작위 추첨 / 난수 ─────────────────────────────────────────────────────────
function randomPick({ items, count, min, max }) {
  if (Array.isArray(items) && items.length > 0) {
    const c = Math.max(1, Math.min(Number(count) || 1, items.length))
    const pool = [...items]
    const picked = []
    for (let i = 0; i < c; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      picked.push(pool.splice(idx, 1)[0])
    }
    return { picked, from: items.length }
  }
  if (min != null && max != null) {
    const lo = Math.ceil(Number(min))
    const hi = Math.floor(Number(max))
    if (Number.isNaN(lo) || Number.isNaN(hi) || lo > hi) throw new Error('min ≤ max 인 숫자가 필요')
    return { picked: Math.floor(Math.random() * (hi - lo + 1)) + lo, range: [lo, hi] }
  }
  throw new Error('items 배열(과 선택적 count) 또는 min·max가 필요')
}

// ── 메모 (in-memory, 세션 내에서만 유지) ────────────────────────────────────
const memoStore = new Map()

function memoOp({ action, key, value }) {
  if (!['save', 'load', 'list', 'clear'].includes(action)) {
    throw new Error('action must be save|load|list|clear')
  }
  if (action === 'save') {
    if (!key) throw new Error('save에는 key가 필요')
    memoStore.set(key, value)
    return { ok: true, saved: { key, value } }
  }
  if (action === 'load') {
    if (!key) throw new Error('load에는 key가 필요')
    return { ok: true, value: memoStore.get(key) ?? null, found: memoStore.has(key) }
  }
  if (action === 'list') {
    return { ok: true, keys: Array.from(memoStore.keys()), count: memoStore.size }
  }
  if (action === 'clear') {
    memoStore.clear()
    return { ok: true, cleared: true }
  }
}

// ── 날짜 차이 ────────────────────────────────────────────────────────────────
function dateDiff({ from, to }) {
  const a = new Date(from)
  const b = new Date(to)
  if (isNaN(a) || isNaN(b)) throw new Error('from/to는 YYYY-MM-DD 형식')
  const ms = b.getTime() - a.getTime()
  const days = Math.round(ms / 86400000)
  return {
    from,
    to,
    days,
    direction: days >= 0 ? 'future' : 'past',
    weeks: Math.floor(Math.abs(days) / 7),
  }
}

// ── 통합 디스패치 ───────────────────────────────────────────────────────────
export function executeTool(name, input) {
  if (name === 'calc') return { result: evalExpression(input.expression) }
  if (name === 'stats') return computeStats(input)
  if (name === 'search') return mockSearch(input.query)
  if (name === 'unit_convert') return unitConvert(input)
  if (name === 'date_diff') return dateDiff(input)
  if (name === 'weekday') return weekdayOf(input)
  if (name === 'string_count') return stringCount(input)
  if (name === 'random_pick') return randomPick(input)
  if (name === 'memo') return memoOp(input)
  throw new Error(`알 수 없는 도구: ${name}`)
}

export function resetMemo() {
  memoStore.clear()
}

// ── Anthropic API에 전달할 tools 정의 ────────────────────────────────────
export const TOOLS_SPEC = [
  {
    name: 'calc',
    description:
      '안전한 산술 계산. 숫자와 + - * / ( ) % 연산자만 가능. 예: "12345 * 6789", "(3 + 5) / 2".',
    input_schema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: '평가할 수식' },
      },
      required: ['expression'],
    },
  },
  {
    name: 'stats',
    description:
      '숫자 목록의 기초 통계를 한 번에 계산. 평균(mean)·중앙값(median)·표준편차(stdev, 모표준편차)·최솟값·최댓값·합계·개수. 예: 모의고사 여러 과목 점수.',
    input_schema: {
      type: 'object',
      properties: {
        numbers: { type: 'array', items: { type: 'number' }, description: '숫자 배열' },
      },
      required: ['numbers'],
    },
  },
  {
    name: 'search',
    description:
      '한국 입시·고등학교·진로 정보를 mock DB에서 검색. 결과가 없을 수 있음 — 그때는 절대 만들어내지 말 것.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '한국어 검색어' },
      },
      required: ['query'],
    },
  },
  {
    name: 'unit_convert',
    description:
      '단위 변환. 같은 분류 안에서만 변환한다. 길이(mm,cm,m,km,inch,ft,mile)·무게(mg,g,kg,t,lb,oz)·시간(s,min,hour,day)·온도(c,f,k). 예: 175 cm → m, 70 kg → lb, 36.5 c → f.',
    input_schema: {
      type: 'object',
      properties: {
        value: { type: 'number', description: '변환할 값' },
        from: { type: 'string', description: '원래 단위 (예: cm)' },
        to: { type: 'string', description: '바꿀 단위 (예: m)' },
      },
      required: ['value', 'from', 'to'],
    },
  },
  {
    name: 'date_diff',
    description: '두 날짜의 일수 차이를 계산. YYYY-MM-DD 형식. 음수면 to가 from보다 과거.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'weekday',
    description:
      '특정 날짜의 요일을 알려준다. date(YYYY-MM-DD)를 주면 그 날의 요일, 생략하면 오늘 날짜와 요일을 반환. (AI는 요일을 헷갈리므로 이 도구를 쓸 것)',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD (생략 시 오늘)' },
      },
    },
  },
  {
    name: 'string_count',
    description:
      '문자열의 글자 수(공백 포함 chars / 공백 제외 charsNoSpace)·단어 수·줄 수를 센다. 자기소개서·답변 글자수 제한 확인 등에 사용.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '셀 문자열' },
      },
      required: ['text'],
    },
  },
  {
    name: 'random_pick',
    description:
      '무작위 선택. items 배열을 주면 그 중 count개(기본 1)를 무작위로 뽑고, min·max를 주면 그 범위의 정수 난수를 만든다. 발표자·자리 추첨, 주사위 등.',
    input_schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' }, description: '뽑을 후보 목록' },
        count: { type: 'number', description: '뽑을 개수 (기본 1)' },
        min: { type: 'number', description: '난수 최솟값' },
        max: { type: 'number', description: '난수 최댓값' },
      },
    },
  },
  {
    name: 'memo',
    description:
      '단계 간 정보 보관. action=save|load|list|clear. save/load에는 key가 필요. save에는 value도. 여러 도구를 이어 쓸 때 중간 결과를 저장.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['save', 'load', 'list', 'clear'] },
        key: { type: 'string' },
        value: {},
      },
      required: ['action'],
    },
  },
]

export const TOOL_LABELS = {
  calc: {
    emoji: '🧮',
    label: '계산기',
    desc: '복잡한 사칙연산을 정확히 계산. + − × ÷ 와 괄호·나머지(%)까지. AI가 암산으로 틀리지 않게.',
  },
  stats: {
    emoji: '📊',
    label: '통계',
    desc: '숫자 여러 개의 평균·중앙값·표준편차·최댓값·최솟값·합계를 한 번에. 모의고사 점수 분석에 딱.',
  },
  search: {
    emoji: '🔎',
    label: '검색',
    desc: '입시·학교·진로 정보를 모의 DB에서 검색. 없으면 빈 결과 → AI가 지어내면 안 됨(환각 점검).',
  },
  unit_convert: {
    emoji: '📏',
    label: '단위변환',
    desc: '길이·무게·온도·시간 단위를 서로 변환. 예: cm↔m, kg↔lb, ℃↔℉, 시간↔분.',
  },
  date_diff: {
    emoji: '📅',
    label: '날짜계산',
    desc: '두 날짜 사이의 일수·주수를 계산. 수능 D-day 같은 기간 계산에 사용.',
  },
  weekday: {
    emoji: '📆',
    label: '요일찾기',
    desc: '특정 날짜가 무슨 요일인지(또는 오늘 날짜·요일)를 알려줌. AI가 헷갈리는 요일 계산을 대신.',
  },
  string_count: {
    emoji: '🔤',
    label: '글자수',
    desc: '문장의 글자 수(공백 포함/제외)·단어 수·줄 수를 셈. 자기소개서 글자수 제한 확인에 유용.',
  },
  random_pick: {
    emoji: '🎲',
    label: '랜덤뽑기',
    desc: '목록에서 무작위로 뽑거나 정해진 범위의 난수를 생성. 발표자·자리 추첨 등.',
  },
  memo: {
    emoji: '🗒',
    label: '메모',
    desc: '단계 사이에 값을 임시로 저장/불러오기(save·load·list·clear). 여러 도구를 이어 쓸 때 중간 결과 보관.',
  },
}
