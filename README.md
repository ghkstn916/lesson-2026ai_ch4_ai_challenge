# 인공지능 기초 8차시 — 생성형 AI와 에이전틱 AI

고3 인공지능 기초 단원용 챌린지 플랫폼. `greatsong/vpython-prompt-challenge` 를 fork하여 PRD에 맞게 재구조화했다.

## 차시 구성

| 차시 | 모드 | 출력 | 상태 |
|---|---|---|---|
| 1 | 워밍업 (warmup) | 텍스트 | ✅ 구현 |
| 2 | 시각화 (visual) | VPython 3D | ✅ 구현 |
| 3 | 이미지 (image) | PNG (GPT Image 2) | ✅ 구현 |
| 4 | 구조화 (structure) | JSON → SVG → HTML 표 | ✅ 구현 |
| 5 | 한계 (limit) | 텍스트 비교 (5회 병렬) | ✅ 구현 |
| 6 | 도구 (tool) | 도구 호출 시퀀스 (multi-turn) | ✅ 구현 |
| 7 | 리액트 (react) | ReAct + 미니 에이전트 기획서 | ✅ 구현 |
| 8 | 프로젝트 (project) | 발표 + 조 토론 + 코멘트 | ✅ 구현 |

## 기술 스택

- React 18 + Vite
- Supabase (PostgreSQL + Storage + Realtime)
- Anthropic Claude (Haiku/Sonnet)
- OpenAI GPT Image 2 (3차시)
- Vercel 서버리스 (API proxy)

## 개발 환경 셋업

```bash
npm install
cp .env.example .env       # Supabase 정보 입력
npm run dev                # http://localhost:4008
```

## Supabase 설정

1. supabase.com 에서 새 프로젝트 생성
2. SQL Editor → `db/supabase-schema.sql` 전체 실행
3. Storage → `gallery` 버킷 생성 (Public)
4. Project Settings → API에서 URL과 anon key 복사 → `.env` 에 입력

## API 키

학생이 첫 화면에서 직접 입력. 브라우저 `localStorage` 에만 저장된다.

| 차시 | 필요한 키 |
|---|---|
| 1, 2, 4, 5, 6, 7, 8 | Anthropic API 키 (Claude) |
| 3 | OpenAI API 키 (GPT Image 2) |

서버에 보낸 키는 저장되지 않는다 (proxy 직접 전달).

## 배포

```bash
vercel --prod
```

Vercel 환경변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_PASSWORD` 등록.

## PRD

`hyehwa_lecture/PRD-AI기초-8차시.md` 참조.
