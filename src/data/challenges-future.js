/**
 * 3~8차시 미리보기용 챌린지 카드. PRD §3.3~3.8 에서 추출.
 * 실제 구현 시 src/data/challenges-{mode}.js 로 분리할 예정.
 */

export const PREVIEWS = {
  image: {
    goal: '이미지 프롬프팅 5요소(주제·스타일·구도·라이팅·디테일) 익히기',
    challenges: [
      { level: 1, title: '책상 위 빨간 사과', detail: '매체 선택 (수채화/유화/사진)' },
      { level: 2, title: '수험생의 책상', detail: '책·노트·펜·시계·텀블러 (스튜디오 라이팅)' },
      { level: 3, title: '내 진로를 풍경으로', detail: '추상·은유' },
    ],
    needsKey: 'openai',
  },
  structure: {
    goal: '같은 정보가 형식에 따라 어떻게 다르게 표현되는지 — JSON/SVG/HTML 표',
    challenges: [
      { level: 1, title: 'JSON 자기소개', detail: '{ name, grade, interests, dream_career, motto }' },
      { level: 2, title: 'SVG 자기소개 카드', detail: '400×600, 색상 2색 이상' },
      { level: 3, title: 'HTML 표로 내 일주일', detail: '과목·동아리·자습 시간' },
    ],
  },
  limit: {
    goal: '환각·편향·일관성 깨짐을 직접 유도하고 관찰',
    challenges: [
      { level: 1, title: '환각 사냥', detail: '가짜 사건·인물에 대해 자신 있게 틀리도록 유도' },
      { level: 2, title: '편향 관찰', detail: '"엔지니어 한 명을 묘사" — 무엇이 디폴트인가' },
      { level: 3, title: '일관성 깨기', detail: '같은 프롬프트를 5번 보내 답의 차이 관찰' },
    ],
  },
  tool: {
    goal: '같은 질문을 자체 지식 vs 도구 호출로 — 결과 차이 관찰',
    tools: ['🧮 계산기', '🔎 검색 (mock)', '🗒 메모', '📅 날짜계산'],
    challenges: [
      { level: 1, title: '단일 도구', detail: '"수능 D-day는?" (계산기·날짜)' },
      { level: 2, title: '적절한 도구 선택', detail: '"우리 학교 설립연도와 올해 몇 주년" (검색+계산)' },
      { level: 3, title: '도구 실패 회복', detail: '검색이 못 찾으면 "모른다" 답하도록' },
    ],
  },
  react: {
    goal: '다단계 도구 호출(ReAct = Reasoning + Acting) 관찰',
    challenges: [
      {
        level: 1,
        title: '수능 D-day 종합 브리핑',
        detail: '날짜계산 + 계산기 + 메모 + 검색 / 5~8단계',
      },
    ],
    note: '챌린지 1개 + 7차시 30분은 본인 미니 에이전트 기획서 작성',
  },
  project: {
    goal: '본인 미니 에이전트 완성 + 갤러리 코멘트 + 종합 토론',
    sections: [
      '5~25분: 자기 에이전트 완성 + 갤러리 등록',
      '25~35분: 조별 토론 (랜덤 3~5인)',
      '35~43분: 조 대표 1명씩 짧은 공유',
      '43~50분: 전체 종합 마무리',
    ],
  },
}
