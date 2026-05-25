import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import CTOverview from '../components/CTOverview.jsx'
import VPythonRunner from '../components/shared/VPythonRunner.jsx'
import useStudentStore from '../store/studentStore.js'
import { BATTLE_CHALLENGES } from '../data/challenges-battle.js'
import { generateGlowscriptCode, evaluateVisualPrompt } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts } from '../lib/supabase.js'

export default function VisualMode() {
  const { studentId } = useStudentStore()
  const [challenge, setChallenge] = useState(BATTLE_CHALLENGES[0])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  // 시도 누적 (client-side만 — 학생이 제출 누른 것만 DB 저장)
  // attempts: [{id, prompt, code, evaluation, submitted, rowId}]
  const [localAttempts, setLocalAttempts] = useState([])

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'visual' })
      .then(setHistory)
      .catch((e) => console.warn(e))
  }, [studentId])

  // 챌린지 바뀌면 작업 영역 초기화
  useEffect(() => {
    setPrompt('')
    setLocalAttempts([])
    setError('')
  }, [challenge.id])

  const myForChallenge = history.filter((h) => h.challenge_id === challenge.id)
  const submittedCount = myForChallenge.length

  const handleRun = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('프롬프트를 작성해주세요.')
      return
    }
    setLoading(true)
    try {
      const code = await generateGlowscriptCode(prompt)
      const evalResult = await evaluateVisualPrompt({
        prompt,
        generatedCode: code,
        targetCode: challenge.code,
      })
      const la = {
        id: Date.now(),
        prompt,
        code,
        evaluation: evalResult,
        submitted: false,
        rowId: null,
      }
      setLocalAttempts([la, ...localAttempts])
      setPrompt('')
    } catch (e) {
      setError(e.message || '오류')
    }
    setLoading(false)
  }

  const handleSubmitFinal = async (la) => {
    if (la.submitted) return
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 2,
        mode: 'visual',
        challenge_id: challenge.id,
        prompt: la.prompt,
        output_text: la.code,
        self_check: la.evaluation,
      })
      setLocalAttempts(
        localAttempts.map((a) => (a.id === la.id ? { ...a, submitted: true, rowId: row.id } : a))
      )
      setHistory([row, ...history])
    } catch (e) {
      setError(e.message || '제출 실패')
    }
  }

  const latest = localAttempts[0]
  const others = localAttempts.slice(1)
  const bestLocalScore = localAttempts.reduce(
    (m, a) => Math.max(m, a.evaluation?.score ?? 0),
    0
  )

  return (
    <StudentLayout needKey="anthropic" title="2차시 시각화">
      <ModeIntro modeKey="visual" />
      <CTOverview />
      <div className="row" style={{ gap: 20, alignItems: 'flex-start' }}>
        {/* ── 좌측: 챌린지 선택 ─────────────────────────────────────────── */}
        <div className="col" style={{ flex: '0 0 260px', gap: 16 }}>
          <div className="card-sm">
            <p className="muted small" style={{ marginBottom: 8 }}>
              챌린지 ({BATTLE_CHALLENGES.length}개)
            </p>
            <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
              {BATTLE_CHALLENGES.map((c) => {
                const selected = challenge.id === c.id
                return (
                  <button
                    key={c.id}
                    className="btn"
                    onClick={() => setChallenge(c)}
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

        {/* ── 우측: 챌린지 본문 ─────────────────────────────────────────── */}
        <div className="col" style={{ flex: '1 1 0', minWidth: 0, gap: 16 }}>
          {/* 챌린지 정보 */}
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
            <p className="muted small" style={{ marginTop: 10, fontSize: '0.8rem' }}>
              📌 시도해도 자동 저장되지 않습니다. 마음에 드는 결과만 [최종 제출] 버튼으로 제출하세요.
              {submittedCount > 0 && ` · 이미 제출한 결과 ${submittedCount}개`}
            </p>
          </div>

          {/* 목표 장면 + 최신 시도 장면 비교 */}
          <div
            className="scene-grid"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <VPythonRunner code={challenge.code} height="260px" label="👁 이 장면을 묘사하세요" />
            <VPythonRunner
              code={latest?.code || ''}
              height="260px"
              label={latest ? '🤖 가장 최근 결과' : '🤖 시도를 보내면 여기에 표시'}
              autoRun={!!latest?.code}
            />
          </div>

          {/* 프롬프트 입력 */}
          <div className="card">
            <label className="field">
              <span>프롬프트 — 위 장면을 AI에게 설명</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="예) 원점에 반지름 2의 청록색 고리가 세로로 세워져 있다"
                rows={4}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleRun()
                }}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={loading || !prompt.trim()}
              style={{ width: '100%', marginTop: 12 }}
            >
              {loading ? '생성·평가 중...' : '🚀 AI에게 보내기 (Ctrl+Enter)'}
            </button>
            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
          </div>

          {/* 최신 시도 평가 + 제출 */}
          {latest && (
            <AttemptCard
              attempt={latest}
              highlight
              onSubmit={() => handleSubmitFinal(latest)}
            />
          )}

          {/* 이전 시도 목록 (압축) */}
          {others.length > 0 && (
            <div className="card">
              <p className="muted small" style={{ marginBottom: 10 }}>
                이전 시도 {others.length}회 (최고 {bestLocalScore}점) — 마음에 드는 것만 제출
              </p>
              <div className="col" style={{ gap: 10 }}>
                {others.map((la) => (
                  <AttemptCard
                    key={la.id}
                    attempt={la}
                    compact
                    onSubmit={() => handleSubmitFinal(la)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 이미 제출한 결과 요약 */}
          {submittedCount > 0 && (
            <div className="card-sm">
              <p className="muted small">
                이 챌린지에서 제출한 결과: {submittedCount}개 — 갤러리에 노출됩니다
              </p>
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  )
}

// ── 시도 카드 ────────────────────────────────────────────────────────────
function AttemptCard({ attempt, highlight, compact, onSubmit }) {
  const { evaluation, code, prompt, submitted } = attempt
  const score = evaluation?.score ?? 0
  const borderColor =
    score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--border)'

  if (compact) {
    return (
      <div className="attempt" style={{ borderColor }}>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent-hover)', minWidth: 40 }}>
            {score}점
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {prompt}
            </div>
            {evaluation?.feedback && (
              <div className="muted small" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                {evaluation.feedback.slice(0, 80)}
              </div>
            )}
          </div>
          <button
            className="btn"
            onClick={onSubmit}
            disabled={submitted}
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              background: submitted ? 'var(--success)' : 'var(--accent)',
              borderColor: submitted ? 'var(--success)' : 'var(--accent)',
              color: 'white',
              flexShrink: 0,
            }}
          >
            {submitted ? '✓ 제출됨' : '📌 이 결과 제출'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ borderColor }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>{highlight ? '🤖 방금 만든 결과' : '🤖 시도 결과'}</span>
        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-hover)' }}>
          {score}점
        </span>
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>
        <strong>프롬프트:</strong> {prompt}
      </div>

      <div
        className="ct-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}
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
              <span>{evaluation?.ct_scores?.[k] ?? 0}/25</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
              <div
                style={{
                  height: '100%',
                  width: `${((evaluation?.ct_scores?.[k] ?? 0) / 25) * 100}%`,
                  background: 'var(--accent)',
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {evaluation?.feedback && (
        <p className="muted small" style={{ marginTop: 12 }}>{evaluation.feedback}</p>
      )}
      {evaluation?.improvements?.length > 0 && (
        <ul className="muted small" style={{ paddingLeft: 18, marginTop: 6 }}>
          {evaluation.improvements.map((imp, i) => <li key={i}>→ {imp}</li>)}
        </ul>
      )}

      <button
        className="btn btn-primary"
        onClick={onSubmit}
        disabled={submitted}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '12px',
          fontSize: '0.95rem',
          background: submitted ? 'var(--success)' : undefined,
          borderColor: submitted ? 'var(--success)' : undefined,
        }}
      >
        {submitted ? '✓ 최종 제출 완료 — 갤러리에 등록됨' : '📌 이 그림 최종 제출'}
      </button>
    </div>
  )
}
