import { Component, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchGallery } from '../lib/supabase.js'
import { MODES, MODE_BY_KEY } from '../data/modes.js'
import { CHALLENGE_INDEX, challengeIdsForMode, challengeMeta } from '../data/challenges-index.js'
import VPythonRunner from '../components/shared/VPythonRunner.jsx'
import { VARIANT_LABELS } from '../data/challenges-warmup.js'

// 한 카드가 throw해도 갤러리 페이지 전체가 흰 화면이 되지 않도록 격리
class CardErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }
  static getDerivedStateFromError(err) {
    return { err }
  }
  componentDidCatch(err, info) {
    console.error('[gallery] card render error:', err, info)
  }
  render() {
    if (this.state.err) {
      return (
        <div className="card-sm" style={{ borderColor: 'var(--danger)' }}>
          <p className="muted small" style={{ color: 'var(--danger)' }}>
            ⚠ 이 작품을 표시할 수 없어요
          </p>
          <p className="muted small" style={{ fontSize: '0.72rem', marginTop: 4 }}>
            {String(this.state.err?.message || this.state.err).slice(0, 120)}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

const safeStr = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v))

export default function GalleryPage() {
  const [mode, setMode] = useState('warmup')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openChallenges, setOpenChallenges] = useState({}) // {id: bool}

  useEffect(() => {
    setLoading(true)
    setError('')
    setOpenChallenges({})
    fetchGallery({ mode, limit: 300 })
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch((e) => {
        console.error('[gallery] fetch failed:', e)
        setError(e?.message || String(e) || '갤러리를 불러오지 못했습니다')
      })
      .finally(() => setLoading(false))
  }, [mode])

  const meta = MODE_BY_KEY[mode]

  // 챌린지별 그룹화 + 그룹 내 점수순(내림차순) 정렬
  const groups = useMemo(() => {
    const scoreOf = (a) => {
      const s = a.teacher_score ?? a.self_check?.score
      return typeof s === 'number' ? s : -Infinity
    }
    const sortByScore = (arr) =>
      [...arr].sort((a, b) => {
        const diff = scoreOf(b) - scoreOf(a)
        if (diff !== 0) return diff
        // 점수가 같으면 최신순
        return new Date(b.created_at) - new Date(a.created_at)
      })

    const map = new Map()
    for (const a of items || []) {
      let cid = a.challenge_id
      if (!cid || cid === 'null' || cid === 'undefined') cid = '(기타)'
      if (!map.has(cid)) map.set(cid, [])
      map.get(cid).push(a)
    }
    // 챌린지 정의 순서대로 정렬, 정의에 없는 id는 뒤에
    const orderedIds = challengeIdsForMode(mode)
    const result = []
    for (const cid of orderedIds) {
      if (map.has(cid)) {
        result.push([cid, sortByScore(map.get(cid))])
        map.delete(cid)
      }
    }
    for (const [cid, arr] of map) result.push([cid, sortByScore(arr)])
    return result
  }, [items, mode])

  const toggleGroup = (cid) => {
    setOpenChallenges({ ...openChallenges, [cid]: !openChallenges[cid] })
  }

  // 첫 로드 시 모든 그룹 펼친 상태로 시작 (직관적)
  useEffect(() => {
    if (groups.length > 0 && Object.keys(openChallenges).length === 0) {
      const all = {}
      for (const [cid] of groups) all[cid] = true
      setOpenChallenges(all)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length])

  return (
    <>
      <header className="header">
        <Link to="/student" className="brand" style={{ color: 'var(--text)' }}>
          🎓 AI 챌린지
        </Link>
        <span className="muted small">/ 학급 공개 갤러리</span>
        <span className="spacer" />
        <Link to="/student" className="btn btn-ghost" style={{ fontSize: '0.85rem' }}>
          ← 내 화면으로
        </Link>
      </header>

      <main className="container">
        {/* 모드 탭 */}
        <div
          className="card-sm"
          style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              className="btn"
              onClick={() => setMode(m.key)}
              style={{
                padding: '6px 10px',
                fontSize: '0.85rem',
                background: mode === m.key ? 'var(--accent)' : 'var(--surface2)',
                borderColor: mode === m.key ? 'var(--accent)' : 'var(--border)',
                color: mode === m.key ? 'white' : 'var(--text)',
              }}
            >
              {m.emoji} {m.sessionNumber}차시 {m.title}
            </button>
          ))}
        </div>

        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>
          {meta.emoji} {meta.sessionNumber}차시 — {meta.title}
        </h1>
        <p className="muted small" style={{ marginBottom: 16 }}>{meta.summary}</p>

        {loading && <p className="muted">불러오는 중...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && groups.length === 0 && <p className="muted">아직 등록된 작품이 없어요.</p>}

        {/* 챌린지별 그룹 */}
        <div className="col" style={{ gap: 16 }}>
          {groups.map(([cid, attempts]) => {
            const ch = challengeMeta(mode, cid)
            const open = openChallenges[cid] ?? true
            return (
              <section key={cid} className="card" style={{ padding: 0 }}>
                <button
                  onClick={() => toggleGroup(cid)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 18px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{ch?.emoji || '📁'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                      {ch?.title || cid}
                      {ch?.level && (
                        <span className="muted small" style={{ marginLeft: 8, fontWeight: 400 }}>
                          Level {ch.level}
                        </span>
                      )}
                    </div>
                    {ch?.description && (
                      <div className="muted small" style={{ marginTop: 2, fontSize: '0.78rem' }}>
                        {ch.description.slice(0, 90)}{ch.description.length > 90 && '…'}
                      </div>
                    )}
                  </div>
                  <span
                    className="tag"
                    style={{
                      background: 'var(--accent)',
                      color: 'white',
                      padding: '4px 12px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {attempts.length}개
                  </span>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div
                    style={{
                      padding: '0 18px 18px',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="mode-grid"
                      style={{
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        marginTop: 14,
                      }}
                    >
                      {attempts.map((a) => (
                        <CardErrorBoundary key={a.id}>
                          <GalleryCard a={a} mode={mode} />
                        </CardErrorBoundary>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </main>
    </>
  )
}

function GalleryCard({ a, mode }) {
  const variant = VARIANT_LABELS.find((v) => v.key === a.variant_label)
  const prompt = safeStr(a.prompt)
  const outputText = safeStr(a.output_text)
  const reflection = safeStr(a.reflection)
  return (
    <div className="card-sm">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted small">
          {a.student?.student_number} {a.student?.name}
        </span>
        <span className="muted small">{new Date(a.created_at).toLocaleDateString()}</span>
      </div>

      {/* 1차시 워밍업: 4요소 칩 표시 */}
      {mode === 'warmup' && a.self_check && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
          {VARIANT_LABELS.map((v) => {
            const raw = a.self_check?.[v.key]
            const val = safeStr(raw)
            if (!val) return null
            return (
              <span key={v.key} className={`tag ${v.key}`} style={{ fontSize: '0.68rem' }}>
                {v.label}: {val.length > 14 ? val.slice(0, 14) + '…' : val}
              </span>
            )
          })}
        </div>
      )}

      {variant && mode !== 'warmup' && (
        <div style={{ marginTop: 6 }}>
          <span className={`tag ${variant.key}`}>{variant.label}</span>
        </div>
      )}

      {mode === 'visual' && outputText && (
        <div style={{ marginTop: 10 }}>
          <VPythonRunner
            code={outputText}
            height="180px"
            showRotateToggle={false}
            defaultRotate={false}
          />
        </div>
      )}

      {mode === 'image' && a.output_blob_url && (
        <img
          src={a.output_blob_url}
          alt=""
          style={{ width: '100%', borderRadius: 'var(--radius)', marginTop: 10 }}
        />
      )}

      {prompt && (
        <div className="muted small" style={{ marginTop: 8 }}>
          <strong>P:</strong> {prompt.slice(0, 140)}{prompt.length > 140 && '...'}
        </div>
      )}
      {outputText && mode !== 'visual' && (
        <div style={{ marginTop: 6, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
          {outputText.slice(0, 240)}{outputText.length > 240 && '...'}
        </div>
      )}
      {reflection && (
        <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--warning)' }}>
          💭 {reflection}
        </div>
      )}
      {typeof a.self_check?.score === 'number' && (
        <div className="muted small" style={{ marginTop: 6 }}>
          자기 점검: <strong style={{ color: 'var(--accent-hover)' }}>{a.self_check.score}점</strong>
        </div>
      )}
    </div>
  )
}
