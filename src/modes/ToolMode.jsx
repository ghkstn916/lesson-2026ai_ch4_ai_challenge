import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import { TOOL_CHALLENGES, TOOL_SYSTEM_PROMPT, MAX_TOOL_ROUNDS } from '../data/challenges-tool.js'
import { TOOLS_SPEC, TOOL_LABELS, executeTool, resetMemo } from '../lib/tools.js'
import { callClaude } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts } from '../lib/supabase.js'

function blockToText(block) {
  if (block.type === 'text') return block.text
  return ''
}

export default function ToolMode() {
  const { studentId } = useStudentStore()
  const [challenge, setChallenge] = useState(TOOL_CHALLENGES[0])
  const [prompt, setPrompt] = useState('')
  const [trace, setTrace] = useState([])       // {role, blocks, toolName?, toolInput?, toolResult?}[]
  const [finalAnswer, setFinalAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [reflection, setReflection] = useState('')

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'tool' })
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
    setTrace([])
    setFinalAnswer('')
    resetMemo()

    // Anthropic tool_use 멀티턴 루프
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

        // text 블록 모두 trace에 추가
        const textParts = assistantContent.filter((b) => b.type === 'text').map(blockToText).join('').trim()
        if (textParts) {
          newTrace.push({ kind: 'thought', text: textParts })
        }

        // tool_use 블록이 없으면 종료
        const toolUses = assistantContent.filter((b) => b.type === 'tool_use')
        if (toolUses.length === 0) {
          setFinalAnswer(textParts)
          setTrace([...newTrace])
          break
        }

        // 도구 호출 — 한 라운드에 여러 개 있을 수 있음
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
          newTrace.push({
            kind: 'tool',
            name: u.name,
            input: u.input,
            output: result,
            error: isError,
          })
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
        reflection: reflection || null,
      })
      setHistory([row, ...history])
      setPrompt('')
      setTrace([])
      setFinalAnswer('')
      setReflection('')
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  return (
    <StudentLayout needKey="anthropic" title="4차시 도구">
      <ModeIntro modeKey="tool" />

      {/* 도구 4종 안내 */}
      <div
        className="card-sm"
        style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}
      >
        <span className="muted small" style={{ marginRight: 4 }}>플랫폼이 미리 제공하는 도구:</span>
        {Object.entries(TOOL_LABELS).map(([k, v]) => (
          <span
            key={k}
            className="tag"
            style={{ padding: '4px 10px', fontSize: '0.85rem', background: 'var(--surface2)' }}
          >
            {v.emoji} {v.label} <code style={{ opacity: 0.6 }}>{k}</code>
          </span>
        ))}
      </div>

      {/* 챌린지 탭 */}
      <div className="card-sm" style={{ marginBottom: 16, display: 'flex', gap: 6 }}>
        {TOOL_CHALLENGES.map((c) => {
          const selected = challenge.id === c.id
          return (
            <button
              key={c.id}
              className="btn"
              onClick={() => {
                setChallenge(c)
                setPrompt('')
                setTrace([])
                setFinalAnswer('')
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
        {/* 좌측: 챌린지 + 프롬프트 */}
        <div className="col" style={{ flex: '0 0 360px', gap: 16 }}>
          <div className="challenge">
            <p className="meta">Level {challenge.level}</p>
            <h3>{challenge.emoji} {challenge.title}</h3>
            <p className="muted small" style={{ marginBottom: 10 }}>{challenge.description}</p>

            <p className="muted small" style={{ fontWeight: 600 }}>예시 (클릭해 채우기)</p>
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

            <div
              className="row"
              style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}
            >
              {challenge.expectedTools.map((t) => (
                <span
                  key={t}
                  className="tag"
                  style={{
                    fontSize: '0.75rem',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: 'var(--success)',
                  }}
                >
                  예상 사용: {TOOL_LABELS[t]?.emoji} {TOOL_LABELS[t]?.label}
                </span>
              ))}
            </div>

            <p className="small" style={{ color: 'var(--warning)', marginTop: 10 }}>
              💡 {challenge.hint}
            </p>
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

        {/* 우측: 호출 시퀀스 */}
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
              <label className="field">
                <span>관찰 메모 (선택)</span>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={2}
                  placeholder="예) 검색이 비어 있을 때 AI는 ___ 했다. 도구 순서는 ___ → ___ → ___ 였다."
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

          {myForChallenge.length > 0 && (
            <div className="card-sm">
              <p className="muted small" style={{ marginBottom: 6 }}>
                이 챌린지 — {myForChallenge.length}회 등록
              </p>
              {myForChallenge.slice(0, 3).map((a) => (
                <div className="attempt" key={a.id} style={{ fontSize: '0.82rem' }}>
                  <span className="muted">{new Date(a.created_at).toLocaleTimeString()}</span>
                  <div style={{ marginTop: 4 }}>
                    {(a.tool_trace || []).filter((s) => s.kind === 'tool').map((s, i) => (
                      <span key={i} className="tag" style={{ fontSize: '0.7rem' }}>
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
    </StudentLayout>
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
              <div style={{ fontSize: '0.82rem' }}>
                <div className="muted">입력:</div>
                <pre
                  style={{
                    background: 'var(--bg)',
                    padding: 6,
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    overflowX: 'auto',
                  }}
                >
                  {JSON.stringify(step.input, null, 2)}
                </pre>
                <div className="muted" style={{ marginTop: 4 }}>결과:</div>
                <pre
                  style={{
                    background: 'var(--bg)',
                    padding: 6,
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    overflowX: 'auto',
                    color: step.error ? 'var(--danger)' : 'inherit',
                  }}
                >
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
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        paddingLeft: 12,
        marginLeft: 4,
      }}
    >
      <div
        style={{
          fontSize: '0.78rem',
          color,
          fontWeight: 700,
          marginBottom: 4,
          letterSpacing: '0.02em',
        }}
      >
        {emoji} {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
