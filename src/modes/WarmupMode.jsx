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
  // defaults에 미리 채워진 요소(역할·출력 등)는 자동 확인 상태로 시작
  const initialConfirmed = (def) => ({
    role: !!def.role,
    context: !!def.context,
    output: !!def.output,
    condition: !!def.condition,
  })
  const [confirmed, setConfirmed] = useState(initialConfirmed(challenge.defaults))

  const [output, setOutput] = useState('')
  const [reflection, setReflection] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  // 변형 실험 (④, ⑤) — 학생이 편지에 직접 넣고 싶은 말을 자유롭게 적는 형태
  const [experiments, setExperiments] = useState([])
  // experiments: [{ id, userRequest, response, prompt, registered, rowId }, ...]
  const [expRequest, setExpRequest] = useState('')
  const [expLoading, setExpLoading] = useState(false)
  const [expError, setExpError] = useState('')

  // 챌린지 바뀌면 빌더 + 실험 모두 초기화
  useEffect(() => {
    setParts(challenge.defaults)
    setConfirmed(initialConfirmed(challenge.defaults))
    setOutput('')
    setError('')
    setExperiments([])
    setExpRequest('')
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

  // ── 변형 실험: 내가 편지에 넣고 싶은 말을 자유롭게 ────────────────────────
  const runExperiment = async () => {
    setExpError('')
    const req = (expRequest || '').trim()
    if (!req) {
      setExpError('편지에 넣고 싶은 말이나 더하고 싶은 표현을 적어주세요.')
      return
    }
    const newPrompt = `${composedPrompt}\n\n[내가 꼭 넣고 싶은 말]\n${req}`

    setExpLoading(true)
    try {
      const { text } = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 700,
        system: WARMUP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: newPrompt }],
      })
      const exp = {
        id: Date.now(),
        userRequest: req,
        response: text,
        prompt: newPrompt,
        registered: false,
        rowId: null,
      }
      setExperiments([exp, ...experiments])
      setExpRequest('')
    } catch (e) {
      setExpError(e.message || '실험 실패')
    }
    setExpLoading(false)
  }

  const registerExperiment = async (exp) => {
    if (exp.registered) return
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 1,
        mode: 'warmup',
        challenge_id: challenge.id,
        prompt: exp.prompt,
        output_text: exp.response,
        self_check: {
          ...parts,
          isBaseline: false,
          userRequest: exp.userRequest,
        },
        reflection: exp.userRequest,
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
                  placeholder={challenge.placeholders?.[v.key]}
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

          {/* ④ 내가 하고 싶은 말 더하기 — ③ 응답이 나온 후에만 표시 */}
          {output && (
            <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                ④ 내가 하고 싶은 말 더하기
              </p>
              <p className="muted small" style={{ marginBottom: 14, fontSize: '0.88rem', lineHeight: 1.7 }}>
                기본 편지를 받았다면, 이번엔 <strong>내가 미래의 나(친구)에게 진짜로 전하고 싶은 한마디</strong>를 직접 적어보세요.
                추억, 다짐, 작은 표현 무엇이든 좋아요. AI가 그 마음을 편지 안에 자연스럽게 녹여서 다시 써줍니다.
              </p>

              <textarea
                value={expRequest}
                onChange={(e) => setExpRequest(e.target.value)}
                placeholder={`예) "5월에 같이 갔던 한강 야자, 그때 네가 한 말을 꼭 떠올렸으면 좋겠어"
예) "흔들릴 때 너는 혼자가 아니라는 한 줄을 꼭 넣어줘"
예) "마지막에 우리 셋이 다시 모일 봄을 기약하는 문장으로 끝맺어줘"`}
                rows={4}
                style={{
                  width: '100%',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  lineHeight: 1.6,
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runExperiment()
                }}
              />

              <button
                className="btn btn-primary"
                onClick={runExperiment}
                disabled={expLoading || !expRequest.trim()}
                style={{ width: '100%', marginTop: 12, padding: '12px', fontSize: '0.98rem' }}
              >
                {expLoading ? '편지 다시 쓰는 중...' : '✉️ 내 말 더해서 편지 다시 받기 (Ctrl+Enter)'}
              </button>

              {expError && <p className="error" style={{ marginTop: 10 }}>{expError}</p>}

              <p className="muted small" style={{ marginTop: 10, fontSize: '0.78rem' }}>
                💡 여러 번 시도할 수 있어요. 마음에 드는 편지가 나올 때까지 다른 말을 적어 다시 받아보세요.
              </p>
            </div>
          )}

          {/* ⑤ 응답 누적 — 새 편지가 위로 쌓임 */}
          {experiments.map((exp, idx) => (
            <div
              key={exp.id}
              className="card"
              style={{ borderLeft: '4px solid var(--accent)' }}
            >
              <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                <p style={{ fontWeight: 700, fontSize: '1rem' }}>
                  💌 편지 #{experiments.length - idx}
                </p>
                <span className="muted small">
                  내가 더한 말 반영
                </span>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  borderLeft: '2px solid var(--warning)',
                  borderRadius: 4,
                  fontSize: '0.85rem',
                  marginTop: 10,
                  marginBottom: 12,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-muted)',
                }}
              >
                <strong style={{ color: 'var(--warning)' }}>💬 내가 더한 말:</strong>{' '}
                {exp.userRequest}
              </div>

              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '1rem',
                  lineHeight: 1.85,
                  padding: '14px 16px',
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
                {exp.registered ? '✓ 등록됨 — D-30에 전달됩니다' : '📌 이 편지 갤러리에 등록'}
              </button>
            </div>
          ))}
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
function PartInput({ meta, value, confirmed, suggestions, placeholder, onChange, onConfirm, onClickSuggestion }) {
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
          placeholder={placeholder || `${meta.label}을(를) 적어보세요`}
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
