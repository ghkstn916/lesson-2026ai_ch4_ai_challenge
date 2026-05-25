import { useState } from 'react'
import useStudentStore from '../store/studentStore.js'

/**
 * 상단 헤더에 박히는 API 키 상태 + 인라인 편집 UI.
 * needed: 'anthropic' | 'openai' | 'both' | 'none'
 */
export default function ApiKeyBar({ needed = 'anthropic' }) {
  const store = useStudentStore()
  const [open, setOpen] = useState(false)
  const [a, setA] = useState(store.anthropicKey)
  const [o, setO] = useState(store.openaiKey)

  const hasA = !!store.anthropicKey
  const hasO = !!store.openaiKey
  const needA = needed === 'anthropic' || needed === 'both'
  const needO = needed === 'openai' || needed === 'both'

  return (
    <>
      <div className="keybar">
        {needA && (
          <span
            className={`pill ${hasA ? 'ok' : 'warn'}`}
            onClick={() => setOpen(true)}
            title="Anthropic 키 (Claude)"
          >
            {hasA ? '🟢' : '🟡'} Anthropic
          </span>
        )}
        {needO && (
          <span
            className={`pill ${hasO ? 'ok' : 'warn'}`}
            onClick={() => setOpen(true)}
            title="OpenAI 키 (이미지)"
          >
            {hasO ? '🟢' : '🟡'} OpenAI
          </span>
        )}
      </div>

      {open && (
        <div className="modal-bg" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>
              🔑 API 키 입력
            </h3>
            <p className="muted small" style={{ marginBottom: 16 }}>
              브라우저에만 저장됩니다. 서버에는 보관되지 않아요.
            </p>

            <div className="form">
              <label className="field">
                <span>Anthropic API 키</span>
                <input
                  type="password"
                  value={a}
                  onChange={(e) => setA(e.target.value)}
                  placeholder="sk-ant-..."
                />
              </label>

              <label className="field">
                <span>OpenAI API 키 (3차시 전용)</span>
                <input
                  type="password"
                  value={o}
                  onChange={(e) => setO(e.target.value)}
                  placeholder="sk-..."
                />
              </label>

              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn btn-ghost" onClick={() => setOpen(false)} style={{ flex: 1 }}>
                  취소
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    store.setAnthropicKey(a.trim())
                    store.setOpenaiKey(o.trim())
                    setOpen(false)
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
