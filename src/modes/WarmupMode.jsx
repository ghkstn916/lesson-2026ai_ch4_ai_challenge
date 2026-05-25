import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import {
  WARMUP_CHALLENGES,
  VARIANT_LABELS,
  composeWarmupPrompt,
} from '../data/challenges-warmup.js'
import { callClaude } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts } from '../lib/supabase.js'

function emptyConfirm() {
  return { role: false, context: false, output: false, condition: false }
}

export default function WarmupMode() {
  const { studentId } = useStudentStore()
  const [challenge, setChallenge] = useState(WARMUP_CHALLENGES[0])
  const [parts, setParts] = useState(challenge.defaults)
  const [confirmed, setConfirmed] = useState({
    ...emptyConfirm(),
    role: !!challenge.defaults.role, // 기본 역할은 미리 확인 상태
  })

  const [output, setOutput] = useState('')
  const [reflection, setReflection] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  // 챌린지 바뀌면 빌더 초기화
  useEffect(() => {
    setParts(challenge.defaults)
    setConfirmed({ ...emptyConfirm(), role: !!challenge.defaults.role })
    setOutput('')
    setError('')
  }, [challenge.id])

  // 내 시도 기록
  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'warmup' })
      .then(setHistory)
      .catch(() => {})
  }, [studentId])

  const myForChallenge = history.filter((h) => h.challenge_id === challenge.id)

  const allConfirmed = VARIANT_LABELS.every(
    (v) => confirmed[v.key] && (parts[v.key] || '').trim()
  )
  const composedPrompt = composeWarmupPrompt(parts, challenge)

  const handleChange = (key, value) => {
    setParts({ ...parts, [key]: value })
    // 내용을 바꾸면 확인 상태 풀림 (다시 확인 필요)
    if (confirmed[key]) setConfirmed({ ...confirmed, [key]: false })
  }
  const handleConfirm = (key) => {
    if (!(parts[key] || '').trim()) return
    setConfirmed({ ...confirmed, [key]: true })
  }
  const handleClickSuggestion = (key, val) => {
    setParts({ ...parts, [key]: val })
    setConfirmed({ ...confirmed, [key]: false })
  }

  const handleRun = async () => {
    setError('')
    if (!allConfirmed) {
      setError('4요소를 모두 입력하고 각 "확인" 버튼을 눌러주세요.')
      return
    }
    setLoading(true)
    setOutput('')
    try {
      const { text } = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 600,
        messages: [{ role: 'user', content: composedPrompt }],
      })
      setOutput(text)
    } catch (e) {
      setError(e.message || '생성 실패')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!output) return
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 1,
        mode: 'warmup',
        challenge_id: challenge.id,
        prompt: composedPrompt,
        output_text: output,
        self_check: { ...parts },
        reflection: reflection || null,
      })
      setHistory([row, ...history])
      setReflection('')
      setOutput('')
      // 다음 시도를 위해 빌더는 그대로 두되 확인 상태 유지(같은 prompt 재실행도 가능)
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  return (
    <StudentLayout needKey="anthropic" title="1차시 워밍업">
      <ModeIntro modeKey="warmup" />

      <div className="row" style={{ gap: 20, alignItems: 'flex-start' }}>
        {/* ── 좌측: 미션 선택 + 챌린지 카드 ─────────────────────────────── */}
        <div className="col" style={{ flex: '0 0 260px', gap: 16 }}>
          <div className="card-sm">
            <p className="muted small" style={{ marginBottom: 6 }}>오늘의 미션</p>
            {WARMUP_CHALLENGES.map((c) => {
              const selected = challenge.id === c.id
              return (
                <button
                  key={c.id}
                  className="btn"
                  onClick={() => setChallenge(c)}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    marginTop: 6,
                    background: selected ? 'var(--accent)' : 'var(--surface2)',
                    borderColor: selected ? 'var(--accent)' : 'var(--border)',
                    color: selected ? 'white' : 'var(--text)',
                  }}
                >
                  {c.emoji} {c.title}
                </button>
              )
            })}
          </div>

          <div className="challenge">
            <p className="meta">{challenge.level}</p>
            <h3>{challenge.emoji} {challenge.title}</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>
              {challenge.description}
            </p>
            <p className="small" style={{ color: 'var(--warning)', marginTop: 8 }}>
              💡 {challenge.successHint}
            </p>
          </div>

          {myForChallenge.length > 0 && (
            <div className="card-sm">
              <p className="muted small">
                이 챌린지 등록 — {myForChallenge.length} / 최소 {challenge.minVariants}개
              </p>
            </div>
          )}
        </div>

        {/* ── 중앙: 4요소 빌더 ────────────────────────────────────────── */}
        <div className="col" style={{ flex: '1 1 0', minWidth: 0, gap: 16 }}>
          <div className="card">
            <p className="muted small" style={{ marginBottom: 4, fontWeight: 600 }}>
              ① 4요소를 각각 입력하고 [확인]을 누르세요
            </p>
            <p className="muted small" style={{ marginBottom: 14, fontSize: '0.78rem' }}>
              4가지가 모두 확인되면 우측 [AI에게 보내기]가 활성화됩니다.
            </p>

            <div className="col" style={{ gap: 14 }}>
              {VARIANT_LABELS.map((v) => (
                <PartInput
                  key={v.key}
                  meta={v}
                  value={parts[v.key]}
                  confirmed={confirmed[v.key]}
                  suggestions={challenge.suggestions[v.key] || []}
                  onChange={(val) => handleChange(v.key, val)}
                  onConfirm={() => handleConfirm(v.key)}
                  onClickSuggestion={(val) => handleClickSuggestion(v.key, val)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── 우측: 완성 프롬프트 + AI 보내기 ─────────────────────────── */}
        <div className="col" style={{ flex: '0 0 380px', gap: 16 }}>
          <div
            className="card"
            style={{
              borderLeft: '4px solid ' + (allConfirmed ? 'var(--success)' : 'var(--warning)'),
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted small" style={{ fontWeight: 600 }}>
                ② 완성 프롬프트
              </span>
              <span
                className="small"
                style={{ color: allConfirmed ? 'var(--success)' : 'var(--warning)' }}
              >
                {VARIANT_LABELS.filter((v) => confirmed[v.key]).length}/4 확인됨
              </span>
            </div>

            <pre
              style={{
                background: 'var(--bg)',
                padding: 10,
                borderRadius: 'var(--radius)',
                fontSize: '0.82rem',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                color: 'var(--text-muted)',
                minHeight: 140,
              }}
            >
              {composedPrompt}
            </pre>

            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={loading || !allConfirmed}
              style={{ width: '100%', marginTop: 12 }}
            >
              {loading ? '생성 중...' : '🚀 AI에게 보내기'}
            </button>
            {!allConfirmed && (
              <p className="muted small" style={{ marginTop: 8, textAlign: 'center' }}>
                4요소를 모두 확인하면 보낼 수 있어요.
              </p>
            )}
            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
          </div>

          {output && (
            <div className="card">
              <p className="muted small" style={{ marginBottom: 6 }}>🤖 AI 응답</p>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{output}</div>

              <label className="field" style={{ marginTop: 14 }}>
                <span>관찰 메모 (선택)</span>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={2}
                  placeholder="예) 역할을 친구로 바꿨더니 말투가 자연스러워졌다"
                />
              </label>

              <button
                className="btn btn-primary"
                onClick={handleRegister}
                style={{ width: '100%', marginTop: 10 }}
              >
                📌 갤러리에 등록
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 내 시도 기록 ──────────────────────────────────────────────── */}
      {myForChallenge.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted small" style={{ marginBottom: 8 }}>
            내가 등록한 시도 — {myForChallenge.length}회
          </p>
          {myForChallenge.slice(0, 5).map((a) => (
            <div className="attempt" key={a.id}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {VARIANT_LABELS.map((v) => {
                  const val = a.self_check?.[v.key] || ''
                  if (!val) return null
                  return (
                    <span key={v.key} className={`tag ${v.key}`} style={{ fontSize: '0.7rem' }}>
                      {v.label}: {val.length > 18 ? val.slice(0, 18) + '…' : val}
                    </span>
                  )
                })}
                <span className="muted small" style={{ marginLeft: 'auto' }}>
                  {new Date(a.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>
                {a.output_text}
              </div>
              {a.reflection && (
                <div style={{ fontSize: '0.8rem', marginTop: 4, color: 'var(--warning)' }}>
                  💭 {a.reflection}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </StudentLayout>
  )
}

// ── 4요소 1개 입력 컴포넌트 ────────────────────────────────────────────────
function PartInput({ meta, value, confirmed, suggestions, onChange, onConfirm, onClickSuggestion }) {
  const trimmed = (value || '').trim()
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--bg)',
        borderRadius: 'var(--radius)',
        border: '1px solid ' + (confirmed ? meta.color : 'var(--border)'),
        transition: 'border-color 0.15s',
      }}
    >
      <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span
          className={`tag ${meta.key}`}
          style={{ background: meta.color, color: 'white', fontWeight: 700 }}
        >
          {meta.label}
        </span>
        <span className="muted small" style={{ fontSize: '0.75rem' }}>
          {confirmed ? '✅ 확인됨' : '입력 후 [확인] 클릭'}
        </span>
      </div>

      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${meta.label}을(를) 적어보세요`}
          style={{
            flex: 1,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            color: 'var(--text)',
            fontSize: '0.9rem',
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm()
          }}
        />
        <button
          className="btn"
          onClick={onConfirm}
          disabled={!trimmed || confirmed}
          style={{
            padding: '8px 14px',
            fontSize: '0.85rem',
            background: confirmed ? meta.color : trimmed ? 'var(--accent)' : 'var(--surface2)',
            borderColor: confirmed ? meta.color : trimmed ? 'var(--accent)' : 'var(--border)',
            color: confirmed || trimmed ? 'white' : 'var(--text-muted)',
            opacity: !trimmed ? 0.6 : 1,
          }}
        >
          {confirmed ? '✓ 확인됨' : '확인'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              className="btn btn-ghost"
              onClick={() => onClickSuggestion(s)}
              style={{
                padding: '3px 8px',
                fontSize: '0.75rem',
                background: value === s ? meta.color : 'transparent',
                borderColor: 'var(--border)',
                color: value === s ? 'white' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
