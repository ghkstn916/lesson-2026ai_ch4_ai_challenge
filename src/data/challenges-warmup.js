/**
 * 1차시 워밍업 미션. 프롬프트 4요소(역할·맥락·출력·조건) 변형 연습.
 * 학급에서 가르친 표준 4요소를 따른다.
 */

export const WARMUP_CHALLENGES = [
  {
    id: 'warmup-cheer',
    level: '필수 (A)',
    emoji: '💌',
    title: '고3 친구에게 보낼 한 줄 응원',
    description:
      '같은 미션에 4요소(역할·맥락·출력·조건) 중 하나만 바꿔보며 결과가 어떻게 달라지는지 관찰해보세요.',
    defaults: {
      role: '나에게 쓰는 나',
      context: '',
      output: '',
      condition: '',
    },
    suggestions: {
      role: ['나에게 쓰는 나', '따뜻한 작가', '엄격한 선생님', '졸업한 선배'],
      context: ['수능 D-30', '슬럼프', '모의고사 직후', '졸업식 전날'],
      output: [
        '한 줄 응원 문장',
        '메시지 카드용 두 줄',
        '이모지 포함 SNS 캡션',
        '편지 형식 한 단락',
      ],
      condition: [
        '50자 이내',
        '비유를 하나 이상 포함',
        '~체로 끝맺기',
        '존댓말은 쓰지 않기',
      ],
    },
    minVariants: 2,
    successHint: '4요소(역할·맥락·출력·조건)를 각각 입력하고 확인 → 완성 프롬프트로 AI에게 보내세요. 2개 이상 등록하면 통과!',
  },
  {
    id: 'warmup-intro',
    level: '도전 (C)',
    emoji: '🌱',
    title: '진로 키워드로 만드는 자기소개 한 단락',
    description:
      '본인이 관심 있는 분야 키워드 1~2개로 프롬프트를 만들고, 4요소를 자유롭게 변형하며 자기소개를 다듬어보세요.',
    defaults: {
      role: '진로 상담사',
      context: '',
      output: '',
      condition: '',
    },
    suggestions: {
      role: ['진로 상담사', '면접관', '나의 미래 5년 후', '학생기자'],
      context: ['대학 자기소개서 첫 줄', 'SNS 프로필 한 단락', '학교 자치회 인사말'],
      output: ['한 단락(3~4문장)', '3줄 자기소개', '질문 한 개로 끝나는 한 단락'],
      condition: ['100자 이내', '키워드 3개 명시', '비속어/이모지 금지'],
    },
    minVariants: 2,
    successHint: '진로 키워드를 어떻게 다듬어 갔는지 관찰 메모를 남겨주세요.',
  },
]

/**
 * 4요소 → 완성 프롬프트 합성.
 * 학생 화면과 AI에게 보내는 본문이 동일하게 라벨링되어 있어
 * "어떤 요소가 어디로 들어가는지" 학습 효과를 살림.
 */
export function composeWarmupPrompt(parts, challenge) {
  return [
    `[역할] ${parts.role || ''}`,
    `[맥락] ${parts.context || ''}`,
    `[출력] ${parts.output || ''}`,
    `[조건] ${parts.condition || ''}`,
    '',
    `미션: ${challenge.title} — ${challenge.description}`,
  ].join('\n')
}

export const VARIANT_LABELS = [
  { key: 'role', label: '역할', color: '#4338ca' },
  { key: 'context', label: '맥락', color: '#047857' },
  { key: 'output', label: '출력', color: '#b45309' },
  { key: 'condition', label: '조건', color: '#9333ea' },
]
