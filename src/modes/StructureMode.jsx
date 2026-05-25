import { useEffect, useMemo, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import {
  STRUCTURE_CHALLENGES,
  sanitizeOutput,
  validateJSON,
  validateSVG,
  validateHTML,
  humanizeError,
} from '../data/challenges-structure.js'
import { callClaude } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts } from '../lib/supabase.js'

function stripCodeFence(s) {
  return s
    .trim()
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
}

export default function StructureMode() {
  const { studentId } = useStudentStore()
  const [challenge, setChallenge] = useState(STRUCTURE_CHALLENGES[0])
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [reflection, setReflection] = useState('')

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'structure' })
      .then(setHistory)
      .catch(() => {})
  }, [studentId])

  const myForChallenge = history.filter((h) => h.challenge_id === challenge.id)
  const previousJSON = history.find((h) => h.challenge_id === 'structure-json')?.output_text

  const validation = useMemo(() => {
    if (!output) return null
    if (challenge.format === 'json') return validateJSON(output, challenge.requiredKeys)
    if (challenge.format === 'svg') return validateSVG(output, challenge)
    if (challenge.format === 'html') return validateHTML(output)
    return null
  }, [output, challenge])

  const handleGenerate = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('프롬프트를 작성해주세요.')
      return
    }
    setLoading(true)
    setOutput('')

    let system
    if (challenge.format === 'json') {
      system = `너는 JSON 출력기다. 코드 블록 펜스(\`\`\`) 없이 순수 JSON 한 덩어리만 출력하라. 설명 문구 절대 금지.`
    } else if (challenge.format === 'svg') {
      system = `너는 SVG 출력기다. 코드 블록 펜스 없이 <svg>...</svg> 태그만 출력하라. 설명·주석·script 절대 금지.`
    } else if (challenge.format === 'html') {
      system = `너는 HTML 표 출력기다. 코드 블록 펜스 없이 <table>...</table> 태그만 출력하라. <script>·<style>·외부 리소스 금지.`
    }

    try {
      const { text } = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 1500,
        system,
        messages: [{ role: 'user', content: prompt }],
      })
      setOutput(sanitizeOutput(stripCodeFence(text)))
    } catch (e) {
      setError(e.message || '생성 실패')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setError('')
    if (!output) {
      setError('먼저 결과를 생성하세요.')
      return
    }
    try {
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 4,
        mode: 'structure',
        challenge_id: challenge.id,
        prompt,
        output_text: output,
        self_check: validation,
        reflection: reflection || null,
      })
      setHistory([row, ...history])
      setPrompt('')
      setOutput('')
      setReflection('')
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  return (
    <StudentLayout needKey="anthropic" title="4차시 구조화">
      <ModeIntro modeKey="structure" />

      {/* 챌린지 탭 */}
      <div className="card-sm" style={{ marginBottom: 16, display: 'flex', gap: 6 }}>
        {STRUCTURE_CHALLENGES.map((c) => {
          const selected = challenge.id === c.id
          return (
            <button
              key={c.id}
              className="btn"
              onClick={() => {
                setChallenge(c)
                setPrompt('')
                setOutput('')
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
        {/* ── 좌측: 챌린지 안내 + 프롬프트 ────────────────────────────── */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          <div className="challenge">
            <p className="meta">Level {challenge.level} · {challenge.format.toUpperCase()}</p>
            <h3>{challenge.emoji} {challenge.title}</h3>
            <p className="muted small" style={{ marginBottom: 10 }}>{challenge.description}</p>

            {challenge.schemaDoc && (
              <pre
                style={{
                  background: 'var(--bg)',
                  padding: 10,
                  borderRadius: 'var(--radius)',
                  fontSize: '0.8rem',
                  overflowX: 'auto',
                  color: 'var(--text-muted)',
                }}
              >
                {challenge.schemaDoc}
              </pre>
            )}

            {challenge.format !== 'json' && previousJSON && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.82rem',
                  color: 'var(--success)',
                }}
              >
                ✅ Level 1에서 작성한 JSON이 있어요! 그대로 복사해 프롬프트에 붙이면 데이터가 흘러갑니다.
              </div>
            )}

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
                placeholder={
                  challenge.format === 'json'
                    ? '예) 다음 정보를 JSON 한 덩어리로 출력해. 마크다운 펜스 없이.\n이름: 홍길동, 학년: 3-5, 관심사: ["축구","파이썬","랩"], 진로: 데이터 사이언티스트, 좌우명: 매일 한 줄'
                    : challenge.format === 'svg'
                    ? '예) 다음 JSON을 400×600 SVG 자기소개 카드로 만들어줘. 도형 1개 이상, 색상 2종 이상. <svg> 태그만 출력.\n[여기에 Level 1 JSON 붙이기]'
                    : '예) 내 일주일을 HTML <table>로 정리해줘. 컬럼: 요일/오전/오후/저녁. 학교/동아리/자습 시간 포함.'
                }
                rows={6}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              style={{ width: '100%', marginTop: 12 }}
            >
              {loading ? '생성 중...' : '🤖 AI에게 보내기'}
            </button>
            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
          </div>
        </div>

        {/* ── 우측: 출력 + 검증 + 등록 ────────────────────────────────── */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          {output && (
            <>
              <div className="card">
                <p className="muted small" style={{ marginBottom: 6 }}>AI 출력 (코드)</p>
                <pre
                  style={{
                    background: 'var(--bg)',
                    padding: 10,
                    borderRadius: 'var(--radius)',
                    fontSize: '0.78rem',
                    maxHeight: 240,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {output}
                </pre>
              </div>

              <div className="card">
                <p className="muted small" style={{ marginBottom: 6 }}>렌더 결과</p>
                <RenderedOutput challenge={challenge} output={output} />
              </div>

              <div className="card">
                <p className="muted small" style={{ marginBottom: 8 }}>자동 검증 (자기 점검)</p>
                {validation && (
                  <ValidationView challenge={challenge} validation={validation} />
                )}

                <label className="field" style={{ marginTop: 14 }}>
                  <span>관찰 메모 (선택)</span>
                  <textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    rows={2}
                    placeholder={`예) '마크다운 없이'라고 명시했더니 펜스가 사라졌다. 어느 형식이 가장 쉬웠고 어디서 막혔는지...`}
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
            </>
          )}

          {!output && (
            <div className="card-sm muted small" style={{ textAlign: 'center', padding: 30 }}>
              왼쪽에서 프롬프트를 작성하고 보내면 결과가 여기에 표시됩니다.
            </div>
          )}

          {myForChallenge.length > 0 && (
            <div className="card-sm">
              <p className="muted small" style={{ marginBottom: 6 }}>
                이 챌린지 — {myForChallenge.length}회 등록
              </p>
              {myForChallenge.slice(0, 3).map((a) => (
                <div className="attempt" key={a.id} style={{ fontSize: '0.8rem' }}>
                  <span className="muted">{new Date(a.created_at).toLocaleTimeString()}</span>
                  <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>
                    {a.output_text.slice(0, 200)}...
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

function ValidationView({ challenge, validation }) {
  if (challenge.format === 'json') {
    return (
      <ul style={{ listStyle: 'none', padding: 0, lineHeight: 1.8, fontSize: '0.9rem' }}>
        <li>{validation.parsed ? '✅' : '❌'} JSON 파싱 통과</li>
        <li>
          {validation.hasAllKeys ? '✅' : '⚠️'} 필수 키 존재
          {!validation.hasAllKeys && validation.missing?.length > 0 && (
            <span className="muted small"> — 누락: {validation.missing.join(', ')}</span>
          )}
        </li>
        {validation.error && (
          <li className="error" style={{ fontSize: '0.85rem', marginTop: 4 }}>
            🛠 {humanizeError(validation.error)}
          </li>
        )}
      </ul>
    )
  }
  if (challenge.format === 'svg') {
    return (
      <ul style={{ listStyle: 'none', padding: 0, lineHeight: 1.8, fontSize: '0.9rem' }}>
        <li>{validation.valid ? '✅' : '❌'} 유효한 SVG 구문</li>
        <li>{validation.hasEnoughText ? '✅' : '⚠️'} 텍스트 길이 ({validation.textLength}자)</li>
        <li>{validation.hasEnoughColors ? '✅' : '⚠️'} 색상 다양성 ({validation.colorCount}종)</li>
      </ul>
    )
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, lineHeight: 1.8, fontSize: '0.9rem' }}>
      <li>{validation['<table'] ? '✅' : '❌'} {'<table>'} 시작</li>
      <li>{validation['</table'] ? '✅' : '❌'} {'</table>'} 닫기</li>
      <li>{validation['<th'] ? '✅' : '❌'} {'<th>'} 헤더</li>
      <li>{validation['<td'] ? '✅' : '❌'} {'<td>'} 셀</li>
    </ul>
  )
}

function RenderedOutput({ challenge, output }) {
  if (challenge.format === 'json') {
    try {
      const parsed = JSON.parse(output)
      return (
        <div style={{ fontSize: '0.9rem', lineHeight: 1.8 }}>
          {Object.entries(parsed).map(([k, v]) => (
            <div key={k}>
              <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>{k}:</span>{' '}
              <span style={{ color: 'var(--text)' }}>
                {Array.isArray(v) ? v.join(', ') : String(v)}
              </span>
            </div>
          ))}
        </div>
      )
    } catch {
      return <p className="error small">JSON 파싱 실패 — 코드 그대로 확인해주세요.</p>
    }
  }
  if (challenge.format === 'svg') {
    return (
      <div
        style={{
          background: 'white',
          padding: 10,
          borderRadius: 'var(--radius)',
          maxHeight: 400,
          overflow: 'auto',
        }}
        dangerouslySetInnerHTML={{ __html: output }}
      />
    )
  }
  if (challenge.format === 'html') {
    return (
      <div
        style={{
          background: 'white',
          color: 'black',
          padding: 10,
          borderRadius: 'var(--radius)',
          maxHeight: 400,
          overflow: 'auto',
        }}
        dangerouslySetInnerHTML={{ __html: output }}
      />
    )
  }
  return null
}
