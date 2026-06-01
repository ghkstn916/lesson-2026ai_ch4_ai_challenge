-- 고3 인공지능 기초 6차시 — Supabase 스키마
-- PRD v1.1 §2.5 기반. 운영 단위는 "개인" (teams 테이블 없음).
-- 모든 테이블에 RLS를 켜되 anon에 풀 권한을 주는 단순한 정책 사용.
-- (학번+이름 외 개인정보 미수집, 학교 내부망 수업용 가정.)
-- 테이블 ai8_* 접두사는 다른 수업과 충돌을 피하기 위한 내부 네임스페이스일 뿐 — 단원은 6차시.

-- ── students: 학생 1인 1행 ─────────────────────────────────────────────────────
create table if not exists ai8_students (
  id bigint generated always as identity primary key,
  session_id text not null,                 -- 학급 식별자 (예: "3-5")
  student_number text not null,
  name text not null,
  created_at timestamptz default now(),
  unique (session_id, student_number)
);

-- ── attempts: 모든 차시 시도 (1차시 텍스트, 2차시 코드, 3차시 이미지 URL 등) ─
create table if not exists ai8_attempts (
  id bigint generated always as identity primary key,
  student_id bigint references ai8_students(id) on delete cascade,
  session_number int not null,              -- 1~6
  mode text not null,                       -- warmup/visual/image/tool/react/project
  challenge_id text not null,               -- 예: "warmup-cheer", "battle-01", "portfolio"
  prompt text not null,
  output_text text,                         -- 텍스트 결과 등
  output_blob_url text,                     -- 이미지 등 바이너리 결과 URL
  variant_label text,                       -- 1차시: 역할/맥락/출력/조건 라벨
  tool_trace jsonb,                         -- 4·5차시 도구 호출 시퀀스
  self_check jsonb,                         -- 자기 점검 체크리스트
  reflection text,                          -- 학생 관찰 메모
  is_public boolean default true,
  hidden_by_teacher boolean default false,
  teacher_score int,
  teacher_comment text,
  created_at timestamptz default now()
);
create index if not exists idx_ai8_attempts_student on ai8_attempts (student_id);
create index if not exists idx_ai8_attempts_session_mode on ai8_attempts (session_number, mode);
create index if not exists idx_ai8_attempts_public on ai8_attempts (is_public, hidden_by_teacher);

-- ── project_plans: 5차시 프로젝트 기획서 ───────────────────────────────────────
create table if not exists ai8_project_plans (
  id bigint generated always as identity primary key,
  student_id bigint references ai8_students(id) on delete cascade,
  agent_name text,
  target_user text,
  task_one_liner text,
  tools_used text[],                        -- ["calc","search","memo","date_diff"]
  scenario text,                            -- 작동 시나리오 (3~6단계 글)
  demo_prompt text,
  approved_by_teacher boolean default false,
  created_at timestamptz default now()
);

-- ── discussion_groups: 6차시 토론 조 배정 ──────────────────────────────────────
create table if not exists ai8_discussion_groups (
  id bigint generated always as identity primary key,
  session_id text not null,
  group_number int not null,
  member_student_ids bigint[] not null,
  representative_id bigint,
  created_at timestamptz default now()
);

-- ── gallery_comments: 6차시 갤러리 코멘트 ──────────────────────────────────────
create table if not exists ai8_gallery_comments (
  id bigint generated always as identity primary key,
  attempt_id bigint references ai8_attempts(id) on delete cascade,
  author_student_id bigint references ai8_students(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- ── RLS (단순 — 학교 내부망 수업용) ────────────────────────────────────────────
alter table ai8_students enable row level security;
alter table ai8_attempts enable row level security;
alter table ai8_project_plans enable row level security;
alter table ai8_discussion_groups enable row level security;
alter table ai8_gallery_comments enable row level security;

drop policy if exists "public_all" on ai8_students;
drop policy if exists "public_all" on ai8_attempts;
drop policy if exists "public_all" on ai8_project_plans;
drop policy if exists "public_all" on ai8_discussion_groups;
drop policy if exists "public_all" on ai8_gallery_comments;

create policy "public_all" on ai8_students for all using (true) with check (true);
create policy "public_all" on ai8_attempts for all using (true) with check (true);
create policy "public_all" on ai8_project_plans for all using (true) with check (true);
create policy "public_all" on ai8_discussion_groups for all using (true) with check (true);
create policy "public_all" on ai8_gallery_comments for all using (true) with check (true);

-- ── Storage 버킷 (SQL로 직접 생성) ─────────────────────────────────────────────
-- 버킷 이름: ai8-gallery (다른 수업과 겹치지 않도록 prefix)
insert into storage.buckets (id, name, public)
values ('ai8-gallery', 'ai8-gallery', true)
on conflict (id) do nothing;

drop policy if exists "ai8_gallery_read"   on storage.objects;
drop policy if exists "ai8_gallery_insert" on storage.objects;
drop policy if exists "ai8_gallery_update" on storage.objects;

create policy "ai8_gallery_read" on storage.objects
  for select using (bucket_id = 'ai8-gallery');
create policy "ai8_gallery_insert" on storage.objects
  for insert with check (bucket_id = 'ai8-gallery');
create policy "ai8_gallery_update" on storage.objects
  for update using (bucket_id = 'ai8-gallery');
