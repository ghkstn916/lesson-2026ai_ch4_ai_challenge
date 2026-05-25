/**
 * 3차시 이미지 미션. 이미지 프롬프팅 5요소(주제·스타일·구도·라이팅·디테일).
 * PRD §3.3 챌린지 카드.
 */

export const IMAGE_CHALLENGES = [
  {
    id: 'image-apple',
    level: 1,
    emoji: '🍎',
    title: '책상 위 빨간 사과',
    description:
      '가장 단순한 정물. 매체를 선택해 같은 대상을 다르게 표현해보세요.',
    suggestions: {
      subject: ['빨간 사과 한 알', '나무 책상 위 사과', '사과와 책 한 권'],
      style: ['수채화', '유화', '사진(스튜디오)', '연필 스케치'],
      composition: ['정면 클로즈업', '약간 위에서 내려다본 시선', '측면 컷'],
      lighting: ['창문에서 들어오는 부드러운 자연광', '드라마틱한 측광', '균등한 무영광'],
      detail: ['사과 표면의 광택과 작은 점', '나뭇결이 보이는 책상', '뒤 배경은 흐림'],
    },
    minVariants: 2,
  },
  {
    id: 'image-desk',
    level: 2,
    emoji: '📚',
    title: '수험생의 책상',
    description:
      '구성 요소가 여러 개인 정물. 라이팅·구도가 결정적입니다.',
    suggestions: {
      subject: ['책·노트·펜·시계·텀블러가 놓인 책상', '교과서가 펼쳐진 책상', '문제집과 형광펜'],
      style: ['스튜디오 사진', '시네마틱', '잡지 화보'],
      composition: ['45도 각도 부감', '책상 옆에서 본 평행 시점', '오버헤드(완전 위에서)'],
      lighting: ['따뜻한 책상 스탠드', '아침 햇살', '차가운 형광등'],
      detail: ['시계는 23:14 표시', '텀블러에 김이 살짝', '연필 깎인 자국'],
    },
    minVariants: 2,
  },
  {
    id: 'image-career',
    level: 3,
    emoji: '🌅',
    title: '내 진로를 풍경으로 표현',
    description:
      '추상·은유. 정답이 없습니다 — 본인 관심 분야를 풍경 하나로 비유해보세요.',
    suggestions: {
      subject: ['끝없이 펼쳐진 데이터 평원', '도시 위로 솟은 디자인 등대', '병원 옥상의 새벽 풍경'],
      style: ['디지털 페인팅', '몽환적 일러스트', '미니멀 포스터'],
      composition: ['지평선이 낮은 광활한 풍경', '단 하나의 인물 실루엣', '대각선 구도'],
      lighting: ['새벽 푸른빛', '황금시간(골든아워)', '달빛'],
      detail: ['배경의 작은 디테일이 진로 키워드를 암시'],
    },
    minVariants: 1,
  },
]

export const IMAGE_ELEMENTS = [
  { key: 'subject', label: '주제', color: '#4338ca' },
  { key: 'style', label: '스타일', color: '#047857' },
  { key: 'composition', label: '구도', color: '#b45309' },
  { key: 'lighting', label: '라이팅', color: '#9333ea' },
  { key: 'detail', label: '디테일', color: '#be123c' },
]
