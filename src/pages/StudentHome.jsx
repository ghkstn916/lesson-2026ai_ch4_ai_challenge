import { Link } from 'react-router-dom'
import StudentLayout from '../components/StudentLayout.jsx'
import useStudentStore from '../store/studentStore.js'
import { MODES } from '../data/modes.js'

export default function StudentHome() {
  const { name } = useStudentStore()

  return (
    <StudentLayout needKey="anthropic" title="홈">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>
          {name ? `${name} 학생, 환영합니다 👋` : '환영합니다 👋'}
        </h1>
        <p className="muted">
          오늘 진행할 차시를 선택하세요. 모든 차시는 같은 리듬으로 진행됩니다 — 미션 카드 → 프롬프트 → AI 결과 → 자기 점검 → 갤러리.
        </p>
      </div>

      <div className="mode-grid">
        {MODES.map((m) => (
          <Link key={m.key} to={`/student/${m.key}`} className="mode-card">
            <div className="session">{m.sessionNumber}차시</div>
            <div className="title">
              {m.emoji} {m.title}
            </div>
            <div className="summary">{m.summary}</div>
            <span className={`badge ${m.status}`}>
              {m.status === 'ready' ? '진행 가능' : '준비 중'}
            </span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>안내</h2>
        <ul className="muted small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
          <li>모든 산출물은 <Link to="/gallery">학급 공개 갤러리</Link>에 자동 등록됩니다.</li>
          <li>학번·이름·API 키는 브라우저에만 저장되며 서버에 보관되지 않습니다.</li>
          <li>키가 잘 안 되면 상단 🟡 표시를 눌러 다시 입력하세요.</li>
        </ul>
      </div>
    </StudentLayout>
  )
}
