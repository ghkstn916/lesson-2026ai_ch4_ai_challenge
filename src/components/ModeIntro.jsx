import { useState } from 'react'
import { INTROS } from '../data/intros.js'
import { MODE_BY_KEY } from '../data/modes.js'

/**
 * 각 모드 페이지 상단에 노출되는 학생용 인트로.
 * 처음에는 펼친 상태로 시작하고, "접기"로 숨길 수 있다.
 */
export default function ModeIntro({ modeKey }) {
  const intro = INTROS[modeKey]
  const meta = MODE_BY_KEY[modeKey]
  const [open, setOpen] = useState(true)

  if (!intro) return null

  return (
    <div
      className="card"
      style={{
        marginBottom: 16,
        borderLeft: '4px solid var(--accent)',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <p className="muted small">
          {meta.sessionNumber}차시 — {meta.emoji} {meta.title}
        </p>
        <button
          className="btn btn-ghost"
          onClick={() => setOpen(!open)}
          style={{ fontSize: '0.9rem', padding: '2px 8px' }}
        >
          {open ? '접기 ▲' : '펼치기 ▼'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{intro.headline}</h2>

      {open && (
        <>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 14, color: 'var(--text-muted)' }}>
            🎯 오늘의 목표
          </h3>
          <ul style={{ paddingLeft: 18, lineHeight: 1.7, marginTop: 4 }}>
            {intro.goals.map((g, i) => (
              <li key={i} style={{ fontSize: '0.92rem' }}>{g}</li>
            ))}
          </ul>

          <div
            className="row"
            style={{
              marginTop: 12,
              padding: '10px 12px',
              background: 'var(--bg)',
              borderRadius: 'var(--radius)',
              fontSize: '0.88rem',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span className="muted">⏱ 흐름:</span>
            <span>{intro.flow}</span>
          </div>

          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: 'var(--radius)',
              fontSize: '0.88rem',
              color: 'var(--accent-hover)',
            }}
          >
            🔑 <strong>오늘 들고 갈 한 가지</strong> — {intro.key}
          </div>
        </>
      )}
    </div>
  )
}
