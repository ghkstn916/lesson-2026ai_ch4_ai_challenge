import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchAllAttemptsForTeacher,
  setTeacherHidden,
  setTeacherScore,
} from '../lib/supabase.js'
import { MODES } from '../data/modes.js'
import { challengeMeta, challengeIdsForMode } from '../data/challenges-index.js'

const SESSION_KEY = 'ai8-admin-auth'

export default function TeacherDashboard() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />
  return (
    <Dashboard
      onLogout={() => {
        sessionStorage.removeItem(SESSION_KEY)
        setAuthed(false)
      }}
    />
  )
}

function PasswordGate({ onAuth }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (pw === import.meta.env.VITE_ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onAuth()
    } else setErr('비밀번호가 다릅니다.')
  }
  return (
    <div className="container">
      <form onSubmit={submit} className="card form" style={{ maxWidth: 360, margin: '60px auto' }}>
        <h2 style={{ fontWeight: 700, marginBottom: 10 }}>🔒 교사용 대시보드</h2>
        <label className="field">
          <span>비밀번호</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        {err && <p className="error">{err}</p>}
        <button type="submit" className="btn btn-primary">로그인</button>
      </form>
    </div>
  )
}

function Dashboard({ onLogout }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modeFilter, setModeFilter] = useState('all')
  const [lastLoadedAt, setLastLoadedAt] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchAllAttemptsForTeacher()
      setItems(data)
      setLastLoadedAt(new Date())
    } catch (e) {
      alert(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered =
    modeFilter === 'all' ? items : items.filter((i) => i.mode === modeFilter)

  // 학생별 통계
  const studentMap = {}
  for (const a of items) {
    const sid = a.student?.id
    if (!sid) continue
    if (!studentMap[sid]) {
      studentMap[sid] = {
        name: a.student.name,
        number: a.student.student_number,
        modes: new Set(),
        total: 0,
      }
    }
    studentMap[sid].total++
    studentMap[sid].modes.add(a.mode)
  }
  const students = Object.values(studentMap).sort((a, b) =>
    a.number.localeCompare(b.number)
  )

  return (
    <>
      <header className="header">
        <Link to="/student" className="brand" style={{ color: 'var(--text)' }}>
          🎓 AI 챌린지
        </Link>
        <span className="muted small">/ 교사 대시보드</span>
        <span className="spacer" />
        {lastLoadedAt && (
          <span className="muted small">갱신 {lastLoadedAt.toLocaleTimeString()}</span>
        )}
        <button className="btn btn-ghost" onClick={load} style={{ fontSize: '0.95rem' }}>
          🔄 새로고침
        </button>
        <button className="btn btn-ghost" onClick={onLogout} style={{ fontSize: '0.95rem' }}>
          로그아웃
        </button>
      </header>

      <main className="container">
        <div className="row" style={{ gap: 10, marginBottom: 16 }}>
          <SummaryCard label="총 학생 수" value={students.length} />
          <SummaryCard label="총 시도" value={items.length} />
          <SummaryCard
            label="🔒 비공개 편지"
            value={items.filter((i) => i.is_public === false || i.self_check?.privateLetter).length}
            color="var(--warning)"
          />
          <SummaryCard label="가린 항목" value={items.filter((i) => i.hidden_by_teacher).length} />
          <SummaryCard
            label="교사 채점됨"
            value={items.filter((i) => i.teacher_score != null).length}
          />
        </div>

        <div className="card-sm" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            className="btn"
            onClick={() => setModeFilter('all')}
            style={{
              padding: '4px 10px',
              fontSize: '0.95rem',
              background: modeFilter === 'all' ? 'var(--accent)' : 'var(--surface2)',
              borderColor: modeFilter === 'all' ? 'var(--accent)' : 'var(--border)',
              color: modeFilter === 'all' ? 'white' : 'var(--text)',
            }}
          >
            전체
          </button>
          {MODES.map((m) => (
            <button
              key={m.key}
              className="btn"
              onClick={() => setModeFilter(m.key)}
              style={{
                padding: '4px 10px',
                fontSize: '0.95rem',
                background: modeFilter === m.key ? 'var(--accent)' : 'var(--surface2)',
                borderColor: modeFilter === m.key ? 'var(--accent)' : 'var(--border)',
                color: modeFilter === m.key ? 'white' : 'var(--text)',
              }}
            >
              {m.sessionNumber}차시 {m.title}
            </button>
          ))}
        </div>

        {loading && <p className="muted">불러오는 중...</p>}
        {!loading && filtered.length === 0 && <p className="muted">데이터가 없습니다.</p>}

        <ChallengeGroupedView
          items={filtered}
          modeFilter={modeFilter}
          onChange={load}
        />
      </main>
    </>
  )
}

// ── 차시·미션별 그룹화 뷰 ────────────────────────────────────────────────
function ChallengeGroupedView({ items, modeFilter, onChange }) {
  const [openKey, setOpenKey] = useState({}) // {`${mode}::${cid}`: true|false}

  // 모드별·챌린지별 group by
  const grouped = useMemo(() => {
    // 두 계층: mode -> challenge_id -> attempts[]
    const byMode = new Map()
    for (const a of items) {
      if (!byMode.has(a.mode)) byMode.set(a.mode, new Map())
      const mMap = byMode.get(a.mode)
      const cid = a.challenge_id || '(기타)'
      if (!mMap.has(cid)) mMap.set(cid, [])
      mMap.get(cid).push(a)
    }
    // 모드는 MODES 정의 순서대로
    const modeList = []
    for (const m of MODES) {
      if (byMode.has(m.key)) {
        const cMap = byMode.get(m.key)
        const orderedIds = challengeIdsForMode(m.key)
        const groups = []
        for (const cid of orderedIds) {
          if (cMap.has(cid)) {
            groups.push([cid, cMap.get(cid)])
            cMap.delete(cid)
          }
        }
        for (const [cid, arr] of cMap) groups.push([cid, arr])
        modeList.push({ mode: m, groups })
        byMode.delete(m.key)
      }
    }
    // 정의에 없는 mode (이론상 없음)
    for (const [modeKey, cMap] of byMode) {
      modeList.push({
        mode: { key: modeKey, sessionNumber: '?', title: modeKey, emoji: '📁' },
        groups: Array.from(cMap.entries()),
      })
    }
    return modeList
  }, [items])

  // 첫 로드 시 모든 그룹 펼침
  useEffect(() => {
    const keys = {}
    for (const { mode, groups } of grouped) {
      for (const [cid] of groups) keys[`${mode.key}::${cid}`] = true
    }
    setOpenKey(keys)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped.length])

  const toggle = (k) => setOpenKey({ ...openKey, [k]: !openKey[k] })

  return (
    <div className="col" style={{ gap: 14 }}>
      {grouped.map(({ mode, groups }) => (
        <div key={mode.key}>
          {modeFilter === 'all' && (
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                margin: '6px 0 8px',
                color: 'var(--text-muted)',
              }}
            >
              {mode.emoji} {mode.sessionNumber}차시 — {mode.title}
            </h2>
          )}
          <div className="col" style={{ gap: 10 }}>
            {groups.map(([cid, attempts]) => {
              const ch = challengeMeta(mode.key, cid)
              const k = `${mode.key}::${cid}`
              const open = openKey[k] ?? true
              const privateCount = attempts.filter(
                (a) => a.is_public === false || a.self_check?.privateLetter
              ).length
              return (
                <section key={cid} className="card" style={{ padding: 0 }}>
                  <button
                    onClick={() => toggle(k)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '1.3rem' }}>{ch?.emoji || '📁'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.98rem', fontWeight: 700 }}>
                        {ch?.title || cid}
                        {ch?.level && (
                          <span
                            className="muted small"
                            style={{ marginLeft: 8, fontWeight: 400 }}
                          >
                            Level {ch.level}
                          </span>
                        )}
                      </div>
                      <div className="muted small" style={{ marginTop: 2, fontSize: '0.88rem' }}>
                        {modeFilter !== 'all' && (
                          <span>{mode.sessionNumber}차시 · {mode.title} · </span>
                        )}
                        {ch?.description?.slice(0, 80) || ''}
                      </div>
                    </div>
                    {privateCount > 0 && (
                      <span
                        className="tag"
                        style={{
                          background: 'var(--warning)',
                          color: 'white',
                          padding: '3px 10px',
                          fontSize: '0.86rem',
                        }}
                      >
                        🔒 {privateCount}
                      </span>
                    )}
                    <span
                      className="tag"
                      style={{
                        background: 'var(--accent)',
                        color: 'white',
                        padding: '3px 10px',
                        fontSize: '0.9rem',
                      }}
                    >
                      {attempts.length}개
                    </span>
                    <span className="muted" style={{ fontSize: '0.95rem' }}>{open ? '▲' : '▼'}</span>
                  </button>
                  {open && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                      <div className="col" style={{ gap: 8, marginTop: 12 }}>
                        {attempts.map((a) => (
                          <AttemptRow key={a.id} a={a} onChange={onChange} />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="card-sm" style={{ flex: 1, textAlign: 'center' }}>
      <div className="muted small">{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: color || 'var(--accent-hover)' }}>
        {value}
      </div>
    </div>
  )
}

function AttemptRow({ a, onChange }) {
  const [score, setScore] = useState(a.teacher_score ?? '')
  const [comment, setComment] = useState(a.teacher_comment ?? '')
  const isPrivate = a.is_public === false || a.self_check?.privateLetter === true
  const isObservation = a.self_check?.type === 'observation'

  return (
    <div
      className="card-sm"
      style={
        isPrivate
          ? {
              borderLeft: '4px solid var(--warning)',
              background: 'rgba(245, 158, 11, 0.04)',
            }
          : undefined
      }
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {a.student?.student_number} {a.student?.name}
          {isPrivate && (
            <span
              className="tag"
              style={{
                background: 'var(--warning)',
                color: 'white',
                fontSize: '0.84rem',
                padding: '2px 8px',
              }}
              title="공개 갤러리에 노출되지 않은 비공개 제출 — 학생이 선생님께만 제출함"
            >
              🔒 비공개 (D-30 편지)
            </span>
          )}
          {isObservation && (
            <span
              className="tag"
              style={{
                background: '#9333ea',
                color: 'white',
                fontSize: '0.84rem',
                padding: '2px 8px',
              }}
            >
              관찰 메모
            </span>
          )}
        </span>
        <span className="muted small">
          {a.session_number}차시 / {a.mode} / {new Date(a.created_at).toLocaleString()}
        </span>
      </div>

      {a.self_check?.userRequest && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            background: 'rgba(245, 158, 11, 0.12)',
            borderLeft: '2px solid var(--warning)',
            borderRadius: 4,
            fontSize: '0.95rem',
            color: 'var(--text)',
          }}
        >
          <strong style={{ color: 'var(--warning)' }}>💬 학생이 더한 말:</strong>{' '}
          {a.self_check.userRequest}
        </div>
      )}

      <div className="muted small" style={{ marginTop: 6 }}>
        <strong>P:</strong> {a.prompt.slice(0, 200)}{a.prompt.length > 200 && '...'}
      </div>
      {a.output_text && (
        <div style={{ marginTop: 4, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
          <strong>A:</strong> {a.output_text.slice(0, 240)}{a.output_text.length > 240 && '...'}
        </div>
      )}
      {a.reflection && (
        <div style={{ marginTop: 4, fontSize: '0.9rem', color: 'var(--warning)', whiteSpace: 'pre-wrap' }}>
          💭 {a.reflection}
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: 0 }}>
          <span>점수</span>
          <input
            type="number"
            min="0"
            max="100"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>코멘트</span>
          <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        <button
          className="btn btn-primary"
          onClick={async () => {
            await setTeacherScore(a.id, {
              score: score === '' ? null : Number(score),
              comment,
            })
            onChange()
          }}
        >
          저장
        </button>
        <button
          className="btn"
          onClick={async () => {
            await setTeacherHidden(a.id, !a.hidden_by_teacher)
            onChange()
          }}
          style={{
            background: a.hidden_by_teacher ? 'var(--danger)' : 'var(--surface2)',
            color: a.hidden_by_teacher ? 'white' : 'var(--text)',
          }}
        >
          {a.hidden_by_teacher ? '🚫 가림' : '👁 공개'}
        </button>
      </div>
    </div>
  )
}
