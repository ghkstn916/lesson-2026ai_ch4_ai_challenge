import { mockSearch } from '../data/tools-mock-search.js'

/**
 * Anthropic tool_use 응답을 받았을 때 클라이언트에서 실행하는 도구 4종.
 * 모두 동기 또는 빠른 비동기.
 *
 * 도구 시그니처:
 *   calc(expression): "12345 * 6789" 같은 수식 안전 평가
 *   search(query):    mock JSON DB 검색
 *   memo(action, key, value?):  in-memory 메모 (save/load/list/clear)
 *   date_diff(from, to): 두 날짜 간 일수 차이
 */

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
  if (name === 'calc') {
    return { result: evalExpression(input.expression) }
  }
  if (name === 'search') {
    return mockSearch(input.query)
  }
  if (name === 'memo') {
    return memoOp(input)
  }
  if (name === 'date_diff') {
    return dateDiff(input)
  }
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
    name: 'memo',
    description:
      '단계 간 정보 보관. action=save|load|list|clear. save/load에는 key가 필요. save에는 value도.',
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
]

export const TOOL_LABELS = {
  calc: { emoji: '🧮', label: '계산기' },
  search: { emoji: '🔎', label: '검색' },
  memo: { emoji: '🗒', label: '메모' },
  date_diff: { emoji: '📅', label: '날짜계산' },
}
