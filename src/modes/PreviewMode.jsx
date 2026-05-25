import { Link } from 'react-router-dom'
import StudentLayout from '../components/StudentLayout.jsx'
import { MODE_BY_KEY } from '../data/modes.js'
import { PREVIEWS } from '../data/challenges-future.js'

/**
 * 3~8차시 공통 스캐폴드 — 모드 키로 PREVIEWS 조회.
 * 실제 챌린지 구현이 도착하면 mode 파일을 따로 만들어 교체.
 */
export default function PreviewMode({ modeKey }) {
  const meta = MODE_BY_KEY[modeKey]
  const preview = PREVIEWS[modeKey] || {}
  const needKey = meta.needsKey || 'anthropic'

  return (
    <StudentLayout needKey={needKey} title={`${meta.sessionNumber}차시 ${meta.title}`}>
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="muted small">{meta.sessionNumber}차시 — {meta.emoji} {meta.title}</p>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4 }}>
          🚧 이 차시는 준비 중입니다
        </h1>
        <p className="muted" style={{ marginTop: 8 }}>{meta.summary}</p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
          📌 학습 목표
        </h2>
        <p>{preview.goal}</p>

        {preview.tools && (
          <>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
              사용할 도구
            </h3>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {preview.tools.map((t) => (
                <span key={t} className="tag" style={{ padding: '4px 10px', fontSize: '0.9rem' }}>
                  {t}
                </span>
              ))}
            </div>
          </>
        )}

        {preview.challenges && (
          <>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
              예정된 챌린지
            </h3>
            <div className="col" style={{ gap: 8 }}>
              {preview.challenges.map((c, i) => (
                <div key={i} className="attempt">
                  <span className="tag">Level {c.level}</span>
                  <strong style={{ marginLeft: 6 }}>{c.title}</strong>
                  <div className="muted small" style={{ marginTop: 4 }}>{c.detail}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {preview.sections && (
          <>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
              50분 흐름
            </h3>
            <ul style={{ paddingLeft: 18, lineHeight: 1.8 }}>
              {preview.sections.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </>
        )}

        {preview.note && (
          <p className="muted small" style={{ marginTop: 14 }}>📝 {preview.note}</p>
        )}

        <p className="muted small" style={{ marginTop: 20 }}>
          이 차시는 다음 세션에서 추가됩니다. 지금은 <Link to="/student">홈</Link>에서{' '}
          <strong>1차시 워밍업</strong>이나 <strong>2차시 시각화</strong>를 진행해보세요.
        </p>
      </div>
    </StudentLayout>
  )
}
