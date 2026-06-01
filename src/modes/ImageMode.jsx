import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import { IMAGE_CHALLENGES, IMAGE_ELEMENTS, IMAGE_GUIDE } from '../data/challenges-image.js'
import { generateImage } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts, uploadBlob } from '../lib/supabase.js'

const SOFT_LIMIT = 3

function base64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type })
}

export default function ImageMode() {
  const { studentId } = useStudentStore()
  const [challenge, setChallenge] = useState(IMAGE_CHALLENGES[0])
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [reflection, setReflection] = useState('')
  const [checks, setChecks] = useState({
    subject: false,
    style: false,
    composition: false,
    lighting: false,
    detail: false,
  })

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'image' })
      .then(setHistory)
      .catch((e) => console.warn(e))
  }, [studentId])

  const myForChallenge = history.filter((h) => h.challenge_id === challenge.id)
  const totalAttempts = history.length

  const handleGenerate = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('프롬프트를 작성해주세요.')
      return
    }
    setLoading(true)
    setImageUrl('')
    try {
      const r = await generateImage({
        prompt,
        size: '1024x1024',
        // 스트리밍 중 첫 partial(약 3~6초)이 도착하면 미리 화면에 띄운다
        onPartial: (b64) => setImageUrl(`data:image/jpeg;base64,${b64}`),
      })
      if (r.b64) {
        setImageUrl(`data:image/jpeg;base64,${r.b64}`)
      } else if (r.url) {
        setImageUrl(r.url)
      }
    } catch (e) {
      setError(e.message || '이미지 생성 실패')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setError('')
    if (!imageUrl) {
      setError('먼저 이미지를 생성하세요.')
      return
    }
    try {
      let publicUrl = imageUrl
      if (imageUrl.startsWith('data:image')) {
        const b64 = imageUrl.split(',')[1]
        const blob = base64ToBlob(b64)
        publicUrl = await uploadBlob({ studentId, mode: 'image', file: blob, ext: 'jpg' })
      }
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 3,
        mode: 'image',
        challenge_id: challenge.id,
        prompt,
        output_blob_url: publicUrl,
        self_check: checks,
        reflection: reflection || null,
      })
      setHistory([row, ...history])
      setPrompt('')
      setImageUrl('')
      setReflection('')
      setChecks({ subject: false, style: false, composition: false, lighting: false, detail: false })
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  return (
    <StudentLayout needKey="openai" title="3차시 이미지">
      <ModeIntro modeKey="image" />
      <ImageGuide />
      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        {/* ── 좌측: 챌린지 선택 + 5요소 힌트 ──────────────────────────────── */}
        <div className="col" style={{ flex: '0 0 340px', gap: 16 }}>
          <div className="card-sm">
            <p className="muted small" style={{ marginBottom: 6 }}>오늘의 미션</p>
            {IMAGE_CHALLENGES.map((c) => {
              const selected = challenge.id === c.id
              return (
                <button
                  key={c.id}
                  className="btn"
                  onClick={() => {
                    setChallenge(c)
                    setPrompt('')
                    setImageUrl('')
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    marginTop: 6,
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

          <div className="challenge">
            <p className="meta">Level {challenge.level}</p>
            <h3>{challenge.emoji} {challenge.title}</h3>
            <p className="muted small" style={{ marginBottom: 12 }}>{challenge.description}</p>

            {challenge.extraHint && (
              <div
                className="card-sm"
                style={{
                  background: 'rgba(99,102,241,0.08)',
                  borderColor: 'var(--accent)',
                  fontSize: '0.82rem',
                  marginBottom: 12,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {challenge.extraHint}
              </div>
            )}

            <p className="muted small" style={{ fontWeight: 600, marginTop: 8 }}>5요소 힌트:</p>
            <ul className="muted small" style={{ paddingLeft: 0, listStyle: 'none', lineHeight: 1.7 }}>
              {IMAGE_ELEMENTS.map((e) => (
                <li key={e.key} style={{ marginTop: 6 }}>
                  <span
                    className="tag"
                    style={{ background: e.color, color: 'white', marginBottom: 2 }}
                  >
                    {e.label}
                  </span>
                  <div style={{ marginTop: 2 }}>
                    {challenge.suggestions[e.key]?.join(' / ')}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── 우측: 프롬프트 + 결과 ─────────────────────────────────────── */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          {totalAttempts >= SOFT_LIMIT && (
            <div
              className="card-sm"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                borderColor: 'var(--warning)',
                color: 'var(--warning)',
                fontSize: '0.85rem',
              }}
            >
              💡 시도 {totalAttempts}회 — 새 프롬프트를 만들기 전에 잠시 멈추고
              5요소(주제·스타일·구도·라이팅·디테일) 중 무엇이 부족했는지 다시 들여다보면 큰 차이가 있어요.
            </div>
          )}

          <div className="card">
            <label className="field">
              <span>프롬프트 — 5요소를 풍부하게</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`예) 나무 책상 위 빨간 사과 한 알. 수채화 스타일. 정면 클로즈업. 창문 자연광이 사과 왼쪽에 부드럽게 떨어짐. 사과 표면의 광택과 점 두 개, 책상 나뭇결 보임.`}
                rows={5}
              />
            </label>

            <div className="field" style={{ marginTop: 12 }}>
              <span>이 프롬프트에 명시한 요소 (자기 점검)</span>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {IMAGE_ELEMENTS.map((e) => (
                  <button
                    key={e.key}
                    className="btn"
                    onClick={() => setChecks({ ...checks, [e.key]: !checks[e.key] })}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.85rem',
                      background: checks[e.key] ? e.color : 'var(--surface2)',
                      borderColor: checks[e.key] ? e.color : 'var(--border)',
                      color: checks[e.key] ? 'white' : 'var(--text)',
                    }}
                  >
                    {checks[e.key] ? '✓' : ''} {e.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              style={{ width: '100%', marginTop: 14 }}
            >
              {loading ? '생성 중 (10~30초)...' : '🎨 이미지 생성'}
            </button>

            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}

            <p className="muted small" style={{ marginTop: 10 }}>
              ⏱ 권장 시도: 3회. 현재 시도 — <strong>{totalAttempts}</strong>회.
            </p>
          </div>

          {imageUrl && (
            <div className="card">
              <p className="muted small" style={{ marginBottom: 8 }}>생성된 이미지</p>
              <img
                src={imageUrl}
                alt="generated"
                style={{ width: '100%', borderRadius: 'var(--radius)' }}
              />

              <label className="field" style={{ marginTop: 14 }}>
                <span>관찰 메모 (선택) — 의도와 결과는 얼마나 일치했나요?</span>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={2}
                  placeholder="예) '수채화'라고 했더니 붓터치가 살았지만, 디테일이 약했다. 다음엔 '연한 종이결' 같은 묘사 추가."
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

          <div className="card">
            <p className="muted small" style={{ marginBottom: 8 }}>
              이 챌린지 등록 — <strong>{myForChallenge.length}</strong> / 권장 {challenge.minVariants}장
            </p>
            {myForChallenge.length === 0 && (
              <p className="muted small">아직 등록한 이미지가 없어요.</p>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 8,
                marginTop: 8,
              }}
            >
              {myForChallenge.map((a) => (
                <a
                  key={a.id}
                  href={a.output_blob_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block' }}
                >
                  <img
                    src={a.output_blob_url}
                    alt=""
                    style={{
                      width: '100%',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                    }}
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  )
}

// ── 구도·5요소 상세 가이드 (접이식) ─────────────────────────────────────────
function ImageGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--accent)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontWeight: 700 }}>📐 구도·요소 자세히 보기 — 프롬프트에 넣을 어휘 사전</p>
        <button className="btn btn-ghost" onClick={() => setOpen(!open)} style={{ fontSize: '0.8rem' }}>
          {open ? '접기' : '펼치기'}
        </button>
      </div>
      {open && (
        <div className="col" style={{ gap: 14, marginTop: 12 }}>
          <p className="muted small">{IMAGE_GUIDE.intro}</p>
          {IMAGE_GUIDE.elements.map((el) => (
            <div key={el.key} style={{ borderLeft: `3px solid ${el.color}`, paddingLeft: 12 }}>
              <div style={{ marginBottom: 4 }}>
                <span className="tag" style={{ background: el.color, color: 'white' }}>{el.label}</span>
                <span className="muted small" style={{ marginLeft: 8 }}>{el.what}</span>
              </div>
              {el.options && (
                <div className="col" style={{ gap: 3, marginTop: 6 }}>
                  {el.options.map((o) => (
                    <div key={o.name} style={{ fontSize: '0.82rem' }}>
                      <strong>{o.name}</strong>
                      <span className="muted"> — {o.desc}</span>
                    </div>
                  ))}
                </div>
              )}
              {el.tips && (
                <ul className="muted small" style={{ paddingLeft: 16, marginTop: 6, lineHeight: 1.6 }}>
                  {el.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div
            className="card-sm"
            style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'var(--warning)', fontSize: '0.82rem' }}
          >
            ✍️ <strong>포스터·글자 미션 팁</strong> — {IMAGE_GUIDE.posterNote}
          </div>
        </div>
      )}
    </div>
  )
}
