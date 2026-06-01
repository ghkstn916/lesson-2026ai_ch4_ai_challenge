/**
 * 모든 모드의 챌린지 메타데이터 통합 인덱스.
 * 갤러리에서 challenge_id 로 lookup 하기 위해 사용.
 */
import { WARMUP_CHALLENGES } from './challenges-warmup.js'
import { BATTLE_CHALLENGES } from './challenges-battle.js'
import { IMAGE_CHALLENGES } from './challenges-image.js'
import { TOOL_CHALLENGES } from './challenges-tool.js'
import { REACT_CHALLENGE } from './challenges-react.js'

function toMap(arr) {
  return Object.fromEntries(arr.map((c) => [c.id, c]))
}

export const CHALLENGE_INDEX = {
  warmup: toMap(WARMUP_CHALLENGES),
  visual: toMap(BATTLE_CHALLENGES),
  image: toMap(IMAGE_CHALLENGES),
  tool: toMap(TOOL_CHALLENGES),
  react: { [REACT_CHALLENGE.id]: REACT_CHALLENGE },
  project: {},
}

/**
 * 모드 안에서 챌린지 표시 순서(레벨/번호 순). 그룹 헤더 정렬에 쓰임.
 */
export function challengeIdsForMode(mode) {
  return Object.keys(CHALLENGE_INDEX[mode] || {})
}

export function challengeMeta(mode, id) {
  return CHALLENGE_INDEX[mode]?.[id] || null
}

export function challengeLabel(mode, id) {
  const m = challengeMeta(mode, id)
  if (!m) return id
  const emoji = m.emoji || ''
  const title = m.title || id
  return `${emoji} ${title}`.trim()
}
