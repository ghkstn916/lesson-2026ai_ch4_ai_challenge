import { Link } from 'react-router-dom'

export default function GuidePage() {
  return (
    <>
      <header className="header">
        <Link to="/" className="brand" style={{ color: 'var(--text)' }}>🎓 AI 챌린지</Link>
        <span className="muted small">/ 교사 안내</span>
        <span className="spacer" />
        <Link to="/teacher" className="btn btn-ghost" style={{ fontSize: '0.85rem' }}>교사 대시보드 →</Link>
      </header>

      <main className="container">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 12 }}>📘 교사용 안내</h1>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>단원 개요</h2>
          <p className="muted">
            고3 인공지능 기초 — 생성형 AI와 에이전틱 AI (8차시). 1·2차시는 사용 가능, 3~8차시는 골격 안내 단계.
          </p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>차시 구성</h2>
          <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
            <li><strong>1차시 워밍업</strong> — 프롬프트 4요소(역할·맥락·제약·예시) 변형 연습</li>
            <li><strong>2차시 시각화</strong> — VPython 3D 코드 생성, CT 4요소 훈련</li>
            <li><strong>3차시 이미지</strong> — GPT Image 2, 이미지 프롬프팅 5요소 (예정)</li>
            <li><strong>4차시 구조화</strong> — JSON / SVG / HTML 표 (예정)</li>
            <li><strong>5차시 한계</strong> — 환각·편향·일관성 깨짐 관찰 (예정)</li>
            <li><strong>6차시 도구</strong> — 계산기·검색·메모·날짜 (예정)</li>
            <li><strong>7차시 리액트</strong> — ReAct + 미니 에이전트 기획서 (예정)</li>
            <li><strong>8차시 프로젝트</strong> — 발표 + 갤러리 코멘트 + 종합 토론 (예정)</li>
          </ul>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>학생 안내</h2>
          <ol style={{ paddingLeft: 18, lineHeight: 1.9 }}>
            <li>학생은 <Link to="/join">/join</Link> 에서 학번·이름·API 키 입력 후 입장</li>
            <li>홈에서 진행할 차시 선택</li>
            <li>모든 산출물은 자동으로 <Link to="/gallery">공개 갤러리</Link>에 등록</li>
          </ol>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>API 키</h2>
          <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
            <li><strong>Anthropic 키</strong> — 1·2·4·5·6·7·8차시 (Claude Haiku/Sonnet)</li>
            <li><strong>OpenAI 키</strong> — 3차시 전용 (GPT Image 2)</li>
            <li>키는 브라우저 localStorage에만 저장. 서버에 보관되지 않음.</li>
            <li>학생 키 미발급 시: 교사가 예비 키 2~3개 준비해 즉시 교체</li>
          </ul>
        </div>
      </main>
    </>
  )
}
