import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStudentStore from '../store/studentStore.js'
import { upsertStudent } from '../lib/supabase.js'

export default function JoinPage() {
  const nav = useNavigate()
  const store = useStudentStore()
  const [sessionId, setSessionId] = useState(store.sessionId || '3-5')
  const [studentNumber, setStudentNumber] = useState(store.studentNumber || '')
  const [name, setName] = useState(store.name || '')
  const [anthropicKey, setAnthropicKey] = useState(store.anthropicKey || '')
  const [openaiKey, setOpenaiKey] = useState(store.openaiKey || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!sessionId.trim() || !studentNumber.trim() || !name.trim()) {
      setError('학급, 학번, 이름을 모두 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const row = await upsertStudent({
        sessionId: sessionId.trim(),
        studentNumber: studentNumber.trim(),
        name: name.trim(),
      })
      store.setStudent({
        studentId: row.id,
        sessionId: row.session_id,
        studentNumber: row.student_number,
        name: row.name,
      })
      store.setAnthropicKey(anthropicKey.trim())
      store.setOpenaiKey(openaiKey.trim())
      nav('/student')
    } catch (err) {
      setError(err.message || '등록 실패')
    }
    setLoading(false)
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>
          🎓 AI 챌린지 입장
        </h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          고3 인공지능 기초 — 생성형 AI와 에이전틱 AI (6차시)
        </p>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>학급</span>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="예: 3-5"
              required
            />
          </label>

          <div className="row">
            <label className="field" style={{ flex: 1 }}>
              <span>학번</span>
              <input
                type="text"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="예: 30501"
                required
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>이름</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                required
              />
            </label>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '6px 0' }} />

          <p className="muted small">
            API 키는 브라우저에만 저장되고 서버에 보관되지 않습니다.
          </p>

          <label className="field">
            <span>Anthropic API 키 <em>(필수 — 1·2·4·5·6차시)</em></span>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span>OpenAI API 키 <em>(3차시 이미지 전용 — 지금은 비워둬도 됨)</em></span>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '입장 중...' : '🚀 입장'}
          </button>
        </form>

        <p className="muted small" style={{ marginTop: 16 }}>
          이미 등록한 학번이면 자동으로 다시 인식됩니다.{' '}
          <a href="/guide">교사 안내</a> · <a href="/privacy">개인정보</a>
        </p>
      </div>
    </div>
  )
}
