import { useEffect, useState } from 'react'
import StudentLayout from '../components/StudentLayout.jsx'
import ModeIntro from '../components/ModeIntro.jsx'
import useStudentStore from '../store/studentStore.js'
import {
  IMAGE_CHALLENGES,
  IMAGE_ELEMENTS,
  IMAGE_GUIDE,
  composeImagePrompt,
  IMAGE_REFINE_SYSTEM,
} from '../data/challenges-image.js'
import { generateImage, callClaude } from '../lib/claude.js'
import { insertAttempt, fetchMyAttempts, uploadBlob } from '../lib/supabase.js'

const SOFT_LIMIT = 3

function base64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type })
}

const emptyParts = () => ({ subject: '', style: '', composition: '', lighting: '', detail: '' })

export default function ImageMode() {
  const { studentId, anthropicKey } = useStudentStore()
  const [challenge, setChallenge] = useState(IMAGE_CHALLENGES[0])
  const [parts, setParts] = useState(emptyParts())
  const [prompt, setPrompt] = useState('')
  const [dirty, setDirty] = useState(false)       // 학생이 완성 프롬프트를 직접 손댔는가
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [reflection, setReflection] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineErr, setRefineErr] = useState('')

  useEffect(() => {
    if (!studentId) return
    fetchMyAttempts({ studentId, mode: 'image' })
      .then(setHistory)
      .catch((e) => console.warn(e))
  }, [studentId])

  const myForChallenge = history.filter((h) => h.challenge_id === challenge.id)
  const totalAttempts = history.length
  const filledCount = IMAGE_ELEMENTS.filter((e) => (parts[e.key] || '').trim()).length

  const selectChallenge = (c) => {
    setChallenge(c)
    setParts(emptyParts())
    setPrompt('')
    setDirty(false)
    setImageUrl('')
    setError('')
    setRefineErr('')
    setReflection('')
  }

  // 요소 입력 → 직접 편집 전이면 완성 프롬프트를 자동으로 합쳐 갱신
  const handlePart = (key, val) => {
    const np = { ...parts, [key]: val }
    setParts(np)
    if (!dirty) setPrompt(composeImagePrompt(np))
  }

  const recombine = () => {
    setPrompt(composeImagePrompt(parts))
    setDirty(false)
  }

  // ✨ 단어로 적은 5요소를 이미지 프롬프트 "문장"으로 다듬기 (Claude)
  const handleRefine = async () => {
    setRefineErr('')
    if (filledCount === 0) {
      setRefineErr('먼저 5요소 중 한두 개라도 입력해주세요.')
      return
    }
    if (!anthropicKey) {
      setRefineErr('프롬프트 문장 다듬기는 Anthropic 키가 필요해요. (상단에서 키 입력)')
      return
    }
    setRefining(true)
    try {
      const body =
        IMAGE_ELEMENTS.map((e) => `${e.label}: ${(parts[e.key] || '').trim() || '(없음)'}`).join('\n') +
        `\n\n미션: ${challenge.title}\n위 요소로 이미지 생성 프롬프트 한 문단을 완성해줘.`
      const { text } = await callClaude({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 400,
        system: IMAGE_REFINE_SYSTEM,
        messages: [{ role: 'user', content: body }],
      })
      if (text) {
        setPrompt(text.trim())
        setDirty(true) // 다듬은 문장을 요소 변경이 덮어쓰지 않도록
      }
    } catch (e) {
      setRefineErr(e.message || '다듬기 실패')
    }
    setRefining(false)
  }

  const handleGenerate = async () => {
    setError('')
    if (!prompt.trim()) {
      setError('완성 프롬프트가 비어 있어요. 5요소를 입력하거나 직접 작성하세요.')
      return
    }
    setLoading(true)
    setImageUrl('')
    try {
      const r = await generateImage({
        prompt,
        size: '1024x1024',
        onPartial: (b64) => setImageUrl(`data:image/jpeg;base64,${b64}`),
      })
      if (r.b64) setImageUrl(`data:image/jpeg;base64,${r.b64}`)
      else if (r.url) setImageUrl(r.url)
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
      const elementCheck = Object.fromEntries(
        IMAGE_ELEMENTS.map((e) => [e.key, !!(parts[e.key] || '').trim()])
      )
      const row = await insertAttempt({
        student_id: studentId,
        session_number: 3,
        mode: 'image',
        challenge_id: challenge.id,
        prompt,
        output_blob_url: publicUrl,
        self_check: { ...elementCheck, parts, editedByStudent: dirty },
        reflection: reflection || null,
      })
      setHistory([row, ...history])
      setParts(emptyParts())
      setPrompt('')
      setDirty(false)
      setImageUrl('')
      setReflection('')
    } catch (e) {
      setError(e.message || '등록 실패')
    }
  }

  return (
    <StudentLayout needKey="openai" title="3차시 이미지">
      <ModeIntro modeKey="image" />
      <ImageGuide />
      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        {/* ── 좌측: 챌린지 선택 + 미션 안내 ─────────────────────────────── */}
        <div className="col" style={{ flex: '0 0 320px', gap: 16 }}>
          <div className="card-sm">
            <p className="muted small" style={{ marginBottom: 6 }}>오늘의 미션</p>
            {IMAGE_CHALLENGES.map((c) => {
              const selected = challenge.id === c.id
              return (
                <button
                  key={c.id}
                  className="btn"
                  onClick={() => selectChallenge(c)}
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
            <p className="muted small" style={{ marginBottom: 10 }}>{challenge.description}</p>
            {challenge.extraHint && (
              <div
                className="card-sm"
                style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'var(--accent)', fontSize: '0.92rem', whiteSpace: 'pre-wrap' }}
              >
                {challenge.extraHint}
              </div>
            )}
            <p className="muted small" style={{ marginTop: 10, fontSize: '0.92rem' }}>
              💡 각 요소는 <strong>단어·명사로 적어도 OK</strong> — 아래 “✨ 문장으로 다듬기”가 이미지 프롬프트 문장으로 바꿔줍니다.
            </p>
          </div>

          {myForChallenge.length > 0 && (
            <div className="card-sm">
              <p className="muted small" style={{ marginBottom: 6 }}>
                이 챌린지 등록 — <strong>{myForChallenge.length}</strong> / 권장 {challenge.minVariants}장
              </p>
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}
              >
                {myForChallenge.map((a) => (
                  <a key={a.id} href={a.output_blob_url} target="_blank" rel="noreferrer">
                    <img
                      src={a.output_blob_url}
                      alt=""
                      style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 우측: ① 5요소 입력 → ② 완성 프롬프트 → 생성 ──────────────── */}
        <div className="col" style={{ flex: 1, gap: 16 }}>
          {totalAttempts >= SOFT_LIMIT && (
            <div
              className="card-sm"
              style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'var(--warning)', color: 'var(--warning)', fontSize: '0.95rem' }}
            >
              💡 시도 {totalAttempts}회 — 새 그림을 만들기 전에 잠시 멈추고
              5요소(주제·스타일·구도·라이팅·디테일) 중 무엇이 부족했는지 다시 들여다보면 큰 차이가 있어요.
            </div>
          )}

          {/* ① 5요소 입력 */}
          <div className="card">
            <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ fontWeight: 700, fontSize: '1rem' }}>① 5요소를 채워보세요 (단어로 적어도 OK)</p>
              <span className="small" style={{ color: filledCount ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
                {filledCount}/5 입력됨
              </span>
            </div>
            <div className="col" style={{ gap: 10 }}>
              {IMAGE_ELEMENTS.map((meta) => (
                <ElementInput
                  key={meta.key}
                  meta={meta}
                  value={parts[meta.key]}
                  suggestions={challenge.suggestions[meta.key] || []}
                  onChange={(val) => handlePart(meta.key, val)}
                />
              ))}
            </div>
          </div>

          {/* ② 완성 프롬프트 (직접 수정 가능) */}
          <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
            <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontWeight: 700, fontSize: '1rem' }}>② 완성 프롬프트 <span className="muted small" style={{ fontWeight: 400 }}>— 직접 고칠 수 있어요</span></p>
              {dirty && <span className="muted small" style={{ fontSize: '0.86rem' }}>✏️ 직접 편집 중</span>}
            </div>

            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <button
                className="btn btn-primary"
                onClick={handleRefine}
                disabled={refining || filledCount === 0}
                style={{ padding: '8px 14px', fontSize: '0.88rem' }}
              >
                {refining ? '다듬는 중...' : '✨ AI로 문장 다듬기'}
              </button>
              <button
                className="btn"
                onClick={recombine}
                disabled={filledCount === 0}
                style={{ padding: '8px 14px', fontSize: '0.88rem' }}
              >
                🔁 5요소로 다시 합치기
              </button>
            </div>
            {refineErr && <p className="error" style={{ marginBottom: 8 }}>{refineErr}</p>}

            <textarea
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setDirty(true) }}
              rows={5}
              placeholder="위 5요소를 채우면 여기에 자동으로 합쳐집니다. ‘✨ 문장으로 다듬기’를 누르거나, 이 칸에서 직접 고쳐도 돼요."
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                color: 'var(--text)',
                fontSize: '0.92rem',
                lineHeight: 1.6,
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />

            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              style={{ width: '100%', marginTop: 12, padding: '12px' }}
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
              <img src={imageUrl} alt="generated" style={{ width: '100%', borderRadius: 'var(--radius)' }} />

              <label className="field" style={{ marginTop: 14 }}>
                <span>관찰 메모 (선택) — 의도와 결과는 얼마나 일치했나요?</span>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={2}
                  placeholder="예) '수채화'라고 했더니 붓터치가 살았지만, 디테일이 약했다. 다음엔 '연한 종이결' 같은 묘사 추가."
                />
              </label>

              <button className="btn btn-primary" onClick={handleRegister} style={{ width: '100%', marginTop: 10 }}>
                📌 갤러리에 등록
              </button>
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  )
}

// ── 5요소 1개 입력 (단어·명사 OK + 추천 칩) ──────────────────────────────────
function ElementInput({ meta, value, suggestions, onChange }) {
  const filled = (value || '').trim()
  return (
    <div
      style={{
        padding: 10,
        background: 'var(--bg)',
        borderRadius: 'var(--radius)',
        border: '1px solid ' + (filled ? meta.color : 'var(--border)'),
      }}
    >
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="tag" style={{ background: meta.color, color: 'white', fontWeight: 700 }}>{meta.label}</span>
        <span className="muted small" style={{ fontSize: '0.84rem' }}>{filled ? '입력됨' : '단어·명사로 적어도 OK'}</span>
      </div>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={suggestions[0] ? `예: ${suggestions[0]}` : `${meta.label} 입력`}
        style={{
          width: '100%',
          marginTop: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '8px 10px',
          color: 'var(--text)',
          fontSize: '0.9rem',
          outline: 'none',
        }}
      />
      {suggestions.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              className="btn btn-ghost"
              onClick={() => onChange(s)}
              style={{
                padding: '3px 8px',
                fontSize: '0.74rem',
                border: '1px solid var(--border)',
                background: value === s ? meta.color : 'transparent',
                color: value === s ? 'white' : 'var(--text-muted)',
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

// ── 구도·5요소 상세 가이드 (접이식) ─────────────────────────────────────────
function ImageGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--accent)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontWeight: 700 }}>📐 구도·요소 자세히 보기 — 프롬프트에 넣을 어휘 사전</p>
        <button className="btn btn-ghost" onClick={() => setOpen(!open)} style={{ fontSize: '0.9rem' }}>
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
                    <div key={o.name} style={{ fontSize: '0.92rem' }}>
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
            style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'var(--warning)', fontSize: '0.92rem' }}
          >
            ✍️ <strong>포스터·글자 미션 팁</strong> — {IMAGE_GUIDE.posterNote}
          </div>
        </div>
      )}
    </div>
  )
}
