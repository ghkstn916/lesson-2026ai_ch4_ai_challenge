/**
 * 8개 차시 모드 메타데이터. App.jsx 라우팅과 학생 홈 카드가 이 데이터를 공유한다.
 */

export const MODES = [
  {
    key: 'warmup',
    sessionNumber: 1,
    title: '워밍업',
    emoji: '👋',
    summary: '프롬프트 4요소(역할·맥락·제약·예시)를 하나씩 바꿔보며 결과 차이를 관찰',
    needsKey: 'anthropic',
    status: 'ready',
  },
  {
    key: 'visual',
    sessionNumber: 2,
    title: '시각화',
    emoji: '🎨',
    summary: '텍스트 프롬프트로 3D 장면 만들기 — 분해·패턴·추상화 훈련',
    needsKey: 'anthropic',
    status: 'ready',
  },
  {
    key: 'image',
    sessionNumber: 3,
    title: '이미지',
    emoji: '🖼️',
    summary: '이미지 프롬프팅 5요소로 GPT Image 2 다루기',
    needsKey: 'openai',
    status: 'ready',
  },
  {
    key: 'structure',
    sessionNumber: 4,
    title: '구조화',
    emoji: '🧱',
    summary: '같은 정보를 JSON → SVG → HTML 표로 — 출력 형식을 제약으로',
    needsKey: 'anthropic',
    status: 'ready',
  },
  {
    key: 'limit',
    sessionNumber: 5,
    title: '한계',
    emoji: '⚠️',
    summary: '환각·편향·일관성 깨짐을 직접 유도하고 토큰 예측으로 설명',
    needsKey: 'anthropic',
    status: 'ready',
  },
  {
    key: 'tool',
    sessionNumber: 6,
    title: '도구',
    emoji: '🛠️',
    summary: '계산기·검색·메모·날짜계산 — AI가 도구를 부르는 흐름 관찰',
    needsKey: 'anthropic',
    status: 'ready',
  },
  {
    key: 'react',
    sessionNumber: 7,
    title: '리액트',
    emoji: '🧠',
    summary: 'ReAct 다단계 추론·행동 체인 + 미니 에이전트 기획서 작성',
    needsKey: 'anthropic',
    status: 'ready',
  },
  {
    key: 'project',
    sessionNumber: 8,
    title: '프로젝트',
    emoji: '🎓',
    summary: '내 미니 에이전트 완성 + 갤러리 코멘트 + 종합 토론',
    needsKey: 'anthropic',
    status: 'ready',
  },
]

export const MODE_BY_KEY = Object.fromEntries(MODES.map((m) => [m.key, m]))
