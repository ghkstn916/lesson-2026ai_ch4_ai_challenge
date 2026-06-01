/**
 * 4차시 도구 — 검색 도구가 참조하는 mock DB.
 * 한국 입시·고등학교·진로 정보 위주.
 */

export const MOCK_SEARCH_DB = [
  // ── 수능·입시 ────────────────────────────────────────────────────────────
  {
    keywords: ['수능', '대학수학능력시험', '2026 수능', '수능 날짜', '수능 일정'],
    snippet:
      '2026학년도 대학수학능력시험은 2025년 11월 13일(목) 시행. 2027학년도(현 고2 응시)는 2026년 11월 19일(목) 예정.',
    source: 'mock://education/sat-schedule',
  },
  {
    keywords: ['수시', '수시모집', '수시 일정'],
    snippet:
      '2027학년도 수시 원서 접수는 통상 2026년 9월 둘째 주. 학생부 종합 전형·교과 전형·논술 전형 등.',
    source: 'mock://education/early-admission',
  },
  {
    keywords: ['정시', '정시 일정'],
    snippet:
      '2027학년도 정시 원서 접수는 통상 2026년 12월 말 ~ 2027년 1월 초. 가/나/다군 각 1회 지원 가능.',
    source: 'mock://education/regular-admission',
  },

  // ── 학교 정보 ────────────────────────────────────────────────────────────
  {
    keywords: ['혜화여고', '혜화여자고등학교', '서울 혜화여고'],
    snippet:
      '혜화여자고등학교는 서울특별시 종로구에 위치한 공립 일반계 여자고등학교. 1965년 개교, 교훈은 "진리·근면·성실".',
    source: 'mock://school/hyehwa-girls-hs',
  },
  {
    keywords: ['혜화여고 위치', '혜화여고 주소'],
    snippet: '서울특별시 종로구 창경궁로35길 33',
    source: 'mock://school/hyehwa-girls-hs',
  },

  // ── 진로·직업 ────────────────────────────────────────────────────────────
  {
    keywords: ['데이터 사이언티스트', '데이터 과학자', '데이터 분석가'],
    snippet:
      '데이터 사이언티스트는 통계·프로그래밍·도메인 지식으로 의사결정을 돕는 직업. 평균 연봉 6~8천만원(주니어). Python/SQL/통계학 필수.',
    source: 'mock://career/data-scientist',
  },
  {
    keywords: ['UX 디자이너', '사용자 경험 디자이너'],
    snippet:
      'UX 디자이너는 제품·서비스 사용 경험을 설계하는 직업. 리서치·프로토타이핑·인터랙션 설계. Figma·사용자 인터뷰 역량 필요.',
    source: 'mock://career/ux-designer',
  },
  {
    keywords: ['AI 엔지니어', 'AI 개발자', '머신러닝 엔지니어'],
    snippet:
      'AI 엔지니어는 모델을 훈련·배포·운영하는 직업. Python·PyTorch·MLOps 역량. 평균 연봉 8천만원~1.2억(주니어 ~ 시니어).',
    source: 'mock://career/ai-engineer',
  },
  {
    keywords: ['간호사', '간호직'],
    snippet:
      '간호사는 환자 돌봄·약물 투여·의료진 협업. 4년제 간호학과 졸업 후 국가시험. 평균 초봉 3.5~4.5천만원.',
    source: 'mock://career/nurse',
  },

  // ── 학교 행사·시험 ─────────────────────────────────────────────────────
  {
    keywords: ['모의고사', '교육청 모의고사', '평가원 모의고사'],
    snippet:
      '고3 모의고사 주요 일정 (2026년): 3월 교육청, 6월 평가원, 7월 교육청, 9월 평가원, 10월 교육청. 수능 직전 11월.',
    source: 'mock://exam/mock-tests',
  },
]

/**
 * mock 검색 — query에 포함된 키워드 매칭으로 가장 잘 맞는 결과 반환.
 * 매치되는 게 없으면 빈 결과 (PRD §3.6 Level 3 "도구 실패 회복" 시나리오).
 */
export function mockSearch(query) {
  if (!query) return { results: [], totalCount: 0 }
  const q = query.toLowerCase()

  const scored = MOCK_SEARCH_DB.map((entry) => {
    let score = 0
    for (const kw of entry.keywords) {
      if (q.includes(kw.toLowerCase())) score += kw.length
    }
    return { entry, score }
  }).filter((x) => x.score > 0)

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 3).map((x) => ({
    snippet: x.entry.snippet,
    source: x.entry.source,
  }))

  return { results: top, totalCount: scored.length }
}
