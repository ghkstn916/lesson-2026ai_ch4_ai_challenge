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
            고3 인공지능 기초 — 생성형 AI와 에이전틱 AI (6차시). 생성형 3차시(워밍업·시각화·이미지) + 에이전틱 3차시(도구·리액트·프로젝트).
          </p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>차시 구성</h2>
          <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
            <li><strong>1차시 워밍업</strong> — 프롬프트 4요소(역할·맥락·출력·조건) 변형 연습</li>
            <li><strong>2차시 시각화</strong> — VPython 3D 코드 생성, CT 4요소 훈련</li>
            <li><strong>3차시 이미지</strong> — GPT Image 2, 이미지 프롬프팅 5요소</li>
            <li><strong>4차시 도구</strong> — 계산기·검색·메모·날짜, AI 도구 호출 흐름 + 환각/토큰 예측 회수</li>
            <li><strong>5차시 리액트</strong> — ReAct 다단계 추론·행동 + 미니 에이전트 기획서</li>
            <li><strong>6차시 프로젝트</strong> — 발표 + 조 토론 + 갤러리 코멘트 + 베스트 작품 포트폴리오</li>
          </ul>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>수행평가 루브릭 (B안 · 1차시 전 사전 공개)</h2>
          <p className="muted small" style={{ marginBottom: 8 }}>
            미니 에이전트 프로젝트 70% + 1~4차시 베스트 작품 포트폴리오 30%.
          </p>
          <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
            <li><strong>미니 에이전트 프로젝트 70%</strong> — 기획 25 / 구현 25 / 발표 20
              <ul style={{ paddingLeft: 16 }}>
                <li className="muted small">기획: 도구 4종으로 실제 풀리는 현실적 미션인가 / 사용자·상황이 분명한가</li>
                <li className="muted small">구현: 프롬프트가 실제로 작동하는가 / 단계가 매끄럽게 이어지는가 / 막혔을 때 수정한 흔적</li>
                <li className="muted small">발표: 조별 소개 + 갤러리 코멘트의 명료성 / 본인 에이전트의 쓸모 설명</li>
              </ul>
            </li>
            <li><strong>베스트 작품 포트폴리오 30%</strong> — 작품 선택·완성도 15 / 자기 설명 15
              <ul style={{ paddingLeft: 16 }}>
                <li className="muted small">1~4차시 중 본인 베스트 작품 1개 선택 + 자기 설명 한 단락</li>
              </ul>
            </li>
          </ul>
          <p className="muted small" style={{ marginTop: 8 }}>
            ※ API 키 오류 등 외부 변수로 학생이 불이익받지 않도록 교사 예비 키 즉시 교체 + 보충 미션 경로 제공.
          </p>
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
            <li><strong>Anthropic 키</strong> — 1·2·4·5·6차시 (Claude Haiku/Sonnet)</li>
            <li><strong>OpenAI 키</strong> — 3차시 전용 (GPT Image 2)</li>
            <li>키는 브라우저 localStorage에만 저장. 서버에 보관되지 않음.</li>
            <li>학생 키 미발급 시: 교사가 예비 키 2~3개 준비해 즉시 교체</li>
          </ul>
        </div>
      </main>
    </>
  )
}
