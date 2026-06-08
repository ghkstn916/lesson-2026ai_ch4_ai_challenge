import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import { TOOL_CHALLENGES, TOOL_SYSTEM_PROMPT, MAX_TOOL_ROUNDS } from '../data/challenges-tool.js'
import { TOOLS_SPEC, TOOL_LABELS, TOOL_GROUPS, executeTool, resetMemo } from '../lib/tools.js'
import { callClaude } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts } from '../lib/supabase.js'

function blockToText(block) {
  if (block.type === 'text') return block.text
  return ''
}

export default function ToolMode() {
  const { studentId } = useStudentStore()
  const [stepIdx, setStepIdx] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [trace, setTrace] = useState([])
  const [finalAnswer, setFinalAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [reflection, setReflection] = useState('')
  const [obsChecks, setObsChecks] = useState({})

  const challenge = TOOL_CHALLENGES[stepIdx]
  const lastStep = TOOL_CHALLENGES.length - 1

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'tool' })
      .then(setHistory)
      .catch(() => {})
  }, [studentId])

  const myForChallenge = history.filter((h) => h.challenge_id === challenge.id)
  const doneIds = new Set(history.map((h) => h.challenge_id))

  const resetStepState = () => {
    setPrompt('')
    setTrace([])
    setFinalAnswer('')
    setReflection('')
    setError('')
    setObsChecks({})
  }

  const goStep = (i) => {
    if (i < 0 || i > lastStep) return
    setStepIdx(i)
    resetStepState()
  }

  const handleRun = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('프롬프트를 작성해주세요.')
      return
    }
    setLoading(true)
    setTrace([])
    setFinalAnswer('')
    resetMemo()

    const messages = [{ role: 'user', content: prompt }]
    const newTrace = [{ kind: 'user', text: prompt }]
    setTrace([...newTrace])

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const { raw } = await callClaude({
          model: 'claude-haiku-4-5-20251001',
          maxTokens: 1024,
          system: TOOL_SYSTEM_PROMPT,
          messages,
          tools: TOOLS_SPEC,
        })

        const assistantContent = raw.content || []
        messages.push({ role: 'assistant', content: assistantContent })

        const textParts = assistantContent.filter((b) => b.type === 'text').map(blockToText).join('').trim()
        if (textParts) {
          newTrace.push({ kind: 'thought', text: textParts })
        }

        const toolUses = assistantContent.filter((b) => b.type === 'tool_use')
        if (toolUses.length === 0) {
          setFinalAnswer(textParts)
          setTrace([...newTrace])
          break
        }

        const toolResults = []
        for (const u of toolUses) {
          let result
          let isError = false
          try {
            result = executeTool(u.name, u.input)
          } catch (err) {
            result = { error: err.message }
            isError = true
          }
          newTrace.push({ kind: 'tool', name: u.name, input: u.input, output: result, error: isError })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: u.id,
            content: JSON.stringify(result),
            is_error: isError,
          })
        }
        setTrace([...newTrace])
        messages.push({ role: 'user', content: toolResults })

        if (round === MAX_TOOL_ROUNDS - 1) {
          setError(`${MAX_TOOL_ROUNDS}단계를 넘었어요. 프롬프트를 더 명확히 해보세요.`)
        }
      }
    } catch (e) {
      setError(e.message || '오류')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setError('')
    if (trace.length === 0) {
      setError('먼저 AI에게 보내보세요.')
      return
    }
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 4,
        mode: 'tool',
        challenge_id: challenge.id,
        prompt,
        output_text: finalAnswer,
        tool_trace: trace,
        self_check: obsChecks,
        reflection: reflection || null,
      })
      setHistory([row, ...history])
      setTrace([])
      setFinalAnswer('')
      setReflection('')
      setObsChecks({})
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  return (
    <StudentLayout needKey="anthropic" title="4차시 도구">
      <ModeIntro modeKey="tool" />

      {/* 플랫폼 제공 도구 안내 (설명 포함) */}
      <div className="card-sm" style={{ marginBottom: 16 }}>
        <p className="muted small" style={{ fontWeight: 600, marginBottom: 4 }}>
          🧰 플랫폼이 미리 제공하는 도구 {Object.keys(TOOL_LABELS).length}종 — AI가 질문에 맞춰 <strong>자동으로 골라</strong> 씁니다
        </p>
        <p className="muted small" style={{ marginBottom: 8, opacity: 0.9 }}>
          🌍 이건 <strong>맛보기</strong>예요 — 실제 AI 에이전트는 웹 검색·이미지 생성·코드 실행·번역·앱/로봇 제어 등 <strong>수백 가지</strong> 도구를 씁니다. AI의 세계는 훨씬 넓어요.
        </p>
        {TOOL_GROUPS.map((g) => (
          <div key={g.title} style={{ marginTop: 10 }}>
            <p className="muted small" style={{ fontWeight: 700, margin: '0 0 4px' }}>{g.emoji} {g.title}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {g.keys.filter((k) => TOOL_LABELS[k]).map((k) => {
                const v = TOOL_LABELS[k]
                return (
                  <div key={k} className="card-sm" style={{ background: 'var(--surface2)', padding: '8px 10px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {v.emoji} {v.label} <code style={{ opacity: 0.55, fontSize: '0.84rem' }}>{k}</code>
                    </div>
                    <div className="muted" style={{ fontSize: '0.88rem', marginTop: 2, lineHeight: 1.45 }}>{v.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 단계 진행 바 */}
      <Stepper challenges={TOOL_CHALLENGES} current={stepIdx} doneIds={doneIds} onPick={goStep} />

      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        {/* 좌측: 미션 + 프롬프트 */}
        <div className="col" style={{ flex: '0 0 380px', gap: 16 }}>
          <div className="challenge">
            <p className="meta">단계 {stepIdx + 1} / {TOOL_CHALLENGES.length} · Level {challenge.level}</p>
            <h3>{challenge.emoji} {challenge.title}</h3>
            <p className="muted small" style={{ marginBottom: 10 }}>{challenge.description}</p>

            <div
              className="card-sm"
              style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)', fontSize: '0.95rem', marginBottom: 10 }}
            >
              🎯 <strong>이 단계 목표</strong> — {challenge.goal}
            </div>

            <p className="muted small" style={{ fontWeight: 600 }}>이렇게 해보세요</p>
            <ol style={{ paddingLeft: 18, lineHeight: 1.7, fontSize: '0.95rem', marginTop: 4 }}>
              {challenge.doThis.map((d, i) => (
                <li key={i} style={{ marginBottom: 2 }}>{d}</li>
              ))}
            </ol>

            <p className="muted small" style={{ fontWeight: 600, marginTop: 10 }}>예시 (클릭해 채우기)</p>
            <ul style={{ paddingLeft: 18, lineHeight: 1.7, fontSize: '0.95rem', marginTop: 4 }}>
              {challenge.seedPrompts.map((p, i) => (
                <li key={i}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPrompt(p)}
                    style={{ padding: 0, background: 'none', border: 'none', color: 'var(--accent-hover)', textAlign: 'left', fontSize: '0.95rem' }}
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>

            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {challenge.expectedTools.map((t) => (
                <span key={t} className="tag" style={{ fontSize: '0.86rem', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)' }}>
                  예상 사용: {TOOL_LABELS[t]?.emoji} {TOOL_LABELS[t]?.label}
                </span>
              ))}
            </div>

            <p className="small" style={{ color: 'var(--warning)', marginTop: 10 }}>💡 {challenge.hint}</p>
          </div>

          <div className="card">
            <label className="field">
              <span>프롬프트</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="위 예시를 클릭하거나 본인이 직접 작성"
                rows={5}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={loading || !prompt.trim()}
              style={{ width: '100%', marginTop: 10 }}
            >
              {loading ? '에이전트 동작 중...' : '🚀 에이전트 실행'}
            </button>
            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
          </div>
        </div>

        {/* 우측: 결과 + 관찰 + 등록 */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          {trace.length === 0 ? (
            <div className="card-sm muted small" style={{ textAlign: 'center', padding: 30 }}>
              왼쪽에서 프롬프트를 보내면 AI가 어떤 도구를 어떤 순서로 부르는지 여기에 표시됩니다.
            </div>
          ) : (
            <div className="card">
              <p className="muted small" style={{ marginBottom: 10 }}>🛣 호출 시퀀스</p>
              <TraceView trace={trace} />
            </div>
          )}

          {finalAnswer && (
            <div className="card" style={{ borderColor: 'var(--success)' }}>
              <p className="muted small" style={{ marginBottom: 6 }}>💬 최종 답</p>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{finalAnswer}</div>
            </div>
          )}

          {trace.length > 0 && (
            <div className="card">
              <p className="muted small" style={{ fontWeight: 600, marginBottom: 8 }}>✅ 결과에서 확인 — 체크하며 관찰</p>
              <div className="col" style={{ gap: 6 }}>
                {challenge.observe.map((o, i) => (
                  <button
                    key={i}
                    onClick={() => setObsChecks({ ...obsChecks, [i]: !obsChecks[i] })}
                    className="btn"
                    style={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      padding: '8px 10px',
                      fontSize: '0.95rem',
                      background: obsChecks[i] ? 'rgba(34,197,94,0.12)' : 'var(--surface2)',
                      borderColor: obsChecks[i] ? 'var(--success)' : 'var(--border)',
                      color: 'var(--text)',
                    }}
                  >
                    {obsChecks[i] ? '✅' : '⬜'} {o}
                  </button>
                ))}
              </div>

              <label className="field" style={{ marginTop: 12 }}>
                <span>관찰 메모 (선택)</span>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={2}
                  placeholder="예) 검색이 비어 있을 때 AI는 ___ 했다. 도구 순서는 ___ → ___ → ___ 였다."
                />
              </label>
              <button className="btn btn-primary" onClick={handleRegister} style={{ width: '100%', marginTop: 10 }}>
                📌 이 결과 갤러리에 등록
              </button>
            </div>
          )}

          {myForChallenge.length > 0 && (
            <div className="card-sm">
              <p className="muted small" style={{ marginBottom: 6 }}>이 단계 — {myForChallenge.length}회 등록 ✓</p>
              {myForChallenge.slice(0, 3).map((a) => (
                <div className="attempt" key={a.id} style={{ fontSize: '0.92rem' }}>
                  <span className="muted">{new Date(a.created_at).toLocaleTimeString()}</span>
                  <div style={{ marginTop: 4 }}>
                    {(a.tool_trace || []).filter((s) => s.kind === 'tool').map((s, i) => (
                      <span key={i} className="tag" style={{ fontSize: '0.84rem' }}>
                        {TOOL_LABELS[s.name]?.emoji} {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 단계 이동 */}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 20, gap: 10 }}>
        <button className="btn" onClick={() => goStep(stepIdx - 1)} disabled={stepIdx === 0}>
          ← 이전 단계
        </button>
        {stepIdx < lastStep ? (
          <button className="btn btn-primary" onClick={() => goStep(stepIdx + 1)}>
            다음 단계 ({TOOL_CHALLENGES[stepIdx + 1].emoji} {TOOL_CHALLENGES[stepIdx + 1].title}) →
          </button>
        ) : (
          <span className="muted small" style={{ alignSelf: 'center' }}>
            🎉 마지막 단계예요. 결과를 등록하면 4차시 완료!
          </span>
        )}
      </div>
    </StudentLayout>
  )
}

// ── 단계 진행 바 ─────────────────────────────────────────────────────────────
function Stepper({ challenges, current, doneIds, onPick }) {
  return (
    <div className="card-sm" style={{ marginBottom: 16, display: 'flex', gap: 6, alignItems: 'stretch' }}>
      {challenges.map((c, i) => {
        const active = i === current
        const done = doneIds.has(c.id)
        return (
          <button
            key={c.id}
            className="btn"
            onClick={() => onPick(i)}
            style={{
              flex: 1,
              flexDirection: 'column',
              gap: 2,
              padding: '8px 8px',
              background: active ? 'var(--accent)' : 'var(--surface2)',
              borderColor: active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--border)',
              color: active ? 'white' : 'var(--text)',
            }}
          >
            <span style={{ fontSize: '0.84rem', opacity: 0.85 }}>
              {done ? '✓ 완료' : `단계 ${i + 1}`}
            </span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {c.emoji} {c.title}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TraceView({ trace }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {trace.map((step, i) => {
        if (step.kind === 'user') {
          return (
            <Step key={i} color="#6366f1" emoji="🧑" label="사용자 질문">
              <div style={{ whiteSpace: 'pre-wrap' }}>{step.text}</div>
            </Step>
          )
        }
        if (step.kind === 'thought') {
          return (
            <Step key={i} color="#94a3b8" emoji="💭" label="AI 생각">
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{step.text}</div>
            </Step>
          )
        }
        if (step.kind === 'tool') {
          const label = TOOL_LABELS[step.name]
          return (
            <Step
              key={i}
              color={step.error ? '#ef4444' : '#22c55e'}
              emoji={label?.emoji || '🛠'}
              label={`도구 호출 — ${label?.label || step.name}`}
            >
              <div style={{ fontSize: '0.92rem' }}>
                <div className="muted">입력:</div>
                <pre style={{ background: 'var(--bg)', padding: 6, borderRadius: 4, fontSize: '0.88rem', overflowX: 'auto' }}>
                  {JSON.stringify(step.input, null, 2)}
                </pre>
                <div className="muted" style={{ marginTop: 4 }}>결과:</div>
                <pre style={{ background: 'var(--bg)', padding: 6, borderRadius: 4, fontSize: '0.88rem', overflowX: 'auto', color: step.error ? 'var(--danger)' : 'inherit' }}>
                  {JSON.stringify(step.output, null, 2)}
                </pre>
              </div>
            </Step>
          )
        }
        return null
      })}
    </div>
  )
}

function Step({ color, emoji, label, children }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12, marginLeft: 4 }}>
      <div style={{ fontSize: '0.88rem', color, fontWeight: 700, marginBottom: 4, letterSpacing: '0.02em' }}>
        {emoji} {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
