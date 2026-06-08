import { useEffect, useRef, useState } from 'react'
import { createBlobURL, revokeBlobURL } from '../../utils/glowscript.js'

/**
 * VPythonRunner
 * GlowScript 3.2 코드를 Blob URL iframe으로 렌더링
 *
 * Props:
 *   code              string  — VPython 코드
 *   width             string  — 기본 '100%'
 *   height            string  — 기본 '300px'
 *   label             string  — 상단 레이블 (선택)
 *   autoRun           bool    — 코드 변경 시 자동 재실행 (기본 true)
 *   defaultRotate     bool    — 자동 회전 기본 ON/OFF (기본 true)
 *   showRotateToggle  bool    — 회전 토글 버튼 표시 (기본 true)
 */
export default function VPythonRunner({
  code,
  width = '100%',
  height = '300px',
  label,
  autoRun = true,
  defaultRotate = false,
  showRotateToggle = true,
}) {
  const blobRef = useRef(null)
  const [src, setSrc] = useState(null)
  const [error, setError] = useState(null)
  const [rotate, setRotate] = useState(defaultRotate)

  const run = (c, rotateOn) => {
    if (!c?.trim()) return
    setError(null)
    try {
      if (blobRef.current) revokeBlobURL(blobRef.current)
      const url = createBlobURL(c, { isoAngle: true, autoRotate: rotateOn })
      blobRef.current = url
      setSrc(url)
    } catch (e) {
      setError(e.message)
    }
  }

  // 코드 또는 회전 토글이 바뀌면 iframe 재생성
  useEffect(() => {
    if (autoRun) run(code, rotate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, autoRun, rotate])

  useEffect(() => {
    return () => {
      if (blobRef.current) revokeBlobURL(blobRef.current)
    }
  }, [])

  return (
    <div style={{ width }}>
      {(label || showRotateToggle) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
            gap: 8,
          }}
        >
          {label && (
            <div
              style={{
                fontSize: '0.86rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </div>
          )}
          {showRotateToggle && src && (
            <button
              onClick={() => setRotate(!rotate)}
              title="자동으로 카메라를 돌려서 모든 각도를 보여줘요. 끄면 마우스로 직접 돌릴 수 있어요."
              style={{
                padding: '3px 10px',
                fontSize: '0.84rem',
                background: rotate ? 'var(--accent)' : 'var(--surface2)',
                color: rotate ? 'white' : 'var(--text-muted)',
                border: '1px solid ' + (rotate ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
            >
              {rotate ? '🔄 자동회전 ON' : '⏸ 자동회전 OFF'}
            </button>
          )}
        </div>
      )}

      <div
        style={{
          background: '#1a1a2e',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          position: 'relative',
          height,
        }}
      >
        {!src && !error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
            }}
          >
            프롬프트를 제출하면 AI가 만든 장면이 여기에 표시됩니다
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger)',
              fontSize: '0.875rem',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            ⚠ {error}
          </div>
        )}

        {src && (
          <iframe
            key={src}
            src={src}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            title="VPython Scene"
          />
        )}
      </div>

      {src && showRotateToggle && (
        <div
          style={{
            fontSize: '0.84rem',
            color: 'var(--text-muted)',
            marginTop: 4,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span>🖱 드래그 = 회전</span>
          <span>휠 = 줌</span>
        </div>
      )}

      {!autoRun && (
        <button
          onClick={() => run(code, rotate)}
          style={{
            marginTop: '8px',
            padding: '6px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          ▶ 실행
        </button>
      )}
    </div>
  )
}
