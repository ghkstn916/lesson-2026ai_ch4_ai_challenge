import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchGallery } from '../lib/supabase.js'
import { MODES, MODE_BY_KEY } from '../data/modes.js'
import VPythonRunner from '../components/shared/VPythonRunner.jsx'
import { VARIANT_LABELS } from '../data/challenges-warmup.js'

export default function GalleryPage() {
  const [mode, setMode] = useState('warmup')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchGallery({ mode, limit: 60 })
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [mode])

  const meta = MODE_BY_KEY[mode]

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
        <div className="card-sm" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
        {!loading && items.length === 0 && <p className="muted">아직 등록된 작품이 없어요.</p>}

        <div
          className="mode-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
        >
          {items.map((a) => (
            <GalleryCard key={a.id} a={a} mode={mode} />
          ))}
        </div>
      </main>
    </>
  )
}

function GalleryCard({ a, mode }) {
  const variant = VARIANT_LABELS.find((v) => v.key === a.variant_label)
  return (
    <div className="card-sm">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted small">
          {a.student?.student_number} {a.student?.name}
        </span>
        <span className="muted small">{new Date(a.created_at).toLocaleDateString()}</span>
      </div>

      {variant && (
        <div style={{ marginTop: 6 }}>
          <span className={`tag ${variant.key}`}>{variant.label}</span>
        </div>
      )}

      {mode === 'visual' && a.output_text && (
        <div style={{ marginTop: 10 }}>
          <VPythonRunner code={a.output_text} height="180px" />
        </div>
      )}

      {mode === 'image' && a.output_blob_url && (
        <img
          src={a.output_blob_url}
          alt=""
          style={{ width: '100%', borderRadius: 'var(--radius)', marginTop: 10 }}
        />
      )}

      <div className="muted small" style={{ marginTop: 8 }}>
        <strong>P:</strong> {a.prompt.slice(0, 140)}{a.prompt.length > 140 && '...'}
      </div>
      {a.output_text && mode !== 'visual' && (
        <div style={{ marginTop: 6, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
          {a.output_text.slice(0, 240)}{a.output_text.length > 240 && '...'}
        </div>
      )}
      {a.reflection && (
        <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--warning)' }}>
          💭 {a.reflection}
        </div>
      )}
      {a.self_check?.score != null && (
        <div className="muted small" style={{ marginTop: 6 }}>
          자기 점검: <strong style={{ color: 'var(--accent-hover)' }}>{a.self_check.score}점</strong>
        </div>
      )}
    </div>
  )
}
