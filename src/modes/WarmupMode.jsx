import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import { WARMUP_CHALLENGES, VARIANT_LABELS } from '../data/challenges-warmup.js'
import { callClaude } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts } from '../lib/supabase.js'

export default function WarmupMode() {
  const { studentId } = useStudentStore()
  const [challenge, setChallenge] = useState(WARMUP_CHALLENGES[0])
  const [prompt, setPrompt] = useState('')
  const [variantLabel, setVariantLabel] = useState('role')
  const [reflection, setReflection] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  // 내 시도 기록 로드
  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'warmup' })
      .then(setHistory)
      .catch((e) => console.warn('history load', e))
  }, [studentId])

  const myForChallenge = history.filter((h) => h.challenge_id === challenge.id)

  const handleRun = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('프롬프트를 작성해주세요.')
      return
    }
    setLoading(true)
    setOutput('')
    try {
      const { text } = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })
      setOutput(text)
    } catch (e) {
      setError(e.message || '생성 실패')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setError('')
    if (!output) {
      setError('먼저 결과를 생성한 다음에 등록하세요.')
      return
    }
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 1,
        mode: 'warmup',
        challenge_id: challenge.id,
        prompt,
        output_text: output,
        variant_label: variantLabel,
        reflection: reflection || null,
      })
      setHistory([row, ...history])
      setPrompt('')
      setOutput('')
      setReflection('')
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  return (
    <StudentLayout needKey="anthropic" title="1차시 워밍업">
      <ModeIntro modeKey="warmup" />
      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        {/* ── 좌측: 미션 선택 + 챌린지 카드 ─────────────────────────────────── */}
        <div className="col" style={{ flex: '0 0 320px', gap: 16 }}>
          <div className="card-sm">
            <p className="muted small" style={{ marginBottom: 6 }}>오늘의 미션</p>
            {WARMUP_CHALLENGES.map((c) => (
              <button
                key={c.id}
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  marginTop: 6,
                  background: challenge.id === c.id ? 'var(--accent)' : 'var(--surface2)',
                  borderColor: challenge.id === c.id ? 'var(--accent)' : 'var(--border)',
                  color: challenge.id === c.id ? 'white' : 'var(--text)',
                }}
                onClick={() => {
                  setChallenge(c)
                  setPrompt('')
                  setOutput('')
                }}
              >
                {c.emoji} {c.title}
              </button>
            ))}
          </div>

          <div className="challenge">
            <p className="meta">{challenge.level}</p>
            <h3>{challenge.emoji} {challenge.title}</h3>
            <p className="muted small" style={{ marginBottom: 12 }}>{challenge.description}</p>

            <p className="muted small" style={{ fontWeight: 600, marginTop: 8 }}>변형 힌트:</p>
            <ul className="muted small" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              {VARIANT_LABELS.map((v) => (
                <li key={v.key}>
                  <span className={`tag ${v.key}`}>{v.label}</span>
                  {challenge.suggestions[v.key]?.slice(0, 2).join(' / ')}
                </li>
              ))}
            </ul>

            <p className="small" style={{ color: 'var(--warning)', marginTop: 12 }}>
              💡 {challenge.successHint}
            </p>
          </div>
        </div>

        {/* ── 우측: 프롬프트 작성 + 결과 ────────────────────────────────────── */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          <div className="card">
            <label className="field">
              <span>프롬프트</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`예) 너는 따뜻한 선배야. 수능 D-30인 친구에게, 50자 이내로, 비유를 하나 넣어 한 줄 응원을 보내줘.`}
                rows={5}
              />
            </label>

            <div className="field" style={{ marginTop: 12 }}>
              <span>이번에 바꾼 요소는?</span>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {VARIANT_LABELS.map((v) => (
                  <button
                    key={v.key}
                    className="btn"
                    onClick={() => setVariantLabel(v.key)}
                    style={{
                      background: variantLabel === v.key ? v.color : 'var(--surface2)',
                      borderColor: variantLabel === v.key ? v.color : 'var(--border)',
                      color: variantLabel === v.key ? 'white' : 'var(--text)',
                      padding: '6px 10px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                onClick={handleRun}
                disabled={loading || !prompt.trim()}
                style={{ flex: 1 }}
              >
                {loading ? '생성 중...' : '🤖 AI에게 보내기'}
              </button>
            </div>

            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
          </div>

          {output && (
            <div className="card">
              <p className="muted small" style={{ marginBottom: 6 }}>AI 응답</p>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{output}</div>

              <label className="field" style={{ marginTop: 14 }}>
                <span>관찰 메모 (선택) — 이번에는 어떤 점이 달랐나요?</span>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={2}
                  placeholder="예) 역할을 '선배'로 바꿨더니 말투가 더 친근해졌다"
                />
              </label>

              <button className="btn btn-primary" onClick={handleRegister} style={{ marginTop: 10, width: '100%' }}>
                📌 갤러리에 등록 ({variantLabel} 변형으로)
              </button>
            </div>
          )}

          <div className="card">
            <p className="muted small" style={{ marginBottom: 8 }}>
              내가 등록한 시도 — <strong>{myForChallenge.length}</strong> / 최소 {challenge.minVariants}개 필요
            </p>
            {myForChallenge.length === 0 && (
              <p className="muted small">아직 등록한 시도가 없어요. 변형 라벨을 바꿔가며 2개 이상 등록해보세요.</p>
            )}
            {myForChallenge.map((a) => (
              <div className="attempt" key={a.id}>
                <span className={`tag ${a.variant_label}`}>
                  {VARIANT_LABELS.find((v) => v.key === a.variant_label)?.label || a.variant_label}
                </span>
                <span className="muted small"> {new Date(a.created_at).toLocaleTimeString()}</span>
                <div style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-muted)' }}>
                  <strong>P:</strong> {a.prompt.slice(0, 120)}{a.prompt.length > 120 && '...'}
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                  <strong>A:</strong> {a.output_text}
                </div>
                {a.reflection && (
                  <div style={{ fontSize: '0.8rem', marginTop: 4, color: 'var(--warning)' }}>
                    💭 {a.reflection}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </StudentLayout>
  )
}
