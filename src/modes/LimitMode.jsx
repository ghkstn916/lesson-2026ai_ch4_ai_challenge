import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import { LIMIT_CHALLENGES, LIMIT_DEFAULT_REFLECT } from '../data/challenges-limit.js'
import { callClaude } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts } from '../lib/supabase.js'

export default function LimitMode() {
  const { studentId } = useStudentStore()
  const [challenge, setChallenge] = useState(LIMIT_CHALLENGES[0])
  const [prompt, setPrompt] = useState('')
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [reflection, setReflection] = useState('')

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'limit' })
      .then(setHistory)
      .catch(() => {})
  }, [studentId])

  const myForChallenge = history.filter((h) => h.challenge_id === challenge.id)

  const handleRun = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('프롬프트를 작성해주세요.')
      return
    }
    setLoading(true)
    setResponses([])

    try {
      const n = challenge.repeat || 1
      const calls = Array.from({ length: n }, () =>
        callClaude({
          model: 'claude-haiku-4-5-20251001',
          maxTokens: 350,
          messages: [{ role: 'user', content: prompt }],
        })
      )
      const results = await Promise.all(calls)
      setResponses(results.map((r) => r.text))
    } catch (e) {
      setError(e.message || '호출 실패')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setError('')
    if (responses.length === 0) {
      setError('먼저 AI에게 보내보세요.')
      return
    }
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 5,
        mode: 'limit',
        challenge_id: challenge.id,
        prompt,
        output_text: responses.map((r, i) => `[응답 ${i + 1}]\n${r}`).join('\n\n---\n\n'),
        self_check: { kind: challenge.kind, repeat: responses.length },
        reflection: reflection || null,
      })
      setHistory([row, ...history])
      setPrompt('')
      setResponses([])
      setReflection('')
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  return (
    <StudentLayout needKey="anthropic" title="5차시 한계">
      <ModeIntro modeKey="limit" />

      {/* 챌린지 탭 */}
      <div className="card-sm" style={{ marginBottom: 16, display: 'flex', gap: 6 }}>
        {LIMIT_CHALLENGES.map((c) => {
          const selected = challenge.id === c.id
          return (
            <button
              key={c.id}
              className="btn"
              onClick={() => {
                setChallenge(c)
                setPrompt('')
                setResponses([])
              }}
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: '0.9rem',
                background: selected ? 'var(--accent)' : 'var(--surface2)',
                borderColor: selected ? 'var(--accent)' : 'var(--border)',
                color: selected ? 'white' : 'var(--text)',
              }}
            >
              Lv{c.level} {c.emoji} {c.title}
            </button>
          )
        })}
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        {/* ── 좌측: 챌린지 안내 + 프롬프트 ──────────────────────────── */}
        <div className="col" style={{ flex: '0 0 380px', gap: 16 }}>
          <div className="challenge">
            <p className="meta">Level {challenge.level}</p>
            <h3>{challenge.emoji} {challenge.title}</h3>
            <p className="muted small" style={{ marginBottom: 12 }}>{challenge.description}</p>

            <p className="muted small" style={{ fontWeight: 600 }}>예시 프롬프트 (참고용)</p>
            <ul style={{ paddingLeft: 18, lineHeight: 1.7, fontSize: '0.85rem' }}>
              {challenge.seedPrompts.map((p, i) => (
                <li key={i}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPrompt(p)}
                    style={{
                      padding: 0,
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-hover)',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                    }}
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>

            <p
              className="small"
              style={{
                marginTop: 12,
                padding: '8px 10px',
                background: 'rgba(245, 158, 11, 0.12)',
                color: 'var(--warning)',
                borderRadius: 'var(--radius)',
              }}
            >
              👀 관찰 포인트: {challenge.observePoint}
            </p>

            {challenge.kind === 'hallucination' && (
              <p
                className="small muted"
                style={{ marginTop: 8, fontSize: '0.8rem' }}
              >
                ⚠️ 가짜 사건은 시도하되, 실존 인물·집단을 폄하하는 거짓 정보는 만들지 마세요.
              </p>
            )}
          </div>

          <div className="card">
            <label className="field">
              <span>프롬프트</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="위 예시를 클릭해 채우거나 본인이 직접 작성하세요"
                rows={4}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={loading || !prompt.trim()}
              style={{ width: '100%', marginTop: 10 }}
            >
              {loading
                ? `생성 중... (${challenge.repeat > 1 ? `${challenge.repeat}회 동시` : '1회'})`
                : challenge.repeat > 1
                ? `🎲 ${challenge.repeat}번 동시에 보내기`
                : '🚀 AI에게 보내기'}
            </button>
            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
            {challenge.repeat > 1 && (
              <p className="muted small" style={{ marginTop: 8 }}>
                같은 프롬프트를 {challenge.repeat}회 병렬 호출 — 답이 얼마나 흩어지는지 비교해보세요.
              </p>
            )}
          </div>
        </div>

        {/* ── 우측: 응답 N개 + 분석 + 등록 ─────────────────────────── */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          {responses.length === 0 && (
            <div className="card-sm muted small" style={{ textAlign: 'center', padding: 30 }}>
              왼쪽에서 프롬프트를 보내면 응답이 여기에 표시됩니다.
            </div>
          )}

          {responses.length > 0 && (
            <div className="col" style={{ gap: 10 }}>
              {responses.map((r, i) => (
                <div className="card-sm" key={i}>
                  <div
                    className="row"
                    style={{ justifyContent: 'space-between', marginBottom: 6 }}
                  >
                    <span className="muted small">응답 {i + 1}</span>
                    {responses.length > 1 && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: ['#4338ca', '#047857', '#b45309', '#9333ea', '#be123c'][i % 5],
                          color: 'white',
                        }}
                      >
                        #{i + 1}
                      </span>
                    )}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{r}</div>
                </div>
              ))}
            </div>
          )}

          {responses.length > 0 && (
            <div className="card">
              <p className="muted small" style={{ marginBottom: 6 }}>
                🧪 분석 메모 (필수) — 토큰 예측 메커니즘으로 설명해보세요
              </p>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={3}
                placeholder={
                  challenge.kind === 'hallucination'
                    ? '예) AI가 만들어낸 것: ___ / 실제 사실 또는 확인 불가: ___ / 왜 만들어냈을까: 토큰 예측은 "그럴듯한 다음 단어"를 예측하므로...'
                    : challenge.kind === 'bias'
                    ? '예) 가정된 디폴트: 성별 ___, 나이 ___, 국적 ___ / 왜 그렇게 되었을까: 학습 데이터에 더 자주 등장한 패턴...'
                    : '예) 일관된 부분: ___ / 매번 다른 부분: ___ / 같은 입력에도 답이 달라지는 이유: 토큰 예측은 확률적이므로...'
                }
                style={{ width: '100%' }}
              />
              <p className="muted small" style={{ marginTop: 8, fontSize: '0.78rem' }}>
                💡 회수 포인트: {LIMIT_DEFAULT_REFLECT}
              </p>
              <button
                className="btn btn-primary"
                onClick={handleRegister}
                style={{ width: '100%', marginTop: 10 }}
              >
                📌 갤러리에 등록
              </button>
            </div>
          )}

          {myForChallenge.length > 0 && (
            <div className="card-sm">
              <p className="muted small" style={{ marginBottom: 6 }}>
                이 챌린지 — {myForChallenge.length}회 등록
              </p>
              {myForChallenge.slice(0, 3).map((a) => (
                <div className="attempt" key={a.id} style={{ fontSize: '0.82rem' }}>
                  <span className="muted">{new Date(a.created_at).toLocaleTimeString()}</span>
                  <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    <strong>P:</strong> {a.prompt.slice(0, 90)}{a.prompt.length > 90 && '...'}
                  </div>
                  {a.reflection && (
                    <div style={{ marginTop: 4, color: 'var(--warning)' }}>
                      💭 {a.reflection.slice(0, 100)}
                      {a.reflection.length > 100 && '...'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  )
}
