import { useState } from 'react'

/**
 * 2차시 시각화 도입 — 컴퓨팅 사고력(CT) 4요소 설명.
 * 학생이 본격 챌린지를 풀기 전에 "오늘 무엇을 훈련하는지" 한눈에.
 */
const ELEMENTS = [
  {
    key: 'decomp',
    emoji: '🧩',
    title: '분해 (Decomposition)',
    color: '#4338ca',
    summary: '복잡한 사물·문제를 작은 부품으로 쪼개기',
    example: '"탁자 위 사과" → 상판(상자) + 다리 4개(원기둥) + 사과(구)',
    inPrompt: '큰 그림을 먼저 부품 단위로 나눠 설명해야 AI가 정확히 만든다.',
  },
  {
    key: 'pattern',
    emoji: '🔁',
    title: '패턴 인식 (Pattern Recognition)',
    color: '#047857',
    summary: '반복되는 규칙·구조를 찾아내기',
    example: '"원형 울타리" → 기둥 12개가 30도씩 회전하며 반복',
    inPrompt: '"같은 것이 N번 반복", "일정 간격으로 배치" 같은 규칙을 명시하라.',
  },
  {
    key: 'abstract',
    emoji: '✨',
    title: '추상화 (Abstraction)',
    color: '#b45309',
    summary: '핵심 특징만 남기고 단순화하기',
    example: '"모래시계" → 모래·유리 디테일 빼고 원뿔 2개 + 작은 구',
    inPrompt: '눈에 보이는 디테일 중 무엇이 본질인지 추려내라.',
  },
  {
    key: 'algorithm',
    emoji: '🪜',
    title: '알고리즘 (Algorithm)',
    color: '#9333ea',
    summary: '반복·규칙을 단계적 절차로 표현',
    example: '"계단 6칸" → i를 0~5까지 반복하며 (i*1.2, i*0.6) 좌표에 블록 놓기',
    inPrompt: '"왼쪽 아래부터 시작해 1칸씩 위·오른쪽으로" 같은 순서를 묘사하라.',
  },
]

export default function CTOverview() {
  const [open, setOpen] = useState(true)
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--success)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
          🧠 오늘의 핵심 — 컴퓨팅 사고력(CT) 4요소
        </h2>
        <button
          className="btn btn-ghost"
          onClick={() => setOpen(!open)}
          style={{ fontSize: '0.8rem', padding: '2px 8px' }}
        >
          {open ? '접기 ▲' : '펼치기 ▼'}
        </button>
      </div>
      <p className="muted small" style={{ marginTop: 4 }}>
        말로 3D 장면을 만든다는 건 결국 사물을 4가지 방식으로 다시 쪼개보는 일.
        오늘 챌린지는 이 4요소가 프롬프트에 얼마나 잘 녹았는지로 평가됩니다.
      </p>

      {open && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginTop: 14,
          }}
        >
          {ELEMENTS.map((e) => (
            <div
              key={e.key}
              style={{
                background: 'var(--bg)',
                borderLeft: `3px solid ${e.color}`,
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                <span style={{ fontSize: '1.1rem', marginRight: 4 }}>{e.emoji}</span>
                {e.title}
              </div>
              <div className="muted small" style={{ marginTop: 4, fontSize: '0.82rem' }}>
                {e.summary}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: '0.78rem',
                  padding: '6px 8px',
                  background: 'var(--surface2)',
                  borderRadius: 4,
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: e.color }}>예) </strong>{e.example}
              </div>
              <div className="muted small" style={{ marginTop: 6, fontSize: '0.78rem' }}>
                💡 {e.inPrompt}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
