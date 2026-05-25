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
  const initialConfirmed = (def) => ({
    role: !!def.role,
    context: !!def.context,
    output: !!def.output,
    condition: !!def.condition,
  })
  const [confirmed, setConfirmed] = useState(initialConfirmed(challenge.defaults))

  // ③ baseline
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  // ④ 변형 실험 (한 요소만 바꿔서 다시)
  const [variantKey, setVariantKey] = useState('context')
  const [variantValue, setVariantValue] = useState('')
  const [variantExps, setVariantExps] = useState([])
  // {id, changedKey, oldValue, newValue, response, prompt, registered, rowId}
  const [variantLoading, setVariantLoading] = useState(false)
  const [variantError, setVariantError] = useState('')

  // ⑤ 관찰 메모
  const [observation, setObservation] = useState('')
  const [obsSaving, setObsSaving] = useState(false)
  const [obsSavedAt, setObsSavedAt] = useState(null)
  const [obsError, setObsError] = useState('')

  // ⑥ 내가 하고 싶은 말 더하기 (1번 미션만)
  const [addRequest, setAddRequest] = useState('')
  const [addExps, setAddExps] = useState([])
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  // 첨부 자료 (2번 미션 — challenge.hasAttachment)
  const [attachText, setAttachText] = useState('')
  const [attachUrl, setAttachUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [attachError, setAttachError] = useState('')

  // 챌린지 바뀌면 모두 초기화
  useEffect(() => {
    setParts(challenge.defaults)
    setConfirmed(initialConfirmed(challenge.defaults))
    setOutput('')
    setError('')
    setVariantKey('context')
    setVariantValue('')
    setVariantExps([])
    setVariantError('')
    setObservation('')
    setObsSavedAt(null)
    setObsError('')
    setAddRequest('')
    setAddExps([])
    setAddError('')
    setAttachText('')
    setAttachUrl('')
    setAttachError('')
    setBaselineRegistered(null)
  }, [challenge.id])

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
  const basePrompt = composeWarmupPrompt(parts, challenge)
  const composedPrompt = attachText.trim()
    ? `${basePrompt}\n\n[참고 자료 — 학생이 첨부]\n${attachText.trim()}`
    : basePrompt

  // 챌린지별 system: 공통 + 챌린지 추가 지시
  const systemPrompt = challenge.systemAddon
    ? `${WARMUP_SYSTEM_PROMPT}\n\n— 이 미션의 추가 지시 —\n${challenge.systemAddon}`
    : WARMUP_SYSTEM_PROMPT

  // 등록 정책
  const allowChoose = challenge.allowChoosePublic === true   // ③·④에 두 버튼 표시
  const ar = challenge.addRequestConfig
  const addForcePrivate = ar?.forcePrivate === true

  async function fetchUrlContent() {
    setAttachError('')
    const u = attachUrl.trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u)) {
      setAttachError('http:// 또는 https:// 로 시작하는 URL을 입력하세요.')
      return
    }
    setFetchingUrl(true)
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(u)}`
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error('상태 ' + res.status)
      const html = await res.text()
      const tmp = document.createElement('div')
      tmp.innerHTML = html
      tmp.querySelectorAll('script, style, noscript, svg, header, footer, nav').forEach((el) => el.remove())
      const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8000)
      if (!text) throw new Error('가져온 내용이 비어있어요.')
      setAttachText(text)
    } catch (e) {
      setAttachError(
        '가져오기 실패 (' +
          (e.message || '알 수 없음') +
          ') — 페이지가 외부 접근을 막을 수 있어요. 자료 내용을 직접 복사·붙여넣기 해주세요.'
      )
    }
    setFetchingUrl(false)
  }

  const handleChange = (key, value) => {
    setParts({ ...parts, [key]: value })
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

  // ② → ③: baseline 호출
  const handleRun = async () => {
    setError('')
    if (!allConfirmed) {
      setError('4요소를 모두 입력하고 각 [확인] 버튼을 눌러주세요.')
      return
    }
    setLoading(true)
    setOutput('')
    try {
      const { text } = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: composedPrompt }],
      })
      setOutput(text)
    } catch (e) {
      setError(e.message || '생성 실패')
    }
    setLoading(false)
  }

  // ③ baseline 등록 (isPublic 인자로 공개 여부 선택)
  const [baselineRegistered, setBaselineRegistered] = useState(null) // {rowId, isPublic} | null
  const handleRegisterBaseline = async (isPublic = true) => {
    if (!output) return
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 1,
        mode: 'warmup',
        challenge_id: challenge.id,
        prompt: composedPrompt,
        output_text: output,
        self_check: { ...parts, isBaseline: true, hasAttachment: !!attachText.trim() },
        is_public: isPublic,
      })
      setBaselineRegistered({ rowId: row.id, isPublic })
      setHistory([row, ...history])
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  // ④ 변형 실험
  const runVariant = async () => {
    setVariantError('')
    const trimmed = (variantValue || '').trim()
    if (!trimmed) {
      setVariantError(`새 [${VARIANT_LABELS.find((v) => v.key === variantKey)?.label}] 값을 입력하세요.`)
      return
    }
    if (trimmed === (parts[variantKey] || '')) {
      setVariantError('이전과 같은 값이에요. 다른 값을 시도해보세요.')
      return
    }
    const newParts = { ...parts, [variantKey]: trimmed }
    const newBase = composeWarmupPrompt(newParts, challenge)
    const newPrompt = attachText.trim()
      ? `${newBase}\n\n[참고 자료 — 학생이 첨부]\n${attachText.trim()}`
      : newBase
    setVariantLoading(true)
    try {
      const { text } = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: newPrompt }],
      })
      const exp = {
        id: Date.now(),
        changedKey: variantKey,
        oldValue: parts[variantKey],
        newValue: trimmed,
        response: text,
        prompt: newPrompt,
        registered: false,
        rowId: null,
      }
      setVariantExps([exp, ...variantExps])
      setVariantValue('')
    } catch (e) {
      setVariantError(e.message || '실험 실패')
    }
    setVariantLoading(false)
  }

  const registerVariant = async (exp, isPublic = true) => {
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
        is_public: isPublic,
      })
      setVariantExps(
        variantExps.map((e) =>
          e.id === exp.id ? { ...e, registered: true, rowId: row.id, isPublic } : e
        )
      )
      setHistory([row, ...history])
    } catch (e) {
      setVariantError(e.message || '등록 실패')
    }
  }

  // ⑤ 관찰 메모 저장
  const saveObservation = async () => {
    setObsError('')
    if (!observation.trim()) {
      setObsError('메모 내용을 적어주세요.')
      return
    }
    setObsSaving(true)
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 1,
        mode: 'warmup',
        challenge_id: challenge.id,
        prompt: '[관찰 메모]',
        output_text: '',
        self_check: { type: 'observation' },
        reflection: observation.trim(),
      })
      setHistory([row, ...history])
      setObsSavedAt(new Date())
    } catch (e) {
      setObsError(e.message || '저장 실패')
    }
    setObsSaving(false)
  }

  // ⑥ 내가 하고 싶은 말 더하기 (1번 미션만)
  const runAdd = async () => {
    setAddError('')
    const req = (addRequest || '').trim()
    if (!req) {
      setAddError('편지에 넣고 싶은 말이나 더하고 싶은 표현을 적어주세요.')
      return
    }
    const newPrompt = `${composedPrompt}\n\n[내가 꼭 넣고 싶은 말]\n${req}`
    setAddLoading(true)
    try {
      const { text } = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 700,
        system: systemPrompt,
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
      setAddExps([exp, ...addExps])
      setAddRequest('')
    } catch (e) {
      setAddError(e.message || '실패')
    }
    setAddLoading(false)
  }

  const registerAdd = async (exp, isPublic = true) => {
    if (exp.registered) return
    const finalPublic = addForcePrivate ? false : isPublic
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
          privateLetter: addForcePrivate || !finalPublic,
        },
        reflection: exp.userRequest,
        is_public: finalPublic,
      })
      setAddExps(
        addExps.map((e) =>
          e.id === exp.id ? { ...e, registered: true, rowId: row.id, isPublic: finalPublic } : e
        )
      )
      setHistory([row, ...history])
    } catch (e) {
      setAddError(e.message || '등록 실패')
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
                이 챌린지 등록 — {myForChallenge.length}회
              </p>
            </div>
          )}
        </div>

        {/* ── 우측: 위→아래 활동 흐름 ─────────────────────────────────────── */}
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

          {/* 📎 참고 자료 첨부 (hasAttachment 챌린지만) */}
          {challenge.hasAttachment && (
            <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                📎 진로·직업 자료 첨부 <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>(선택, 강력 권장)</span>
              </p>
              <p className="muted small" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
                관심 있는 <strong>진로·직업에 대한 자료</strong>를 텍스트로 붙이거나 관련 URL을 입력하세요.
                직업 소개 페이지(워크넷·커리어넷), 관련 뉴스 기사, 종사자 인터뷰 등이 좋아요.
                AI가 자료의 사실에 근거해서 진로 중심 자기소개를 정리합니다.
              </p>

              <div className="field">
                <span>📄 자료 내용 (직접 붙여넣기)</span>
                <textarea
                  value={attachText}
                  onChange={(e) => setAttachText(e.target.value)}
                  rows={6}
                  placeholder={`예) 직업명: 데이터 사이언티스트
주요 업무: 대규모 데이터에서 패턴을 찾아 의사결정을 돕는다.
                 비즈니스 문제를 통계·머신러닝 모델로 옮긴다.
필요 역량: 통계학, Python/SQL, 머신러닝 기본기, 도메인 지식, 시각화
필요 학과: 통계학과·산업공학과·컴퓨터공학과 등
입직 경로: 학사·석사 → 기업 데이터팀(IT/금융/의료/유통) 또는 데이터 컨설팅
평균 연봉: 신입 5~7천만원, 경력 시니어 1억 이상 가능
관련 기관/매체 출처: 워크넷 직업정보, 한국직업능력연구원 보고서 등`}
                  style={{
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    background: 'var(--surface)',
                  }}
                />
              </div>

              <div className="row" style={{ marginTop: 10, gap: 6, alignItems: 'flex-end' }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>또는 🔗 URL에서 가져오기 (실험적)</span>
                  <input
                    type="url"
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <button
                  className="btn"
                  onClick={fetchUrlContent}
                  disabled={fetchingUrl || !attachUrl.trim()}
                  style={{ padding: '8px 14px' }}
                >
                  {fetchingUrl ? '가져오는 중...' : '📥 가져와서 채우기'}
                </button>
              </div>

              {attachError && (
                <p className="error" style={{ marginTop: 8 }}>{attachError}</p>
              )}

              {attachText.trim() && (
                <p
                  className="small"
                  style={{
                    marginTop: 10,
                    color: 'var(--success)',
                    padding: '6px 10px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.82rem',
                  }}
                >
                  ✅ 자료 {attachText.trim().length.toLocaleString()}자 첨부됨. ②에서 보내면 함께 전송됩니다.
                </p>
              )}
            </div>
          )}

          {/* ② 완성 프롬프트 + 보내기 */}
          <div
            className="card"
            style={{ borderLeft: '4px solid ' + (allConfirmed ? 'var(--success)' : 'var(--warning)') }}
          >
            <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontWeight: 700, fontSize: '1rem' }}>② 완성 프롬프트</p>
              <span className="small muted" style={{ fontSize: '0.8rem' }}>
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

          {/* ③ AI 응답 (메모 없음) */}
          {output && (
            <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 10 }}>
                ③ AI 응답 (기본 결과)
              </p>
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
                {output}
              </div>
              {allowChoose && (
                <p
                  className="small muted"
                  style={{ marginTop: 10, fontSize: '0.8rem' }}
                >
                  💡 모두 보는 갤러리에 등록하거나, 선생님께만 보이게 제출할 수 있어요.
                </p>
              )}
              <RegisterButtons
                registered={!!baselineRegistered}
                isPublic={baselineRegistered?.isPublic}
                onRegister={handleRegisterBaseline}
                allowChoose={allowChoose}
                forcePrivate={false}
                publicLabel="📌 기본 결과 갤러리에 등록"
                privateLabel="📤 기본 결과 선생님께만 제출"
                style={{ marginTop: 12 }}
              />
            </div>
          )}

          {/* ④ 변형 실험 */}
          {output && (
            <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                ④ 한 요소만 바꿔서 변형 실험
              </p>
              <p className="muted small" style={{ marginBottom: 14, fontSize: '0.85rem' }}>
                4요소 중 한 가지만 바꿔보면 결과가 어떻게 달라질까요? 기본은 <strong>맥락</strong> —
                다른 요소도 골라 시도해보세요.
              </p>

              <div className="field" style={{ marginBottom: 12 }}>
                <span>어떤 요소를 바꿀까?</span>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {VARIANT_LABELS.map((v) => (
                    <button
                      key={v.key}
                      className="btn"
                      onClick={() => {
                        setVariantKey(v.key)
                        setVariantValue('')
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        background: variantKey === v.key ? v.color : 'var(--surface2)',
                        borderColor: variantKey === v.key ? v.color : 'var(--border)',
                        color: variantKey === v.key ? 'white' : 'var(--text)',
                      }}
                    >
                      {variantKey === v.key ? '● ' : '○ '}{v.label}
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
                <span className={`tag ${variantKey}`} style={{ marginRight: 4 }}>
                  {VARIANT_LABELS.find((v) => v.key === variantKey)?.label}
                </span>
                <strong>{parts[variantKey] || '(비어있음)'}</strong>
                <span className="muted"> → 새로 바꿀 값:</span>
              </div>

              <div className="row" style={{ gap: 6 }}>
                <textarea
                  value={variantValue}
                  onChange={(e) => setVariantValue(e.target.value)}
                  placeholder={`새 [${VARIANT_LABELS.find((v) => v.key === variantKey)?.label}] 값을 입력`}
                  rows={2}
                  style={{
                    flex: 1,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '8px 10px',
                    color: 'var(--text)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runVariant()
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={runVariant}
                  disabled={variantLoading || !variantValue.trim()}
                  style={{ padding: '8px 16px', alignSelf: 'stretch' }}
                >
                  {variantLoading ? '실험 중...' : '🔄 실험 보내기'}
                </button>
              </div>

              {(challenge.suggestions[variantKey] || []).length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {challenge.suggestions[variantKey].map((s) => (
                    <button
                      key={s}
                      className="btn btn-ghost"
                      onClick={() => setVariantValue(s)}
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

              {variantError && <p className="error" style={{ marginTop: 10 }}>{variantError}</p>}

              {/* 변형 결과 누적 */}
              {variantExps.map((exp, idx) => {
                const m = VARIANT_LABELS.find((v) => v.key === exp.changedKey)
                return (
                  <div
                    key={exp.id}
                    style={{
                      marginTop: 14,
                      padding: 12,
                      background: 'var(--bg)',
                      borderRadius: 'var(--radius)',
                      borderLeft: `3px solid ${m?.color || 'var(--accent)'}`,
                    }}
                  >
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        🔬 변형 #{variantExps.length - idx}
                      </span>
                      <span className="muted small">{m?.label} 변경</span>
                    </div>
                    <div className="small" style={{ marginTop: 6 }}>
                      <span className={`tag ${exp.changedKey}`}>{m?.label}</span>
                      <span style={{ color: 'var(--text-muted)' }}> {exp.oldValue || '(빈값)'}</span>
                      <span style={{ margin: '0 8px' }}>→</span>
                      <strong>{exp.newValue}</strong>
                    </div>
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.95rem',
                        lineHeight: 1.85,
                        marginTop: 8,
                        padding: '10px 12px',
                        background: 'var(--surface2)',
                        borderRadius: 4,
                      }}
                    >
                      {exp.response}
                    </div>
                    <RegisterButtons
                      registered={exp.registered}
                      isPublic={exp.isPublic}
                      onRegister={(pub) => registerVariant(exp, pub)}
                      allowChoose={allowChoose}
                      forcePrivate={false}
                      publicLabel="📌 이 변형 갤러리에 등록"
                      privateLabel="📤 이 변형 선생님께만 제출"
                      style={{ marginTop: 10 }}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* ⑤ 관찰 메모 */}
          {output && (
            <div className="card" style={{ borderLeft: '4px solid #9333ea' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                ⑤ 관찰 메모 — 무엇이 달라졌나요?
              </p>
              <p className="muted small" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
                ③ 기본 결과와 ④ 변형 결과를 비교하며 어떤 요소가 결과에 어떤 차이를 만들었는지 짧게 메모해보세요.
              </p>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                rows={4}
                placeholder="예) 맥락을 '졸업식 전날'로 바꿨더니 응원 톤이 그리움 섞인 회상으로 변했다. 같은 미션인데 단어 몇 개 바꾼 것만으로도 분위기가 확 달라진다."
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
              />
              <button
                className="btn btn-primary"
                onClick={saveObservation}
                disabled={obsSaving || !observation.trim()}
                style={{ width: '100%', marginTop: 10 }}
              >
                {obsSaving
                  ? '저장 중...'
                  : obsSavedAt
                  ? `💾 메모 다시 저장 (마지막: ${obsSavedAt.toLocaleTimeString()})`
                  : '💾 관찰 메모 저장'}
              </button>
              {obsError && <p className="error" style={{ marginTop: 8 }}>{obsError}</p>}
            </div>
          )}

          {/* ⑥ 내가 하고 싶은 말 / 결과 수정 — challenge.hasAddRequest일 때만 */}
          {output && challenge.hasAddRequest && ar && (
            <div className="card" style={{ borderLeft: '4px solid #be123c' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                ⑥ {ar.title}
                {addForcePrivate && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--warning)', marginLeft: 6 }}>
                    🔒 비공개
                  </span>
                )}
              </p>
              <p className="muted small" style={{ marginBottom: 14, fontSize: '0.88rem', lineHeight: 1.7 }}>
                {ar.desc}
              </p>

              {addForcePrivate && (
                <p
                  className="small"
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: 'var(--warning)',
                    borderRadius: 'var(--radius)',
                    marginBottom: 12,
                    fontSize: '0.82rem',
                  }}
                >
                  🔒 이 결과는 <strong>공개 갤러리에 올라가지 않고 선생님만 볼 수 있어요.</strong> D-30에 본인에게 전달될
                  진짜 편지이므로 솔직하게 적어도 괜찮습니다.
                </p>
              )}

              <textarea
                value={addRequest}
                onChange={(e) => setAddRequest(e.target.value)}
                placeholder={ar.placeholder}
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
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runAdd()
                }}
              />
              <button
                className="btn btn-primary"
                onClick={runAdd}
                disabled={addLoading || !addRequest.trim()}
                style={{ width: '100%', marginTop: 12, padding: '12px', fontSize: '0.98rem' }}
              >
                {addLoading ? '다시 작성 중...' : ar.buttonText}
              </button>
              {addError && <p className="error" style={{ marginTop: 10 }}>{addError}</p>}

              {/* 결과 누적 */}
              {addExps.map((exp, idx) => (
                <div
                  key={exp.id}
                  style={{
                    marginTop: 14,
                    padding: 12,
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius)',
                    borderLeft: '3px solid var(--accent)',
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {ar.resultEmoji} {ar.resultLabel} #{addExps.length - idx}
                    </span>
                    <span className="muted small">내가 더한 지시 반영</span>
                  </div>
                  <div
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderLeft: '2px solid var(--warning)',
                      borderRadius: 4,
                      fontSize: '0.85rem',
                      marginTop: 8,
                      marginBottom: 10,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <strong style={{ color: 'var(--warning)' }}>💬 내가 적은 지시:</strong>{' '}
                    {exp.userRequest}
                  </div>
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: '1rem',
                      lineHeight: 1.85,
                      padding: '12px 14px',
                      background: 'var(--surface2)',
                      borderRadius: 4,
                    }}
                  >
                    {exp.response}
                  </div>
                  <RegisterButtons
                    registered={exp.registered}
                    isPublic={exp.isPublic}
                    onRegister={(pub) => registerAdd(exp, pub)}
                    allowChoose={allowChoose && !addForcePrivate}
                    forcePrivate={addForcePrivate}
                    publicLabel={`📌 이 ${ar.resultLabel} 갤러리에 등록`}
                    privateLabel={
                      addForcePrivate
                        ? `📤 이 ${ar.resultLabel} 선생님께만 제출`
                        : `📤 이 ${ar.resultLabel} 선생님께만 제출`
                    }
                    doneLabelPrivate={
                      addForcePrivate
                        ? '✓ 선생님께 제출 완료 — D-30에 전달됩니다'
                        : '✓ 선생님께 제출 완료'
                    }
                    style={{ marginTop: 10 }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 내 시도 기록 (페이지 하단) */}
      {myForChallenge.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted small" style={{ marginBottom: 8 }}>
            내가 등록한 시도 — {myForChallenge.length}회
          </p>
          {myForChallenge.slice(0, 5).map((a) => (
            <div className="attempt" key={a.id}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {a.self_check?.type === 'observation' ? (
                  <span className="tag" style={{ background: '#9333ea', color: 'white', fontSize: '0.7rem' }}>
                    관찰 메모
                  </span>
                ) : (
                  VARIANT_LABELS.map((v) => {
                    const val = a.self_check?.[v.key]
                    if (!val) return null
                    return (
                      <span key={v.key} className={`tag ${v.key}`} style={{ fontSize: '0.7rem' }}>
                        {v.label}: {val.length > 18 ? val.slice(0, 18) + '…' : val}
                      </span>
                    )
                  })
                )}
                <span className="muted small" style={{ marginLeft: 'auto' }}>
                  {new Date(a.created_at).toLocaleTimeString()}
                </span>
              </div>
              {a.output_text && (
                <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{a.output_text}</div>
              )}
              {a.reflection && (
                <div style={{ fontSize: '0.85rem', marginTop: 4, color: 'var(--warning)', whiteSpace: 'pre-wrap' }}>
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
// ── 등록 버튼 — 공개/비공개 선택 또는 단일 ─────────────────────────────────
function RegisterButtons({
  registered,
  isPublic,
  onRegister,
  allowChoose,
  forcePrivate,
  publicLabel = '📌 갤러리에 등록',
  privateLabel = '📤 선생님께만 제출',
  doneLabelPublic = '✓ 갤러리에 등록됨',
  doneLabelPrivate = '✓ 선생님께 제출 완료',
  style,
}) {
  if (registered) {
    const done = isPublic === false ? doneLabelPrivate : doneLabelPublic
    return (
      <button
        className="btn btn-primary"
        disabled
        style={{
          width: '100%',
          background: 'var(--success)',
          borderColor: 'var(--success)',
          color: 'white',
          opacity: 1,
          ...style,
        }}
      >
        {done}
      </button>
    )
  }

  if (forcePrivate) {
    return (
      <button
        className="btn btn-primary"
        onClick={() => onRegister(false)}
        style={{ width: '100%', ...style }}
      >
        {privateLabel}
      </button>
    )
  }

  if (allowChoose) {
    return (
      <div className="row" style={{ gap: 8, ...style }}>
        <button
          className="btn"
          onClick={() => onRegister(true)}
          style={{
            flex: 1,
            padding: '10px',
            background: 'var(--accent)',
            color: 'white',
            borderColor: 'var(--accent)',
            fontSize: '0.9rem',
          }}
        >
          {publicLabel}
        </button>
        <button
          className="btn"
          onClick={() => onRegister(false)}
          style={{
            flex: 1,
            padding: '10px',
            background: 'var(--warning)',
            color: 'white',
            borderColor: 'var(--warning)',
            fontSize: '0.9rem',
          }}
        >
          {privateLabel}
        </button>
      </div>
    )
  }

  // 기본: 공개 한 버튼
  return (
    <button
      className="btn btn-primary"
      onClick={() => onRegister(true)}
      style={{ width: '100%', ...style }}
    >
      {publicLabel}
    </button>
  )
}

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
