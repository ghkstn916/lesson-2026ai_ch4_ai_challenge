import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import {
  RECAP,
  DISCUSSION_QUESTIONS,
  PROJECT_REGISTER_HINT,
  PORTFOLIO_MODES,
  PORTFOLIO_HINT,
} from '../data/challenges-project.js'
import { MODE_BY_KEY } from '../data/modes.js'
import { REACT_SYSTEM_PROMPT } from '../data/challenges-react.js'
import { TOOLS_SPEC, TOOL_LABELS, executeTool, resetMemo } from '../lib/tools.js'
import { callClaude } from '../lib/claude.js'
import {
  insertAttempt,
  fetchMyAttempts,
  fetchMyProjectPlan,
  fetchClassProjectAttempts,
  fetchCommentsForAttempts,
  addGalleryComment,
  fetchMyCommentCount,
} from '../lib/supabase.js'

const MAX_ROUNDS = 10
const DISCUSSION_ID = 'discussion-board'
// 발표(에이전트 데모)가 아닌 항목들 — 갤러리 작품 목록에서 제외
const NON_DEMO_IDS = new Set([DISCUSSION_ID, 'discussion-memo', 'portfolio'])

// created_at 내림차순 목록에서 작성자별 최신 1건만 남긴다.
function latestByAuthor(list) {
  const seen = new Set()
  const out = []
  for (const a of list) {
    const k = a.student?.id
    if (k && !seen.has(k)) {
      seen.add(k)
      out.push(a)
    }
  }
  return out
}

export default function ProjectMode() {
  const { studentId, sessionId } = useStudentStore()
  const [tab, setTab] = useState('present')

  // 발표용 상태
  const [planLoaded, setPlanLoaded] = useState(null)
  const [demoPrompt, setDemoPrompt] = useState('')
  const [trace, setTrace] = useState([])
  const [finalAnswer, setFinalAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  // 학급 전체 공유 상태 (갤러리·공개 토론 공용)
  const [classAttempts, setClassAttempts] = useState([])
  const [comments, setComments] = useState({})  // {attemptId: [...]}
  const [myCommentCount, setMyCommentCount] = useState(0)
  const [classLoading, setClassLoading] = useState(false)
  const [classLoaded, setClassLoaded] = useState(false)
  const [classErr, setClassErr] = useState('')

  // 공개 토론 — 내 답변
  const [discAnswers, setDiscAnswers] = useState({ career: '', mechanism: '' })
  const [discSaving, setDiscSaving] = useState(false)
  const [discSavedAt, setDiscSavedAt] = useState(null)
  const [discErr, setDiscErr] = useState('')

  // ── 초기 로드 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'project' })
      .then((rows) => {
        const list = rows || []
        setHistory(list.filter((a) => !NON_DEMO_IDS.has(a.challenge_id)))
        // 내 기존 공개 토론 답변 복원
        const mine = list.find((a) => a.challenge_id === DISCUSSION_ID)
        if (mine?.tool_trace) {
          setDiscAnswers({ career: mine.tool_trace.career || '', mechanism: mine.tool_trace.mechanism || '' })
          setDiscSavedAt(new Date(mine.created_at))
        }
      })
      .catch(() => {})

    fetchMyProjectPlan(studentId).then((p) => {
      setPlanLoaded(p)
      if (p?.demo_prompt) setDemoPrompt(p.demo_prompt)
    })

    fetchMyCommentCount(studentId).then(setMyCommentCount).catch(() => {})
  }, [studentId])

  // 학급 전체 project 시도 로드 (갤러리·토론 공용). 탭 진입 시 1회.
  const loadClass = async () => {
    setClassLoading(true)
    setClassErr('')
    try {
      const attempts = await fetchClassProjectAttempts(sessionId)
      setClassAttempts(attempts)
      const demoIds = attempts.filter((a) => !NON_DEMO_IDS.has(a.challenge_id)).map((a) => a.id)
      const cmts = await fetchCommentsForAttempts(demoIds)
      const grouped = {}
      for (const c of cmts) {
        if (!grouped[c.attempt_id]) grouped[c.attempt_id] = []
        grouped[c.attempt_id].push(c)
      }
      setComments(grouped)
      setClassLoaded(true)
    } catch (e) {
      setClassErr(e.message || '학급 데이터를 불러오지 못했어요. 새로고침해보세요.')
    }
    setClassLoading(false)
  }

  useEffect(() => {
    if ((tab === 'gallery' || tab === 'discussion') && sessionId && studentId && !classLoaded && !classLoading) {
      loadClass()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── 본인 에이전트 실행 (multi-turn) ────────────────────────────────────────
  const handleRun = async () => {
    setError('')
    if (!demoPrompt.trim()) {
      setError('시범 프롬프트를 작성해주세요.')
      return
    }
    setLoading(true)
    setTrace([])
    setFinalAnswer('')
    resetMemo()

    const messages = [{ role: 'user', content: demoPrompt }]
    const newTrace = [{ kind: 'user', text: demoPrompt }]
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
        session_number: 6,
        mode: 'project',
        challenge_id: planLoaded?.agent_name || 'my-agent',
        prompt: demoPrompt,
        output_text: finalAnswer,
        tool_trace: trace,
      })
      setHistory([row, ...history])
      setClassLoaded(false) // 다음 갤러리 진입 시 내 새 발표 반영
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  const handleComment = async (attemptId, content) => {
    if (!content.trim()) return
    try {
      const c = await addGalleryComment({
        attemptId,
        authorId: studentId,
        content: content.trim(),
      })
      setComments({ ...comments, [attemptId]: [...(comments[attemptId] || []), c] })
      setMyCommentCount(myCommentCount + 1)
    } catch (e) {
      alert(e.message || '코멘트 실패')
    }
  }

  // ── 공개 토론 게시 ─────────────────────────────────────────────────────────
  const handlePostDiscussion = async () => {
    setDiscErr('')
    if (!discAnswers.career.trim() && !discAnswers.mechanism.trim()) {
      setDiscErr('한 문항 이상 적어주세요.')
      return
    }
    setDiscSaving(true)
    try {
      await insertAttempt({
        student_id: studentId,
        session_number: 6,
        mode: 'project',
        challenge_id: DISCUSSION_ID,
        prompt: '[공개 토론]',
        output_text: '',
        tool_trace: { career: discAnswers.career.trim(), mechanism: discAnswers.mechanism.trim() },
        reflection: `[진로 관점]\n${discAnswers.career}\n\n[메커니즘 회수]\n${discAnswers.mechanism}`,
        is_public: true,
      })
      setDiscSavedAt(new Date())
      setClassLoaded(false)
      await loadClass() // 보드에 내 글 반영
    } catch (e) {
      setDiscErr(e.message || '게시 실패')
    }
    setDiscSaving(false)
  }

  return (
    <StudentLayout needKey="anthropic" title="6차시 프로젝트">
      <ModeIntro modeKey="project" />

      {/* 단원 회수 카드 */}
      <RecapCard />

      {/* 탭 */}
      <div className="card-sm" style={{ marginBottom: 16, display: 'flex', gap: 6 }}>
        {[
          { k: 'present', label: '🎤 내 에이전트 발표' },
          { k: 'gallery', label: '🖼 갤러리 + 코멘트' },
          { k: 'discussion', label: '💬 공개 토론' },
          { k: 'portfolio', label: '📁 포트폴리오' },
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

      {tab === 'present' && (
        <PresentTab
          plan={planLoaded}
          demoPrompt={demoPrompt}
          setDemoPrompt={setDemoPrompt}
          trace={trace}
          finalAnswer={finalAnswer}
          loading={loading}
          error={error}
          onRun={handleRun}
          onRegister={handleRegister}
          history={history}
        />
      )}

      {tab === 'gallery' && (
        <GalleryTab
          attempts={classAttempts.filter((a) => !NON_DEMO_IDS.has(a.challenge_id))}
          comments={comments}
          studentId={studentId}
          loading={classLoading}
          onComment={handleComment}
          myCommentCount={myCommentCount}
          onReload={() => { setClassLoaded(false); loadClass() }}
          error={classErr}
        />
      )}

      {tab === 'discussion' && (
        <DiscussionTab
          answers={discAnswers}
          setAnswers={setDiscAnswers}
          onPost={handlePostDiscussion}
          saving={discSaving}
          savedAt={discSavedAt}
          error={discErr}
          posts={latestByAuthor(classAttempts.filter((a) => a.challenge_id === DISCUSSION_ID))}
          loading={classLoading}
          loadError={classErr}
          studentId={studentId}
        />
      )}

      {tab === 'portfolio' && <PortfolioTab studentId={studentId} />}
    </StudentLayout>
  )
}

// ── 단원 회수 카드 ──────────────────────────────────────────────────────────
function RecapCard() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--success)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontWeight: 700 }}>🌳 단원 전체 회수 — 1차시부터 5차시까지의 한 줄</p>
        <button className="btn btn-ghost" onClick={() => setOpen(!open)} style={{ fontSize: '0.9rem' }}>
          {open ? '접기' : '펼치기'}
        </button>
      </div>
      {open && (
        <div className="col" style={{ gap: 6, marginTop: 10 }}>
          {RECAP.map((r) => (
            <div key={r.n} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span
                style={{
                  flex: '0 0 26px',
                  background: 'var(--surface2)',
                  borderRadius: 13,
                  textAlign: 'center',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                }}
              >
                {r.n}
              </span>
              <span style={{ flex: '0 0 80px', fontWeight: 600, color: 'var(--accent-hover)' }}>
                {r.key}
              </span>
              <span className="muted small" style={{ flex: 1 }}>
                {r.take}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 발표 탭 ──────────────────────────────────────────────────────────────
function PresentTab({ plan, demoPrompt, setDemoPrompt, trace, finalAnswer, loading, error, onRun, onRegister, history }) {
  return (
    <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div className="col" style={{ flex: '0 0 360px', gap: 16 }}>
        {plan ? (
          <div className="card-sm">
            <p className="muted small" style={{ marginBottom: 4 }}>5차시 기획서</p>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{plan.agent_name}</h3>
            <p className="muted small" style={{ marginTop: 4 }}>
              <strong>대상:</strong> {plan.target_user || '—'}
            </p>
            <p className="muted small">
              <strong>할 일:</strong> {plan.task_one_liner}
            </p>
            <div style={{ marginTop: 8 }}>
              {(plan.tools_used || []).map((t) => (
                <span key={t} className="tag" style={{ fontSize: '0.84rem' }}>
                  {TOOL_LABELS[t]?.emoji} {TOOL_LABELS[t]?.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="card-sm"
            style={{ color: 'var(--warning)', background: 'rgba(245,158,11,0.1)' }}
          >
            ⚠️ 5차시 기획서가 비어 있어요. <Link to="/student/react">5차시</Link>에서 먼저 기획서를 저장해주세요.
          </div>
        )}

        <div className="card">
          <p className="muted small" style={{ marginBottom: 8 }}>{PROJECT_REGISTER_HINT}</p>
          <label className="field">
            <span>시범 프롬프트 (수정 가능)</span>
            <textarea
              value={demoPrompt}
              onChange={(e) => setDemoPrompt(e.target.value)}
              rows={5}
              placeholder="5차시 기획서의 시범 프롬프트가 자동으로 들어옵니다"
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={onRun}
            disabled={loading || !demoPrompt.trim()}
            style={{ width: '100%', marginTop: 10 }}
          >
            {loading ? '에이전트 동작 중...' : '🎤 내 에이전트 실행'}
          </button>
          {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
        </div>

        {history.length > 0 && (
          <div className="card-sm">
            <p className="muted small">발표 등록 — {history.length}회</p>
            {history.slice(0, 3).map((a) => (
              <div className="attempt" key={a.id} style={{ fontSize: '0.92rem' }}>
                <span className="muted">{new Date(a.created_at).toLocaleTimeString()}</span>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {a.prompt.slice(0, 80)}{a.prompt.length > 80 && '...'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="col" style={{ flex: 1, gap: 16 }}>
        {trace.length === 0 ? (
          <div className="card-sm muted small" style={{ textAlign: 'center', padding: 30 }}>
            기획서의 시범 프롬프트를 실행해보세요. 결과 시퀀스가 여기에 표시됩니다.
          </div>
        ) : (
          <div className="card">
            <p className="muted small" style={{ marginBottom: 10 }}>🛣 에이전트 호출 시퀀스</p>
            <TraceView trace={trace} />
          </div>
        )}

        {finalAnswer && (
          <div className="card" style={{ borderColor: 'var(--success)' }}>
            <p className="muted small">💬 최종 답</p>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', marginTop: 6 }}>{finalAnswer}</div>
            <button className="btn btn-primary" onClick={onRegister} style={{ marginTop: 12, width: '100%' }}>
              📌 갤러리에 발표 등록
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 갤러리 탭 (학급 작품 둘러보기 + 코멘트) ──────────────────────────────────
function GalleryTab({ attempts, comments, studentId, loading, onComment, myCommentCount, onReload, error }) {
  const [drafts, setDrafts] = useState({})

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div
          className="card-sm"
          style={{ flex: 1, background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)', fontSize: '0.88rem' }}
        >
          🖼 학급 친구들이 만든 에이전트를 둘러보고 코멘트를 남겨요 — 내 코멘트 <strong>{myCommentCount}</strong>개 / 권장 3개 이상
        </div>
        <button className="btn" onClick={onReload} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
          {loading ? '불러오는 중...' : '🔄 새로고침'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && attempts.length === 0 && <p className="muted small">학급 작품을 불러오는 중...</p>}
      {!loading && attempts.length === 0 && (
        <p className="muted small">아직 등록된 발표 작품이 없어요. 친구들이 등록하면 여기에 보입니다. (🔄 새로고침)</p>
      )}

      <div className="col" style={{ gap: 12 }}>
        {attempts.map((a) => {
          const myCmt = comments[a.id] || []
          const draft = drafts[a.id] || ''
          const isMine = a.student?.id === studentId
          return (
            <div className="card" key={a.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700 }}>
                  {a.student?.student_number} {a.student?.name}
                  {isMine && <span className="tag" style={{ marginLeft: 6 }}>나</span>}
                </span>
                <span className="muted small">{new Date(a.created_at).toLocaleString()}</span>
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>
                <strong>시범 프롬프트:</strong> {a.prompt.slice(0, 160)}{a.prompt.length > 160 && '...'}
              </div>
              {a.output_text && (
                <div style={{ marginTop: 6, fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>
                  <strong>최종 답:</strong> {a.output_text.slice(0, 200)}{a.output_text.length > 200 && '...'}
                </div>
              )}
              {a.tool_trace && (
                <div style={{ marginTop: 6 }}>
                  {a.tool_trace.filter((s) => s.kind === 'tool').map((s, i) => (
                    <span key={i} className="tag" style={{ fontSize: '0.84rem' }}>
                      {TOOL_LABELS[s.name]?.emoji} {s.name}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 10, padding: 10, background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                <p className="muted small" style={{ marginBottom: 6 }}>💭 코멘트</p>
                {myCmt.length === 0 && <p className="muted small">아직 코멘트가 없어요.</p>}
                {myCmt.map((c) => (
                  <div key={c.id} style={{ fontSize: '0.95rem', marginTop: 4 }}>
                    <strong>{c.author?.name}:</strong> {c.content}
                  </div>
                ))}

                {!isMine && (
                  <div className="row" style={{ marginTop: 8, gap: 6 }}>
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })}
                      placeholder="좋았던 점·아이디어·궁금한 점..."
                      style={{
                        flex: 1,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '6px 10px',
                        color: 'var(--text)',
                        fontSize: '0.95rem',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onComment(a.id, draft)
                          setDrafts({ ...drafts, [a.id]: '' })
                        }
                      }}
                    />
                    <button
                      className="btn"
                      onClick={() => {
                        onComment(a.id, draft)
                        setDrafts({ ...drafts, [a.id]: '' })
                      }}
                      disabled={!draft.trim()}
                      style={{ padding: '6px 12px', fontSize: '0.95rem' }}
                    >
                      등록
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 공개 토론 탭 (학급 전체가 글을 올리고 서로 읽는 보드) ─────────────────────
function DiscussionTab({ answers, setAnswers, onPost, saving, savedAt, error, posts, loading, loadError, studentId }) {
  return (
    <div className="col" style={{ gap: 16 }}>
      <div
        className="card-sm"
        style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)', fontSize: '0.88rem' }}
      >
        💬 <strong>공개 토론</strong> — 아래 두 질문에 내 생각을 적어 <strong>게시</strong>하면 학급 전체가 서로의 글을 읽을 수 있어요.
        다른 친구들의 글도 같이 살펴보고, 생각이 바뀌면 다시 게시해도 됩니다.
      </div>

      {/* 내 답변 작성 */}
      <div className="col" style={{ gap: 12 }}>
        {DISCUSSION_QUESTIONS.map((q) => (
          <div key={q.id} className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>{q.title}</h3>
            <p className="muted small" style={{ marginBottom: 10 }}>{q.prompt}</p>
            <textarea
              value={answers[q.id]}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              rows={4}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '8px 10px',
                color: 'var(--text)',
                fontSize: '0.92rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              placeholder="내 생각을 적어보기 (게시하면 학급 전체에 공개)"
            />
          </div>
        ))}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" onClick={onPost} disabled={saving}>
          {saving ? '게시 중...' : savedAt ? `🔁 다시 게시 (마지막: ${savedAt.toLocaleTimeString()})` : '📣 학급에 게시'}
        </button>
      </div>

      {/* 공개 보드 */}
      <div className="col" style={{ gap: 12 }}>
        <p style={{ fontWeight: 700 }}>
          🗣 학급 공개 토론 보드 {loading && <span className="muted small">· 불러오는 중...</span>}
        </p>
        {loadError && <p className="error">{loadError}</p>}
        {DISCUSSION_QUESTIONS.map((q) => {
          const qPosts = posts.filter((p) => (p.tool_trace?.[q.id] || '').trim())
          return (
            <div key={q.id} className="card">
              <p style={{ fontWeight: 700, marginBottom: 8 }}>
                {q.title} <span className="muted small">· {qPosts.length}명 참여</span>
              </p>
              {qPosts.length === 0 && <p className="muted small">아직 게시된 글이 없어요.</p>}
              <div className="col" style={{ gap: 8 }}>
                {qPosts.map((p) => {
                  const mine = p.student?.id === studentId
                  return (
                    <div key={p.id} style={{ borderLeft: `3px solid ${mine ? 'var(--accent)' : 'var(--border)'}`, paddingLeft: 10 }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                        {p.student?.student_number} {p.student?.name}
                        {mine && <span className="tag" style={{ marginLeft: 6 }}>나</span>}
                      </div>
                      <div className="muted small" style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>
                        {p.tool_trace[q.id]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 포트폴리오 탭 (베스트 작품 1개 + 자기 설명, 수행평가 30%) ────────────────
function PortfolioTab({ studentId }) {
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [explanation, setExplanation] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId })
      .then((all) => {
        const list = all || []
        // 1~4차시(워밍업·시각화·이미지·도구) 작품만
        setWorks(list.filter((a) => PORTFOLIO_MODES.includes(a.mode)))
        // 기존 포트폴리오가 있으면 복원
        const existing = list.find((a) => a.mode === 'project' && a.challenge_id === 'portfolio')
        if (existing) {
          setExplanation(existing.reflection || '')
          setSavedAt(new Date(existing.created_at))
          if (existing.tool_trace?.selected_attempt_id) {
            setSelectedId(existing.tool_trace.selected_attempt_id)
          }
        }
      })
      .catch((e) => setErr(e.message || '작품 로드 실패'))
      .finally(() => setLoading(false))
  }, [studentId])

  const selected = works.find((w) => w.id === selectedId)

  const save = async () => {
    setErr('')
    if (!selectedId) {
      setErr('베스트 작품을 1개 선택해주세요.')
      return
    }
    if (!explanation.trim()) {
      setErr('자기 설명을 한 단락 적어주세요.')
      return
    }
    setSaving(true)
    try {
      await insertAttempt({
        student_id: studentId,
        session_number: 6,
        mode: 'project',
        challenge_id: 'portfolio',
        prompt: `[포트폴리오 선택] ${selected.session_number}차시 ${MODE_BY_KEY[selected.mode]?.title || selected.mode} / ${selected.challenge_id}`,
        output_text: selected.output_text || '',
        output_blob_url: selected.output_blob_url || null,
        reflection: explanation,
        tool_trace: { selected_attempt_id: selectedId },
        is_public: false,
      })
      setSavedAt(new Date())
    } catch (e) {
      setErr(e.message || '저장 실패')
    }
    setSaving(false)
  }

  if (loading) return <p className="muted">내 작품 불러오는 중...</p>

  return (
    <div className="col" style={{ gap: 14 }}>
      <div
        className="card-sm"
        style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)', fontSize: '0.9rem' }}
      >
        📁 {PORTFOLIO_HINT}
      </div>

      {works.length === 0 ? (
        <div className="card muted small">
          아직 1~4차시 작품이 없어요. 워밍업·시각화·이미지·도구 차시에서 작품을 먼저 등록한 뒤 골라보세요.
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          <p className="muted small">① 베스트 작품 1개 선택 ({works.length}개 중)</p>
          {works.map((w) => {
            const picked = w.id === selectedId
            const modeTitle = MODE_BY_KEY[w.mode]?.title || w.mode
            return (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className="card"
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: picked ? 'var(--accent)' : 'var(--border)',
                  borderWidth: picked ? 2 : 1,
                  background: picked ? 'rgba(99,102,241,0.06)' : 'var(--surface)',
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700 }}>
                    {picked ? '🔘' : '⚪'} {w.session_number}차시 · {modeTitle}
                  </span>
                  <span className="muted small">{new Date(w.created_at).toLocaleString()}</span>
                </div>
                {w.output_blob_url ? (
                  <img
                    src={w.output_blob_url}
                    alt="작품"
                    style={{ maxWidth: 180, marginTop: 8, borderRadius: 'var(--radius)' }}
                  />
                ) : (
                  <div className="muted small" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
                    {(w.output_text || w.prompt || '').slice(0, 160)}
                    {(w.output_text || w.prompt || '').length > 160 && '...'}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="card">
        <label className="field">
          <span>② 자기 설명 — 왜 이 작품을 골랐는지, 어떤 프롬프트 전략을 썼는지 (한 단락)</span>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={5}
            placeholder="예) 이미지 차시의 '수험생의 책상'을 골랐다. 스튜디오 라이팅과 구도를 구체적으로 지시했더니..."
          />
        </label>
        {err && <p className="error" style={{ marginTop: 8 }}>{err}</p>}
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: 10 }}>
          {saving ? '저장 중...' : savedAt ? `💾 다시 저장 (마지막: ${savedAt.toLocaleTimeString()})` : '💾 포트폴리오 제출'}
        </button>
      </div>
    </div>
  )
}

// ── Trace 시각화 (재사용) ───────────────────────────────────────────────
function TraceView({ trace }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {trace.map((step, i) => {
        if (step.kind === 'user') {
          return <Step key={i} color="#6366f1" emoji="🧑" label="질문">
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
              <pre style={{ background: 'var(--bg)', padding: 6, borderRadius: 4, fontSize: '0.88rem', overflowX: 'auto' }}>
                {JSON.stringify(step.input, null, 2)}
              </pre>
              <pre style={{ background: 'var(--bg)', padding: 6, borderRadius: 4, fontSize: '0.88rem', overflowX: 'auto', marginTop: 4 }}>
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
