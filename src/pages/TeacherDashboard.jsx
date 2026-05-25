import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchAllAttemptsForTeacher,
  setTeacherHidden,
  setTeacherScore,
} from '../lib/supabase.js'
import { MODES } from '../data/modes.js'

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
        <button className="btn btn-ghost" onClick={load} style={{ fontSize: '0.85rem' }}>
          🔄 새로고침
        </button>
        <button className="btn btn-ghost" onClick={onLogout} style={{ fontSize: '0.85rem' }}>
          로그아웃
        </button>
      </header>

      <main className="container">
        <div className="row" style={{ gap: 10, marginBottom: 16 }}>
          <SummaryCard label="총 학생 수" value={students.length} />
          <SummaryCard label="총 시도" value={items.length} />
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
              fontSize: '0.85rem',
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
                fontSize: '0.85rem',
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

        <div className="col" style={{ gap: 10 }}>
          {filtered.map((a) => (
            <AttemptRow key={a.id} a={a} onChange={load} />
          ))}
        </div>
      </main>
    </>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="card-sm" style={{ flex: 1, textAlign: 'center' }}>
      <div className="muted small">{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-hover)' }}>{value}</div>
    </div>
  )
}

function AttemptRow({ a, onChange }) {
  const [score, setScore] = useState(a.teacher_score ?? '')
  const [comment, setComment] = useState(a.teacher_comment ?? '')

  return (
    <div className="card-sm">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>
          {a.student?.student_number} {a.student?.name}
        </span>
        <span className="muted small">
          {a.session_number}차시 / {a.mode} / {new Date(a.created_at).toLocaleString()}
        </span>
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>
        <strong>P:</strong> {a.prompt.slice(0, 200)}{a.prompt.length > 200 && '...'}
      </div>
      {a.output_text && (
        <div style={{ marginTop: 4, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
          <strong>A:</strong> {a.output_text.slice(0, 240)}{a.output_text.length > 240 && '...'}
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
