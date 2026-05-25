import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import {
  WARMUP_CHALLENGES,
  VARIANT_LABELS,
  composeWarmupPrompt,
  WARMUP_SYSTEM_PROMPT,
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

  // 변형 실험 (④, ⑤)
  const [experiments, setExperiments] = useState([])
  // experiments: [{ changedKey, oldValue, newValue, response, prompt }, ...]
  const [expKey, setExpKey] = useState('context')          // 무엇을 바꿀지
  const [expValue, setExpValue] = useState('')             // 새 값
  const [expLoading, setExpLoading] = useState(false)
  const [expError, setExpError] = useState('')

  // 챌린지 바뀌면 빌더 + 실험 모두 초기화
  useEffect(() => {
    setParts(challenge.defaults)
    setConfirmed({ ...emptyConfirm(), role: !!challenge.defaults.role })
    setOutput('')
    setError('')
    setExperiments([])
    setExpKey('context')
    setExpValue('')
    setExpError('')
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
        system: WARMUP_SYSTEM_PROMPT,
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
        self_check: { ...parts, isBaseline: true },
        reflection: reflection || null,
      })
      setHistory([row, ...history])
      setReflection('')
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  // ── 변형 실험: 한 요소만 바꿔서 다시 보내기 ────────────────────────────────
  const runExperiment = async () => {
    setExpError('')
    const trimmed = (expValue || '').trim()
    if (!trimmed) {
      setExpError(`새 [${VARIANT_LABELS.find((v) => v.key === expKey)?.label}] 값을 입력하세요.`)
      return
    }
    if (trimmed === (parts[expKey] || '')) {
      setExpError('이전과 같은 값이에요. 다른 값을 시도해보세요.')
      return
    }
    const newParts = { ...parts, [expKey]: trimmed }
    const newPrompt = composeWarmupPrompt(newParts, challenge)

    setExpLoading(true)
    try {
      const { text } = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 600,
        system: WARMUP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: newPrompt }],
      })
      const exp = {
        id: Date.now(),
        changedKey: expKey,
        oldValue: parts[expKey],
        newValue: trimmed,
        response: text,
        prompt: newPrompt,
        registered: false,
        rowId: null,
      }
      setExperiments([exp, ...experiments])
      setExpValue('')
    } catch (e) {
      setExpError(e.message || '실험 실패')
    }
    setExpLoading(false)
  }

  const registerExperiment = async (exp) => {
    if (exp.registered) return
    try {
      const newParts = { ...parts, [exp.changedKey]: exp.newValue }
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 1,
        mode: 'warmup',
        challenge_id: challenge.id,
        prompt: exp.prompt,
        output_text: exp.response,
        variant_label: exp.changedKey,
        self_check: {
          ...newParts,
          isBaseline: false,
          experiment: { changed: exp.changedKey, from: exp.oldValue, to: exp.newValue },
        },
      })
      setExperiments(experiments.map((e) => (e.id === exp.id ? { ...e, registered: true, rowId: row.id } : e)))
      setHistory([row, ...history])
    } catch (e) {
      setExpError(e.message || '등록 실패')
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

        {/* ── 우측: 위→아래 과제 흐름 (① 입력 → ② 완성 프롬프트 → ③ AI 응답) ─ */}
        <div className="col" style={{ flex: '1 1 0', minWidth: 0, gap: 20 }}>
          {/* ① 4요소 입력 */}
          <div className="card">
            <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem' }}>
                ① 4요소를 각각 입력하고 [확인] 버튼을 누르세요
              </p>
              <span
                className="small"
                style={{ color: allConfirmed ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}
              >
                {VARIANT_LABELS.filter((v) => confirmed[v.key]).length}/4 확인됨
              </span>
            </div>
            <p className="muted small" style={{ marginBottom: 14, fontSize: '0.8rem' }}>
              내용을 수정하면 확인 상태가 풀려요. 4개가 모두 확인되면 아래 [AI에게 보내기]가 활성화됩니다.
            </p>

            <div className="col" style={{ gap: 12 }}>
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

          {/* ② 완성 프롬프트 + AI에게 보내기 */}
          <div
            className="card"
            style={{
              borderLeft: '4px solid ' + (allConfirmed ? 'var(--success)' : 'var(--warning)'),
            }}
          >
            <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontWeight: 700, fontSize: '1rem' }}>② 완성 프롬프트</p>
              <span
                className="small muted"
                style={{ fontSize: '0.8rem' }}
              >
                4요소가 합쳐져 AI에게 보낼 한 덩어리
              </span>
            </div>

            <pre
              style={{
                background: 'var(--bg)',
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                fontSize: '0.9rem',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                color: 'var(--text)',
              }}
            >
              {composedPrompt}
            </pre>

            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={loading || !allConfirmed}
              style={{ width: '100%', marginTop: 14, padding: '14px', fontSize: '1rem' }}
            >
              {loading ? '생성 중...' : '🚀 AI에게 보내기'}
            </button>
            {!allConfirmed && (
              <p className="muted small" style={{ marginTop: 8, textAlign: 'center' }}>
                ① 영역의 4요소를 모두 확인하면 활성화됩니다.
              </p>
            )}
            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
          </div>

          {/* ③ AI 응답 + 관찰 메모 + 등록 */}
          {output && (
            <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 10 }}>
                ③ AI 응답
              </p>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '1rem',
                  lineHeight: 1.8,
                  padding: '14px 16px',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {output}
              </div>

              <label className="field" style={{ marginTop: 16 }}>
                <span>관찰 메모 (선택) — 이번에는 어떤 점이 잘 됐나요?</span>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={3}
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

          {/* ④ 변형 실험 — ③ 응답이 나온 후에만 표시 */}
          {output && (
            <div
              className="card"
              style={{ borderLeft: '4px solid var(--warning)' }}
            >
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                ④ 변형 실험 — 한 요소만 바꿔서 다시 보내기
              </p>
              <p className="muted small" style={{ marginBottom: 14, fontSize: '0.85rem' }}>
                같은 미션에 한 가지 요소만 바꿔보면 결과가 어떻게 달라질까요?
                기본은 <strong>맥락</strong> — 다른 요소도 골라 시도해보세요.
              </p>

              <div className="field" style={{ marginBottom: 12 }}>
                <span>어떤 요소를 바꿀까?</span>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {VARIANT_LABELS.map((v) => (
                    <button
                      key={v.key}
                      className="btn"
                      onClick={() => {
                        setExpKey(v.key)
                        setExpValue('')
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        background: expKey === v.key ? v.color : 'var(--surface2)',
                        borderColor: expKey === v.key ? v.color : 'var(--border)',
                        color: expKey === v.key ? 'white' : 'var(--text)',
                      }}
                    >
                      {expKey === v.key ? '● ' : '○ '}{v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: 10,
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.85rem',
                  marginBottom: 10,
                }}
              >
                <span className="muted">현재 </span>
                <span className={`tag ${expKey}`} style={{ marginRight: 4 }}>
                  {VARIANT_LABELS.find((v) => v.key === expKey)?.label}
                </span>
                <strong>{parts[expKey] || '(비어있음)'}</strong>
                <span className="muted"> → 새로 바꿀 값:</span>
              </div>

              <div className="row" style={{ gap: 6 }}>
                <input
                  type="text"
                  value={expValue}
                  onChange={(e) => setExpValue(e.target.value)}
                  placeholder={`새 [${VARIANT_LABELS.find((v) => v.key === expKey)?.label}] 값`}
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
                    if (e.key === 'Enter') runExperiment()
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={runExperiment}
                  disabled={expLoading || !expValue.trim()}
                  style={{ padding: '8px 16px' }}
                >
                  {expLoading ? '실험 중...' : '🔄 실험 보내기'}
                </button>
              </div>

              {(challenge.suggestions[expKey] || []).length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {challenge.suggestions[expKey].map((s) => (
                    <button
                      key={s}
                      className="btn btn-ghost"
                      onClick={() => setExpValue(s)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {expError && <p className="error" style={{ marginTop: 10 }}>{expError}</p>}
            </div>
          )}

          {/* ⑤ 실험 결과 누적 — 새 응답이 위로 쌓임 */}
          {experiments.map((exp, idx) => {
            const meta = VARIANT_LABELS.find((v) => v.key === exp.changedKey)
            return (
              <div
                key={exp.id}
                className="card"
                style={{ borderLeft: `4px solid ${meta?.color || 'var(--accent)'}` }}
              >
                <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: 700, fontSize: '1rem' }}>
                    🔬 실험 결과 #{experiments.length - idx}
                  </p>
                  <span className="muted small">
                    {meta?.label} 변경
                  </span>
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.85rem',
                    marginTop: 8,
                    marginBottom: 12,
                  }}
                >
                  <span className={`tag ${exp.changedKey}`}>{meta?.label}</span>
                  <span style={{ color: 'var(--text-muted)' }}> {exp.oldValue || '(빈값)'}</span>
                  <span style={{ margin: '0 8px' }}>→</span>
                  <strong>{exp.newValue}</strong>
                </div>

                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.95rem',
                    lineHeight: 1.8,
                    padding: '12px 14px',
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  {exp.response}
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => registerExperiment(exp)}
                  disabled={exp.registered}
                  style={{ width: '100%', marginTop: 10 }}
                >
                  {exp.registered ? '✓ 등록됨' : '📌 이 실험 갤러리에 등록'}
                </button>
              </div>
            )
          })}
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
