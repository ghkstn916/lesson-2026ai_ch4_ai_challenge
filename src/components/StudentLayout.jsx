import { Link, useNavigate } from 'react-router-dom'
import useStudentStore from '../store/studentStore.js'
import ApiKeyBar from './ApiKeyBar.jsx'

/**
 * 학생 페이지 공통 헤더 + 본문 컨테이너.
 * 학번·이름이 비어 있으면 /join 으로 리다이렉트.
 */
export default function StudentLayout({ children, needKey = 'anthropic', title }) {
  const nav = useNavigate()
  const { studentId, name, studentNumber, reset } = useStudentStore()

  if (!studentId) {
    nav('/join', { replace: true })
    return null
  }

  return (
    <>
      <header className="header">
        <Link to="/student" className="brand" style={{ color: 'var(--text)' }}>
          🎓 AI 챌린지
        </Link>
        {title && <span className="muted small">/ {title}</span>}
        <span className="spacer" />

        <span className="muted small">
          {studentNumber} {name}
        </span>

        <ApiKeyBar needed={needKey} />

        <Link to="/gallery" className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.85rem' }}>
          🖼 갤러리
        </Link>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
          onClick={() => {
            if (confirm('로그아웃하면 학번·이름이 초기화됩니다. 진행할까요?')) {
              reset()
              nav('/join')
            }
          }}
        >
          로그아웃
        </button>
      </header>

      <main className="container">{children}</main>
    </>
  )
}
