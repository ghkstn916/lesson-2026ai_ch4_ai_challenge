import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import {
  REACT_CHALLENGES,
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

const STEP_META = [
  { id: 'concept', emoji: '🧠', title: 'ReAct 이해' },
  { id: 'challenge', emoji: '🎯', title: '에이전트 실습 3종' },
  { id: 'plan', emoji: '📋', title: '내 에이전트 기획서' },
  { id: 'wrapup', emoji: '🏁', title: '마무리 점검' },
]

const OVERVIEW = {
  title: "🧭 5차시 한눈에 보기 — ReAct: AI가 '생각'과 '도구 호출'을 번갈아 하며 스스로 문제를 푼다",
  hint: '위 단계 바를 눌러 언제든 오갈 수 있어요.',
  steps: [
    { label: '❶ ReAct 이해', sub: '생각💭↔도구🛠↔결과📩가 번갈아 도는 원리를 한 장으로' },
    { label: '❷ 에이전트 실습 3종', sub: 'AI가 스스로 단계를 짜고(Lv1) → 루프+메모로 잇고(Lv2) → 메타-지시로 다루기(Lv3)' },
    { label: '❸ 내 에이전트 기획서', sub: '6차시에 발표할 미니 에이전트를 6필드 한 장으로 설계·저장' },
    { label: '❹ 마무리 점검', sub: '두 산출물(등록·저장)을 확인하고 6차시로 연결' },
  ],
}

const CONCEPT = {
  goal: "AI가 '생각(Reasoning)'과 '도구 호출(Acting)'을 번갈아 하며 한 문제를 단계로 쪼개 푼다는 ReAct의 핵심을, 그리고 AI의 '생각(Thought)'이 화면에 드러나는 의의를 한 장으로 이해한다.",
  doThis: [
    "오른쪽 'ReAct란?' 카드와 💭생각 → 🛠도구 → 📩결과 → 💭다시 생각 흐름 그림을 본다.",
    '4차시 도구와 뭐가 다른지 한 줄 비교를 읽는다 — 4차시는 내가 단계를 잘게 시켰지만, 5차시는 한 번의 프롬프트로 AI가 스스로 단계를 짜서 도구를 여러 번 이어 부른다.',
    "'예고 미니 시퀀스'를 훑어 다음 단계에서 볼 장면을 미리 그린다.",
    "다 읽었으면 아래 '이해했어요 ✓'를 눌러 챌린지로 간다.",
  ],
  observe: [
    "AI의 '생각'이 보이면 좋은 점: ① 어디서 길을 잘못 들었는지 추적 ② 다음 도구를 왜 골랐는지 근거 ③ 결과가 비거나 틀려도 스스로 방향을 고치는 게 보임.",
    "'생각↔도구↔결과'가 한 질문 안에서 5~8번 반복되는 그림을 머리에 담았다.",
  ],
  headline: 'ReAct = 생각(Reasoning) ↔ 행동(Acting)을 번갈아',
  body: "지금까지(4차시) AI는 도구를 한두 번 부르고 끝났어요. ReAct는 한 걸음 더 나아갑니다. AI가 먼저 '💭이걸 알려면 남은 날짜부터 구해야지'라고 생각(Reasoning)하고 → 📅날짜계산 도구를 부르고(Acting) → 📩결과(164일)를 받아 → 다시 '💭그럼 주말 횟수를 계산하자'라고 생각하고 → 🧮계산기를 부르는 식으로, 생각과 도구 호출을 한 질문 안에서 5~8번 번갈아 하며 큰 문제를 작은 단계로 쪼개 끝까지 풉니다. 도구를 스스로 여러 번 이어 부르기 시작하는 순간, 단순한 챗봇은 '작은 에이전트'가 됩니다.",
  analogy: "요리사가 레시피를 통째로 외워 한 번에 만드는 게 아니라, 냄비를 보며 '간이 싱겁네(생각) → 소금을 넣는다(행동) → 다시 맛본다(결과) → 이번엔 좀 짜네(생각)…'를 반복하는 것과 같아요. AI도 도구 결과를 '맛보며' 다음 행동을 그때그때 정합니다.",
  thoughtNote: "이 화면은 AI의 '생각(Thought)'을 💭로 일부러 드러내 보여줍니다. 답만 툭 나오는 게 아니라 추론 과정이 노출되니, AI가 옳게/틀리게 판단한 지점을 따라가며 프롬프트를 어떻게 고칠지 배울 수 있어요.",
  compareTitle: '4차시 도구와 뭐가 다른가요?',
  compareBody: '4차시는 내가 단계를 잘게 시켰어요. 5차시는 한 번의 프롬프트로 AI가 스스로 단계를 짜서 도구를 여러 번 이어 부릅니다.',
  previewTitle: '예고 미니 시퀀스 (다음 단계에서 볼 장면)',
  previewSeq: '💭 남은 일수부터 알아야겠다 → 📅 date_diff → 📩 164일 → 💭 매일 3시간이면 총 몇 시간? → 🧮 calc → 📩 492시간 → 💭 메모에서 점수를 불러오자 → 🗒 memo(load) …',
}

export default function ReactMode() {
  const { studentId } = useStudentStore()
  const [stepIdx, setStepIdx] = useState(0)
  const [conceptRead, setConceptRead] = useState(false)

  // 챌린지 상태
  const [prompt, setPrompt] = useState('')
  const [trace, setTrace] = useState([])
  const [finalAnswer, setFinalAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [obsChecks, setObsChecks] = useState({})
  const [reflection, setReflection] = useState('')
  const [challengeIdx, setChallengeIdx] = useState(0)
  const [savedRuns, setSavedRuns] = useState({}) // 실습(탭)별로 한 작업 보관 — 탭 전환해도 안 지워지게

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

  // 마무리
  const [takeaway, setTakeaway] = useState('')

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

  const challengeDone = history.length > 0
  const planDone = !!planSavedAt
  // 챌린지를 이미 한 학생은 개념을 거친 것으로 간주(새로고침·건너뛰기 보정)
  const doneArr = [conceptRead || challengeDone, challengeDone, planDone, challengeDone && planDone]

  const goStep = (i) => {
    if (i < 0 || i > STEP_META.length - 1) return
    setStepIdx(i)
    setError('')
  }

  const challenge = REACT_CHALLENGES[challengeIdx]
  const doneChallengeIds = new Set(history.map((h) => h.challenge_id))

  // 학습 챌린지(서브스테퍼) 이동 — prompt/trace/관찰은 비우되 memo는 유지(Lv2가 앞 단계 메모를 load)
  const goChallenge = (i) => {
    if (i < 0 || i > REACT_CHALLENGES.length - 1 || i === challengeIdx) return
    // 지금 실습에서 한 작업을 보관하고, 이동할 실습의 작업을 되살린다 (memo는 세션 내 항상 유지)
    setSavedRuns((prev) => ({ ...prev, [challengeIdx]: { prompt, trace, finalAnswer, obsChecks, reflection } }))
    const saved = savedRuns[i] || {}
    setPrompt(saved.prompt || '')
    setTrace(saved.trace || [])
    setFinalAnswer(saved.finalAnswer || '')
    setObsChecks(saved.obsChecks || {})
    setReflection(saved.reflection || '')
    setError('')
    setChallengeIdx(i)
  }

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
    if (trace.length === 0) {
      setError('먼저 AI에게 보내보세요.')
      return
    }
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 5,
        mode: 'react',
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
      setObsChecks({})
      setReflection('')
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

  const stepId = STEP_META[stepIdx].id

  return (
    <StudentLayout needKey="anthropic" title="5차시 리액트">
      <ModeIntro modeKey="react" />

      <OverviewBanner current={stepIdx} onPick={goStep} />
      <Stepper current={stepIdx} doneArr={doneArr} onPick={goStep} />

      {stepId === 'concept' && (
        <StepConcept onUnderstood={() => { setConceptRead(true); goStep(1) }} />
      )}

      {stepId === 'challenge' && (
        <StepChallenge
          challenge={challenge}
          challenges={REACT_CHALLENGES}
          challengeIdx={challengeIdx}
          goChallenge={goChallenge}
          doneChallengeIds={doneChallengeIds}
          prompt={prompt}
          setPrompt={setPrompt}
          trace={trace}
          finalAnswer={finalAnswer}
          loading={loading}
          error={error}
          onRun={handleRun}
          onRegister={handleRegister}
          obsChecks={obsChecks}
          setObsChecks={setObsChecks}
          reflection={reflection}
          setReflection={setReflection}
          myCount={history.filter((h) => h.challenge_id === challenge.id).length}
        />
      )}

      {stepId === 'plan' && (
        <StepPlan
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

      {stepId === 'wrapup' && (
        <StepWrapup
          challengeDone={challengeDone}
          planDone={planDone}
          takeaway={takeaway}
          setTakeaway={setTakeaway}
          goStep={goStep}
        />
      )}

      {/* 단계 이동 */}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 20, gap: 10 }}>
        <button className="btn" onClick={() => goStep(stepIdx - 1)} disabled={stepIdx === 0}>
          ← 이전 단계
        </button>
        {stepIdx < STEP_META.length - 1 ? (
          <button className="btn btn-primary" onClick={() => goStep(stepIdx + 1)}>
            다음 단계 ({STEP_META[stepIdx + 1].emoji} {STEP_META[stepIdx + 1].title}) →
          </button>
        ) : (
          <span className="muted small" style={{ alignSelf: 'center' }}>
            🎉 두 산출물(챌린지 등록 + 기획서 저장)을 채우면 5차시 완료!
          </span>
        )}
      </div>
    </StudentLayout>
  )
}

// ── 전체 흐름 개요 배너 ──────────────────────────────────────────────────────
function OverviewBanner({ current, onPick }) {
  return (
    <div className="card" style={{ marginBottom: 14, borderLeft: '4px solid var(--accent)' }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{OVERVIEW.title}</p>
      <p className="muted small" style={{ marginBottom: 10 }}>{OVERVIEW.hint}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {OVERVIEW.steps.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(i)}
            className="card-sm"
            style={{
              flex: '1 1 180px',
              textAlign: 'left',
              cursor: 'pointer',
              background: i === current ? 'rgba(99,102,241,0.10)' : 'var(--surface2)',
              borderColor: i === current ? 'var(--accent)' : 'var(--border)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.label}</div>
            <div className="muted small" style={{ marginTop: 2 }}>{s.sub}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 단계 진행 바 (4차시 ToolMode와 동일 패턴) ────────────────────────────────
function Stepper({ current, doneArr, onPick }) {
  return (
    <div className="card-sm" style={{ marginBottom: 16, display: 'flex', gap: 6, alignItems: 'stretch' }}>
      {STEP_META.map((s, i) => {
        const active = i === current
        const done = doneArr[i]
        const tag = done ? (i === 0 ? '읽음 ✓' : '✓ 완료') : `단계 ${i + 1}`
        return (
          <button
            key={s.id}
            className="btn"
            onClick={() => onPick(i)}
            style={{
              flex: 1,
              flexDirection: 'column',
              gap: 2,
              padding: '8px 6px',
              background: active ? 'var(--accent)' : 'var(--surface2)',
              borderColor: active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--border)',
              color: active ? 'white' : 'var(--text)',
            }}
          >
            <span style={{ fontSize: '0.84rem', opacity: 0.85 }}>{tag}</span>
            <span style={{ fontWeight: 700, fontSize: '0.86rem' }}>{s.emoji} {s.title}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── 에이전트 예시 쇼케이스 — '뭘 만들 수 있는지' 감 잡기 ──────────────────────
function AgentShowcase() {
  // 도메인별 대표 1개씩 골라 다양하게 6개
  const picks = []
  const seen = new Set()
  for (const ex of EXAMPLE_PLANS) {
    if (!seen.has(ex.domain)) {
      seen.add(ex.domain)
      picks.push(ex)
    }
    if (picks.length >= 6) break
  }
  return (
    <div className="card" style={{ marginTop: 16, borderColor: 'var(--accent)' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>🤖 에이전트로 이런 걸 만들 수 있어요</h3>
      <p className="muted small" style={{ marginTop: 4, marginBottom: 10, lineHeight: 1.7 }}>
        도구를 <strong>여러 개 이어 쓰면</strong> AI가 '작은 비서'가 됩니다. 아래는 맛보기예요 — 마음에 드는 게 있으면 <strong>❸ 기획서</strong> 단계에서 클릭해 그대로 가져다 내 에이전트로 발전시킬 수 있어요.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
        {picks.map((ex, i) => (
          <div key={i} className="card-sm" style={{ background: 'var(--surface2)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>🤖 {ex.agent_name}</div>
            <div className="muted small" style={{ marginTop: 2 }}>👤 {ex.target_user}</div>
            <div style={{ fontSize: '0.92rem', marginTop: 4, lineHeight: 1.5 }}>{ex.task_one_liner}</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 8, alignItems: 'center' }}>
              {ex.tools_used.map((t, j) => (
                <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {j > 0 && <span className="muted" style={{ fontSize: '0.82rem' }}>→</span>}
                  <span className="tag" style={{ background: 'var(--surface)', color: 'var(--text)', fontSize: '0.78rem' }}>
                    {TOOL_LABELS[t]?.emoji || '🛠'} {TOOL_LABELS[t]?.label || t}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        💡 공통점이 보이나요? 전부 <strong>한 줄 목표 → 도구를 차례로 이어 부르기</strong> 예요. 이게 에이전트예요.
      </p>
    </div>
  )
}

// ── 단계 ❶ 개념 ──────────────────────────────────────────────────────────────
function StepConcept({ onUnderstood }) {
  return (
    <>
    <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div className="col" style={{ flex: '0 0 380px', gap: 16 }}>
        <div className="challenge">
          <p className="meta">단계 1 / 4</p>
          <h3>🧠 ReAct 이해</h3>
          <div
            className="card-sm"
            style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)', fontSize: '0.95rem', margin: '8px 0 10px' }}
          >
            🎯 <strong>이 단계 목표</strong> — {CONCEPT.goal}
          </div>

          <p className="muted small" style={{ fontWeight: 600 }}>이렇게 해보세요</p>
          <ol style={{ paddingLeft: 18, lineHeight: 1.7, fontSize: '0.95rem', marginTop: 4 }}>
            {CONCEPT.doThis.map((d, i) => <li key={i} style={{ marginBottom: 2 }}>{d}</li>)}
          </ol>

          <button className="btn btn-primary" onClick={onUnderstood} style={{ width: '100%', marginTop: 14 }}>
            이해했어요 ✓ 챌린지로 →
          </button>
        </div>
      </div>

      <div className="col" style={{ flex: 1, gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>🧠 ReAct란?</h3>
          <p style={{ fontWeight: 700, color: 'var(--accent-hover)', marginTop: 4 }}>{CONCEPT.headline}</p>
          <p className="muted small" style={{ marginTop: 8, lineHeight: 1.7 }}>{CONCEPT.body}</p>

          <ConceptDiagram />

          <div className="card-sm" style={{ marginTop: 12, background: 'var(--surface2)' }}>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{CONCEPT.compareTitle}</p>
            <p className="muted small" style={{ marginTop: 4 }}>{CONCEPT.compareBody}</p>
          </div>

          <div className="card-sm" style={{ marginTop: 10 }}>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>🔮 {CONCEPT.previewTitle}</p>
            <p className="muted small" style={{ marginTop: 4, lineHeight: 1.7 }}>{CONCEPT.previewSeq}</p>
          </div>

          <p className="muted small" style={{ marginTop: 12, fontStyle: 'italic', lineHeight: 1.7 }}>
            🍳 {CONCEPT.analogy}
          </p>

          <div
            className="card-sm"
            style={{ marginTop: 12, background: 'rgba(245,158,11,0.1)', borderColor: 'var(--warning)', fontSize: '0.92rem' }}
          >
            💭 <strong>'생각'이 보이는 게 왜 중요할까?</strong> — {CONCEPT.thoughtNote}
          </div>
        </div>
      </div>
    </div>

      <AgentShowcase />
    </>
  )
}

function ConceptDiagram() {
  const nodes = [
    { e: '💭', t: '생각', c: '#94a3b8' },
    { e: '🛠', t: '도구 호출', c: '#22c55e' },
    { e: '📩', t: '결과', c: '#6366f1' },
    { e: '💭', t: '다시 생각', c: '#94a3b8' },
  ]
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {nodes.map((n, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              className="tag"
              style={{ background: n.c, color: 'white', fontSize: '0.92rem', padding: '4px 10px' }}
            >
              {n.e} {n.t}
            </span>
            {i < nodes.length - 1 && <span className="muted">→</span>}
          </span>
        ))}
        <span className="muted">↻</span>
      </div>
      <p className="muted small" style={{ marginTop: 6 }}>생각↔도구↔결과가 한 질문 안에서 5~8번 번갈아 돕니다.</p>
    </div>
  )
}

// ── 단계 ❷ 챌린지 ────────────────────────────────────────────────────────────
function StepChallenge({ challenge, challenges, challengeIdx, goChallenge, doneChallengeIds, prompt, setPrompt, trace, finalAnswer, loading, error, onRun, onRegister, obsChecks, setObsChecks, reflection, setReflection, myCount }) {
  return (
    <>
      <div className="card-sm" style={{ marginBottom: 14, display: 'flex', gap: 6, alignItems: 'stretch' }}>
        {challenges.map((c, i) => {
          const active = i === challengeIdx
          const done = doneChallengeIds.has(c.id)
          return (
            <button key={c.id} className="btn" onClick={() => goChallenge(i)}
              style={{ flex: 1, flexDirection: 'column', gap: 2, padding: '8px 6px',
                background: active ? 'var(--accent)' : 'var(--surface2)',
                borderColor: active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--border)',
                color: active ? 'white' : 'var(--text)' }}>
              <span style={{ fontSize: '0.84rem', opacity: 0.85 }}>{done ? '✓ 완료' : `Lv ${c.level}`}</span>
              <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>{c.emoji} 실습 {i + 1}</span>
            </button>
          )
        })}
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div className="col" style={{ flex: '0 0 380px', gap: 16 }}>
        <div className="challenge">
          <p className="meta">에이전트 실습 {challengeIdx + 1} / {challenges.length} · Level {challenge.level}</p>
          <h3>{challenge.emoji} {challenge.title}</h3>

          <div
            className="card-sm"
            style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)', fontSize: '0.95rem', margin: '8px 0 10px' }}
          >
            🎯 <strong>이 단계 목표</strong> — {challenge.goal}
          </div>

          <p className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{challenge.description}</p>

          <p className="muted small" style={{ fontWeight: 600, marginTop: 12 }}>📦 단계 비계 (클릭해서 입력)</p>
          {challenge.scaffolds.map((s, i) => (
            <button
              key={i}
              className="btn"
              onClick={() => setPrompt(s.prompt)}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '6px 10px', textAlign: 'left', background: 'var(--surface2)', fontSize: '0.95rem', whiteSpace: 'normal', lineHeight: 1.4 }}
            >
              {s.label}
            </button>
          ))}

          <p className="small" style={{ marginTop: 14, color: 'var(--warning)' }}>💡 힌트</p>
          <ul className="muted small" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            {challenge.hints.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
          {myCount > 0 && <p className="muted small" style={{ marginTop: 10 }}>이 실습 {myCount}회 등록함 ✓</p>}
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
          <button className="btn btn-primary" onClick={onRun} disabled={loading || !prompt.trim()} style={{ width: '100%', marginTop: 10 }}>
            {loading ? '에이전트 동작 중...' : '🚀 다단계 실행 (최대 10라운드)'}
          </button>
          {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </div>

      <div className="col" style={{ flex: 1, gap: 16 }}>
        {trace.length === 0 ? (
          <div className="card-sm muted small" style={{ textAlign: 'center', padding: 30 }}>
            왼쪽에서 프롬프트를 보내면 '생각↔도구↔결과'가 번갈아 도는 다단계 호출 시퀀스가 여기에 표시됩니다.
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
                placeholder="예) 도구 순서는 ___ → ___ → ___ 였다. 생각 단계는 ___ 부분에서 보였다."
              />
            </label>
            <button className="btn btn-primary" onClick={onRegister} style={{ width: '100%', marginTop: 10 }}>
              📌 이 결과 갤러리에 등록
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

// ── 단계 ❸ 기획서 ────────────────────────────────────────────────────────────
function StepPlan({ plan, setPlan, toggleTool, onSave, saving, savedAt, error, loadExample }) {
  const [exDomain, setExDomain] = useState('all')
  const DOMAIN_LABELS = { all: '🌐 전체', study: '📚 공부', 'daily-life': '🏠 생활', creative: '🎨 창작', data: '📊 데이터', coding: '💻 코딩', 'info-school': '🎓 진로·정보' }
  const exDomains = ['all', ...Array.from(new Set(EXAMPLE_PLANS.map((e) => e.domain)))]
  const shownExamples = exDomain === 'all' ? EXAMPLE_PLANS : EXAMPLE_PLANS.filter((e) => e.domain === exDomain)
  return (
    <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div className="col" style={{ flex: 1, gap: 14 }}>
        <div className="card">
          <p className="meta">단계 3 / 4</p>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>📋 내 미니 에이전트 기획서</h2>
          <p className="muted small" style={{ marginBottom: 16 }}>
            6차시에 이 기획서대로 발표할 본인 에이전트를 한 장으로. 마지막 저장본이 최신으로 유지됩니다.
            {savedAt && <> · 마지막 저장: {savedAt.toLocaleTimeString()}</>}
          </p>

          <div className="form">
            <label className="field">
              <span>1. 사용자 / 상황 — 누가, 어떤 상황에 쓰나?</span>
              <input type="text" value={plan.target_user} onChange={(e) => setPlan({ ...plan, target_user: e.target.value })} placeholder="예) 내일 모의고사를 앞둔 고3" />
            </label>
            <label className="field">
              <span>2. 에이전트 이름</span>
              <input type="text" value={plan.agent_name} onChange={(e) => setPlan({ ...plan, agent_name: e.target.value })} placeholder="예) 내일의 시간표 코치" />
            </label>
            <label className="field">
              <span>3. 할 일 (한 문장)</span>
              <input type="text" value={plan.task_one_liner} onChange={(e) => setPlan({ ...plan, task_one_liner: e.target.value })} placeholder="예) 오늘 점수표를 보고 내일 학습 계획을 30분 단위로 짜준다" />
            </label>

            <div className="field">
              <span>4. 사용할 도구 (필요한 것 골라 담기 · 2~4개 권장)</span>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {PLAN_TOOLS.map((t) => {
                  const on = plan.tools_used.includes(t.key)
                  return (
                    <button
                      key={t.key}
                      className="btn"
                      onClick={() => toggleTool(t.key)}
                      style={{ padding: '6px 12px', fontSize: '0.95rem', background: on ? 'var(--accent)' : 'var(--surface2)', borderColor: on ? 'var(--accent)' : 'var(--border)', color: on ? 'white' : 'var(--text)' }}
                    >
                      {on ? '✓ ' : ''}{t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="field">
              <span>5. 작동 시나리오 (3~6단계, '생각→도구→결과'가 보이게 단계로 끊어 쓰기)</span>
              <textarea
                value={plan.scenario}
                onChange={(e) => setPlan({ ...plan, scenario: e.target.value })}
                rows={5}
                placeholder={`예)\n1) 학생이 점수표 입력 → 메모에 저장\n2) 내일까지 남은 시간 계산 (date_diff)\n3) 점수 낮은 과목 비중↑ 30분 단위 분배 (calc)\n4) 시간표 정리`}
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
        <div className="card-sm" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <p className="muted small" style={{ marginBottom: 8, fontWeight: 600 }}>📦 예시 에이전트 {EXAMPLE_PLANS.length}개 (클릭해서 채우기)</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {exDomains.map((d) => (
              <button key={d} className="btn" onClick={() => setExDomain(d)}
                style={{ padding: '3px 9px', fontSize: '0.82rem',
                  background: exDomain === d ? 'var(--accent)' : 'var(--surface2)',
                  borderColor: exDomain === d ? 'var(--accent)' : 'var(--border)',
                  color: exDomain === d ? 'white' : 'var(--text)' }}>
                {DOMAIN_LABELS[d] || d}
              </button>
            ))}
          </div>
          {shownExamples.map((ex, i) => (
            <button
              key={i}
              className="btn"
              onClick={() => loadExample(ex)}
              style={{ width: '100%', marginTop: 6, padding: '8px 10px', textAlign: 'left', background: 'var(--surface2)', fontSize: '0.95rem', whiteSpace: 'normal', lineHeight: 1.4 }}
            >
              <strong>{ex.agent_name}</strong>
              <div className="muted small" style={{ marginTop: 2 }}>{ex.target_user}</div>
            </button>
          ))}
        </div>

        <div className="card-sm" style={{ background: 'rgba(99, 102, 241, 0.08)', borderColor: 'var(--accent)', fontSize: '0.92rem' }}>
          🎯 다음 차시(6차시)에 본인 기획서대로 에이전트를 작동시켜보고 발표하게 됩니다. 교사와 1:1 순회 시간에 현실성을 같이 점검해보세요.
        </div>
      </div>
    </div>
  )
}

// ── 단계 ❹ 마무리 점검 ───────────────────────────────────────────────────────
function StepWrapup({ challengeDone, planDone, takeaway, setTakeaway, goStep }) {
  const allDone = challengeDone && planDone
  const Row = ({ done, label, gotoIdx }) => (
    <div
      className="row"
      style={{ justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--radius)', background: done ? 'rgba(34,197,94,0.10)' : 'var(--surface2)', border: `1px solid ${done ? 'var(--success)' : 'var(--border)'}` }}
    >
      <span style={{ fontWeight: 600 }}>{done ? '✅' : '⬜'} {label}</span>
      {!done && (
        <button className="btn" onClick={() => goStep(gotoIdx)} style={{ padding: '4px 12px', fontSize: '0.92rem' }}>
          바로가기 →
        </button>
      )}
    </div>
  )
  return (
    <div className="col" style={{ gap: 16, maxWidth: 720 }}>
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>🏁 마무리 점검 & 회수</h3>
        <p className="muted small" style={{ marginBottom: 12 }}>오늘 만든 두 산출물이 모두 저장됐는지 확인하고 5차시를 닫습니다. (자동 연동 — 등록·저장하면 ✓)</p>
        <div className="col" style={{ gap: 8 }}>
          <Row done={challengeDone} label="❷ 에이전트 실습 1건 이상 등록" gotoIdx={1} />
          <Row done={planDone} label="❸ 미니 에이전트 기획서 6필드 저장" gotoIdx={2} />
        </div>
        {allDone && (
          <div className="card-sm" style={{ marginTop: 12, background: 'rgba(34,197,94,0.12)', borderColor: 'var(--success)', fontWeight: 600 }}>
            🎉 두 산출물 완성 — 5차시 완료!
          </div>
        )}
      </div>

      <div className="card">
        <label className="field">
          <span>오늘 들고 갈 한 가지 (한 줄로 적어보기)</span>
          <textarea
            value={takeaway}
            onChange={(e) => setTakeaway(e.target.value)}
            rows={2}
            placeholder="ReAct = 생각(Reasoning) + 도구 호출(Acting)을 번갈아 — 내 말로 다시 적어보기"
          />
        </label>
      </div>

      <div className="card-sm" style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)', fontSize: '0.95rem' }}>
        📅 <strong>6차시 예고</strong> — 다음 시간엔 이 기획서대로 내 에이전트를 실제로 작동시켜 발표합니다.
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
        }
        return null
      })}
    </div>
  )
}

function Step({ color, emoji, label, children }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12, marginLeft: 4 }}>
      <div style={{ fontSize: '0.88rem', color, fontWeight: 700, marginBottom: 4 }}>
        {emoji} {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
