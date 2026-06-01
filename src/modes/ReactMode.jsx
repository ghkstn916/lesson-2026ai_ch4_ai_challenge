import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import {
  REACT_CHALLENGE,
  REACT_SYSTEM_PROMPT,
  PLAN_TOOLS,
  EXAMPLE_PLANS,
} from '../data/challenges-react.js'
import { TOOLS_SPEC, TOOL_LABELS, executeTool, resetMemo } from '../lib/tools.js'
import { callClaude } from '../lib/claude.js'
import {
  insertAttempt,
  fetchMyAttempts,
  upsertProjectPlan,
  fetchMyProjectPlan,
} from '../lib/supabase.js'

const MAX_ROUNDS = 10

export default function ReactMode() {
  const { studentId } = useStudentStore()
  const [tab, setTab] = useState('challenge')

  // 챌린지 상태
  const [prompt, setPrompt] = useState('')
  const [trace, setTrace] = useState([])
  const [finalAnswer, setFinalAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  // 기획서 상태
  const [plan, setPlan] = useState({
    agent_name: '',
    target_user: '',
    task_one_liner: '',
    tools_used: [],
    scenario: '',
    demo_prompt: '',
  })
  const [planSaving, setPlanSaving] = useState(false)
  const [planSavedAt, setPlanSavedAt] = useState(null)
  const [planError, setPlanError] = useState('')

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'react' }).then(setHistory).catch(() => {})
    fetchMyProjectPlan(studentId).then((p) => {
      if (p) {
        setPlan({
          agent_name: p.agent_name || '',
          target_user: p.target_user || '',
          task_one_liner: p.task_one_liner || '',
          tools_used: p.tools_used || [],
          scenario: p.scenario || '',
          demo_prompt: p.demo_prompt || '',
        })
        setPlanSavedAt(new Date(p.created_at))
      }
    })
  }, [studentId])

  // ── 챌린지 실행 ───────────────────────────────────────────────────────────
  const handleRun = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('프롬프트를 작성해주세요.')
      return
    }
    setLoading(true)
    setTrace([])
    setFinalAnswer('')

    const messages = [{ role: 'user', content: prompt }]
    const newTrace = [{ kind: 'user', text: prompt }]
    setTrace([...newTrace])

    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const { raw } = await callClaude({
          model: 'claude-haiku-4-5-20251001',
          maxTokens: 1024,
          system: REACT_SYSTEM_PROMPT,
          messages,
          tools: TOOLS_SPEC,
        })

        const assistantContent = raw.content || []
        messages.push({ role: 'assistant', content: assistantContent })

        const textParts = assistantContent.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
        if (textParts) newTrace.push({ kind: 'thought', text: textParts })

        const toolUses = assistantContent.filter((b) => b.type === 'tool_use')
        if (toolUses.length === 0) {
          setFinalAnswer(textParts)
          setTrace([...newTrace])
          break
        }

        const toolResults = []
        for (const u of toolUses) {
          let result, isError = false
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

        if (round === MAX_ROUNDS - 1) {
          setError(`${MAX_ROUNDS}단계를 넘었어요. 프롬프트의 단계를 더 명확히 해보세요.`)
        }
      }
    } catch (e) {
      setError(e.message || '오류')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (trace.length === 0) return
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 5,
        mode: 'react',
        challenge_id: REACT_CHALLENGE.id,
        prompt,
        output_text: finalAnswer,
        tool_trace: trace,
      })
      setHistory([row, ...history])
      setPrompt('')
      setTrace([])
      setFinalAnswer('')
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  // ── 기획서 저장 ───────────────────────────────────────────────────────────
  const handleSavePlan = async () => {
    setPlanError('')
    if (!plan.agent_name.trim() || !plan.task_one_liner.trim() || !plan.demo_prompt.trim()) {
      setPlanError('이름, 할 일(한 문장), 시범 프롬프트는 필수입니다.')
      return
    }
    setPlanSaving(true)
    try {
      const saved = await upsertProjectPlan({
        student_id: studentId,
        agent_name: plan.agent_name.trim(),
        target_user: plan.target_user.trim(),
        task_one_liner: plan.task_one_liner.trim(),
        tools_used: plan.tools_used,
        scenario: plan.scenario.trim(),
        demo_prompt: plan.demo_prompt.trim(),
      })
      setPlanSavedAt(new Date(saved.created_at))
    } catch (e) {
      setPlanError(e.message || '저장 실패')
    }
    setPlanSaving(false)
  }

  const loadExample = (ex) => {
    setPlan({
      agent_name: ex.agent_name,
      target_user: ex.target_user,
      task_one_liner: ex.task_one_liner,
      tools_used: [...ex.tools_used],
      scenario: ex.scenario,
      demo_prompt: ex.demo_prompt,
    })
  }

  const toggleTool = (k) => {
    const has = plan.tools_used.includes(k)
    setPlan({
      ...plan,
      tools_used: has ? plan.tools_used.filter((t) => t !== k) : [...plan.tools_used, k],
    })
  }

  return (
    <StudentLayout needKey="anthropic" title="5차시 리액트">
      <ModeIntro modeKey="react" />

      {/* 탭 */}
      <div className="card-sm" style={{ marginBottom: 16, display: 'flex', gap: 6 }}>
        {[
          { k: 'challenge', label: '🧠 리액트 챌린지 (다단계)' },
          { k: 'plan', label: '📋 내 미니 에이전트 기획서' },
        ].map((t) => (
          <button
            key={t.k}
            className="btn"
            onClick={() => setTab(t.k)}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: tab === t.k ? 'var(--accent)' : 'var(--surface2)',
              borderColor: tab === t.k ? 'var(--accent)' : 'var(--border)',
              color: tab === t.k ? 'white' : 'var(--text)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'challenge' && (
        <ChallengeTab
          prompt={prompt}
          setPrompt={setPrompt}
          trace={trace}
          finalAnswer={finalAnswer}
          loading={loading}
          error={error}
          onRun={handleRun}
          onRegister={handleRegister}
          historyCount={history.length}
        />
      )}

      {tab === 'plan' && (
        <PlanTab
          plan={plan}
          setPlan={setPlan}
          toggleTool={toggleTool}
          onSave={handleSavePlan}
          saving={planSaving}
          savedAt={planSavedAt}
          error={planError}
          loadExample={loadExample}
        />
      )}
    </StudentLayout>
  )
}

function ChallengeTab({ prompt, setPrompt, trace, finalAnswer, loading, error, onRun, onRegister, historyCount }) {
  return (
    <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div className="col" style={{ flex: '0 0 380px', gap: 16 }}>
        <div className="challenge">
          <h3>{REACT_CHALLENGE.emoji} {REACT_CHALLENGE.title}</h3>
          <p className="muted small" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>
            {REACT_CHALLENGE.description}
          </p>

          <p className="muted small" style={{ fontWeight: 600, marginTop: 12 }}>📦 단계 비계 (클릭해서 입력)</p>
          {REACT_CHALLENGE.scaffolds.map((s, i) => (
            <button
              key={i}
              className="btn"
              onClick={() => setPrompt(s.prompt)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '6px 10px',
                textAlign: 'left',
                background: 'var(--surface2)',
                fontSize: '0.85rem',
              }}
            >
              {s.label}
            </button>
          ))}

          <p className="small" style={{ marginTop: 14, color: 'var(--warning)' }}>
            💡 힌트
          </p>
          <ul className="muted small" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            {REACT_CHALLENGE.hints.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
          {historyCount > 0 && (
            <p className="muted small" style={{ marginTop: 10 }}>
              이미 {historyCount}회 등록함.
            </p>
          )}
        </div>

        <div className="card">
          <label className="field">
            <span>프롬프트</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="단계 비계를 클릭해 채우거나 본인이 작성"
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={onRun}
            disabled={loading || !prompt.trim()}
            style={{ width: '100%', marginTop: 10 }}
          >
            {loading ? '에이전트 동작 중...' : '🚀 다단계 실행 (최대 10라운드)'}
          </button>
          {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </div>

      <div className="col" style={{ flex: 1, gap: 16 }}>
        {trace.length === 0 ? (
          <div className="card-sm muted small" style={{ textAlign: 'center', padding: 30 }}>
            왼쪽에서 프롬프트를 보내면 다단계 호출 시퀀스가 여기에 표시됩니다.
          </div>
        ) : (
          <div className="card">
            <p className="muted small" style={{ marginBottom: 10 }}>🛣 ReAct 시퀀스</p>
            <TraceView trace={trace} />
          </div>
        )}

        {finalAnswer && (
          <div className="card" style={{ borderColor: 'var(--success)' }}>
            <p className="muted small" style={{ marginBottom: 6 }}>💬 최종 답</p>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{finalAnswer}</div>
            <button className="btn btn-primary" onClick={onRegister} style={{ marginTop: 12, width: '100%' }}>
              📌 갤러리에 등록
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function PlanTab({ plan, setPlan, toggleTool, onSave, saving, savedAt, error, loadExample }) {
  return (
    <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div className="col" style={{ flex: 1, gap: 14 }}>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>
            📋 내 미니 에이전트 기획서
          </h2>
          <p className="muted small" style={{ marginBottom: 16 }}>
            6차시에 발표할 본인 에이전트를 한 장으로. 마지막 저장본이 최신으로 유지됩니다.
            {savedAt && <> · 마지막 저장: {savedAt.toLocaleTimeString()}</>}
          </p>

          <div className="form">
            <label className="field">
              <span>1. 사용자 / 상황 — 누가, 어떤 상황에 쓰나?</span>
              <input
                type="text"
                value={plan.target_user}
                onChange={(e) => setPlan({ ...plan, target_user: e.target.value })}
                placeholder="예) 내일 모의고사를 앞둔 고3"
              />
            </label>

            <label className="field">
              <span>2. 에이전트 이름</span>
              <input
                type="text"
                value={plan.agent_name}
                onChange={(e) => setPlan({ ...plan, agent_name: e.target.value })}
                placeholder="예) 내일의 시간표 코치"
              />
            </label>

            <label className="field">
              <span>3. 할 일 (한 문장)</span>
              <input
                type="text"
                value={plan.task_one_liner}
                onChange={(e) => setPlan({ ...plan, task_one_liner: e.target.value })}
                placeholder="예) 오늘 점수표를 보고 내일 학습 계획을 30분 단위로 짜준다"
              />
            </label>

            <div className="field">
              <span>4. 사용할 도구 (4종 중 선택)</span>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {PLAN_TOOLS.map((t) => {
                  const on = plan.tools_used.includes(t.key)
                  return (
                    <button
                      key={t.key}
                      className="btn"
                      onClick={() => toggleTool(t.key)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        background: on ? 'var(--accent)' : 'var(--surface2)',
                        borderColor: on ? 'var(--accent)' : 'var(--border)',
                        color: on ? 'white' : 'var(--text)',
                      }}
                    >
                      {on ? '✓ ' : ''}{t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="field">
              <span>5. 작동 시나리오 (3~6단계, 글로 풀어쓰기)</span>
              <textarea
                value={plan.scenario}
                onChange={(e) => setPlan({ ...plan, scenario: e.target.value })}
                rows={5}
                placeholder={`예)\n1) 학생이 점수표 입력 → 메모에 저장\n2) 내일까지 남은 시간 계산 (date_diff)\n3) 점수 비율에 따라 30분 단위 시간표 분배 (calc)\n4) 시간표 정리`}
              />
            </label>

            <label className="field">
              <span>6. 시범 프롬프트 — 실제로 부를 때 보낼 한 문장</span>
              <textarea
                value={plan.demo_prompt}
                onChange={(e) => setPlan({ ...plan, demo_prompt: e.target.value })}
                rows={3}
                placeholder="예) 메모에 오늘 점수 저장해두고, 내일 자정까지 30분 단위 학습계획을 점수 비례로 짜줘."
              />
            </label>

            {error && <p className="error">{error}</p>}

            <button className="btn btn-primary" onClick={onSave} disabled={saving} style={{ marginTop: 6 }}>
              {saving ? '저장 중...' : savedAt ? '💾 기획서 업데이트' : '💾 기획서 저장'}
            </button>
          </div>
        </div>
      </div>

      <div className="col" style={{ flex: '0 0 280px', gap: 14 }}>
        <div className="card-sm">
          <p className="muted small" style={{ marginBottom: 8, fontWeight: 600 }}>📦 예시 (클릭해서 채우기)</p>
          {EXAMPLE_PLANS.map((ex, i) => (
            <button
              key={i}
              className="btn"
              onClick={() => loadExample(ex)}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '8px 10px',
                textAlign: 'left',
                background: 'var(--surface2)',
                fontSize: '0.85rem',
                whiteSpace: 'normal',
                lineHeight: 1.4,
              }}
            >
              <strong>{ex.agent_name}</strong>
              <div className="muted small" style={{ marginTop: 2 }}>
                {ex.target_user}
              </div>
            </button>
          ))}
        </div>

        <div
          className="card-sm"
          style={{
            background: 'rgba(99, 102, 241, 0.08)',
            borderColor: 'var(--accent)',
            fontSize: '0.82rem',
          }}
        >
          🎯 다음 차시(6차시)에 본인 기획서대로 에이전트를 작동시켜보고 발표하게 됩니다.
          교사와 1:1 순회 시간에 현실성을 같이 점검해보세요.
        </div>
      </div>
    </div>
  )
}

// ── Trace 시각화 (ToolMode와 동일 구조) ─────────────────────────────────
function TraceView({ trace }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {trace.map((step, i) => {
        if (step.kind === 'user') {
          return <Step key={i} color="#6366f1" emoji="🧑" label="사용자 질문">
            <div style={{ whiteSpace: 'pre-wrap' }}>{step.text}</div>
          </Step>
        }
        if (step.kind === 'thought') {
          return <Step key={i} color="#94a3b8" emoji="💭" label="AI 생각">
            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{step.text}</div>
          </Step>
        }
        if (step.kind === 'tool') {
          const label = TOOL_LABELS[step.name]
          return <Step
            key={i}
            color={step.error ? '#ef4444' : '#22c55e'}
            emoji={label?.emoji || '🛠'}
            label={`도구 — ${label?.label || step.name}`}
          >
            <div style={{ fontSize: '0.82rem' }}>
              <div className="muted">입력:</div>
              <pre style={{ background: 'var(--bg)', padding: 6, borderRadius: 4, fontSize: '0.78rem', overflowX: 'auto' }}>
                {JSON.stringify(step.input, null, 2)}
              </pre>
              <div className="muted" style={{ marginTop: 4 }}>결과:</div>
              <pre style={{ background: 'var(--bg)', padding: 6, borderRadius: 4, fontSize: '0.78rem', overflowX: 'auto', color: step.error ? 'var(--danger)' : 'inherit' }}>
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          </Step>
        }
        return null
      })}
    </div>
  )
}

function Step({ color, emoji, label, children }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12, marginLeft: 4 }}>
      <div style={{ fontSize: '0.78rem', color, fontWeight: 700, marginBottom: 4 }}>
        {emoji} {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
