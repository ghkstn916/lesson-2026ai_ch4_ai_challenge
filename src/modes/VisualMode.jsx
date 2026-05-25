import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import VPythonRunner from '../components/shared/VPythonRunner.jsx'
import useStudentStore from '../store/studentStore.js'
import { BATTLE_CHALLENGES } from '../data/challenges-battle.js'
import { generateGlowscriptCode, evaluateVisualPrompt } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts } from '../lib/supabase.js'

export default function VisualMode() {
  const { studentId } = useStudentStore()
  const [challenge, setChallenge] = useState(BATTLE_CHALLENGES[0])
  const [prompt, setPrompt] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [evaluation, setEvaluation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'visual' })
      .then(setHistory)
      .catch((e) => console.warn(e))
  }, [studentId])

  const myForChallenge = history.filter((h) => h.challenge_id === challenge.id)
  const bestScore = myForChallenge.reduce(
    (max, a) => Math.max(max, a.self_check?.score ?? 0),
    0
  )

  const handleSubmit = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('프롬프트를 작성해주세요.')
      return
    }
    setLoading(true)
    setEvaluation(null)
    setGeneratedCode('')

    try {
      const code = await generateGlowscriptCode(prompt)
      setGeneratedCode(code)

      const evalResult = await evaluateVisualPrompt({
        prompt,
        generatedCode: code,
        targetCode: challenge.code,
      })
      setEvaluation(evalResult)

      const row = await insertAttempt({
        student_id: studentId,
        session_number: 2,
        mode: 'visual',
        challenge_id: challenge.id,
        prompt,
        output_text: code,
        self_check: evalResult,
      })
      setHistory([row, ...history])
    } catch (e) {
      setError(e.message || '오류')
    }
    setLoading(false)
  }

  return (
    <StudentLayout needKey="anthropic" title="2차시 시각화">
      <ModeIntro modeKey="visual" />
      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        {/* ── 좌측: 챌린지 선택 ──────────────────────────────────────────── */}
        <div className="col" style={{ flex: '0 0 280px', gap: 16 }}>
          <div className="card-sm">
            <p className="muted small" style={{ marginBottom: 8 }}>챌린지 ({BATTLE_CHALLENGES.length}개)</p>
            <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
              {BATTLE_CHALLENGES.map((c) => {
                const selected = challenge.id === c.id
                return (
                  <button
                    key={c.id}
                    className="btn"
                    onClick={() => {
                      setChallenge(c)
                      setPrompt('')
                      setGeneratedCode('')
                      setEvaluation(null)
                    }}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      marginTop: 4,
                      padding: '6px 8px',
                      fontSize: '0.85rem',
                      background: selected ? 'var(--accent)' : 'var(--surface2)',
                      borderColor: selected ? 'var(--accent)' : 'var(--border)',
                      color: selected ? 'white' : 'var(--text)',
                    }}
                  >
                    <span style={{ width: 24 }}>L{c.level}</span>
                    <span>{c.emoji} {c.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── 우측: 챌린지 본문 ──────────────────────────────────────────── */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          <div className="card">
            <p className="muted small">Level {challenge.level}</p>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {challenge.emoji} {challenge.title}
            </h2>
            <p className="muted small" style={{ marginTop: 6 }}>
              사용 도형: {challenge.shapes.join(', ')} / CT: {challenge.ct.join(', ')}
            </p>
            <p className="small" style={{ color: 'var(--warning)', marginTop: 8 }}>
              💡 {challenge.hint}
            </p>
          </div>

          <div
            className="scene-grid"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <VPythonRunner code={challenge.code} height="240px" label="👁 이 장면을 묘사하세요" />
            <VPythonRunner
              code={generatedCode}
              height="240px"
              label="🤖 AI가 만든 장면"
              autoRun={!!generatedCode}
            />
          </div>

          <div className="card">
            <label className="field">
              <span>프롬프트 — 위 장면을 AI에게 설명</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="예) 원점에 반지름 2의 청록색 고리가 세로로 세워져 있다"
                rows={4}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit()
                }}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
              style={{ width: '100%', marginTop: 12 }}
            >
              {loading ? '생성 중...' : '🚀 AI에게 보내기 (Ctrl+Enter)'}
            </button>
            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
          </div>

          {evaluation && (
            <div
              className="card"
              style={{
                borderColor:
                  evaluation.score >= 80
                    ? 'var(--success)'
                    : evaluation.score >= 60
                    ? 'var(--warning)'
                    : 'var(--border)',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: 700 }}>자기 점검 (AI 채점)</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-hover)' }}>
                  {evaluation.score}점
                </span>
              </div>
              <div
                className="ct-grid"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}
              >
                {[
                  { k: 'abstract', l: '추상화' },
                  { k: 'pattern', l: '패턴인식' },
                  { k: 'decomp', l: '분해' },
                  { k: 'algorithm', l: '알고리즘' },
                ].map(({ k, l }) => (
                  <div key={k}>
                    <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span className="muted">{l}</span>
                      <span>{evaluation.ct_scores?.[k] ?? 0}/25</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${((evaluation.ct_scores?.[k] ?? 0) / 25) * 100}%`,
                          background: 'var(--accent)',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="muted small" style={{ marginTop: 12 }}>{evaluation.feedback}</p>
              {evaluation.improvements?.length > 0 && (
                <ul className="muted small" style={{ paddingLeft: 18, marginTop: 6 }}>
                  {evaluation.improvements.map((imp, i) => <li key={i}>→ {imp}</li>)}
                </ul>
              )}
            </div>
          )}

          {myForChallenge.length > 0 && (
            <div className="card">
              <p className="muted small">
                이 챌린지 시도 — {myForChallenge.length}회 / 최고 점수 {bestScore}점
              </p>
              <div style={{ marginTop: 8 }}>
                {myForChallenge.slice(0, 5).map((a) => (
                  <div className="attempt" key={a.id}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-hover)' }}>
                      {a.self_check?.score ?? 0}점
                    </span>
                    <span className="muted small" style={{ marginLeft: 8 }}>
                      {new Date(a.created_at).toLocaleTimeString()}
                    </span>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {a.prompt.slice(0, 100)}{a.prompt.length > 100 && '...'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  )
}
