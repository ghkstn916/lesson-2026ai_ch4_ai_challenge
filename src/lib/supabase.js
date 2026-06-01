import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
})

export const STUDENTS = 'ai8_students'
export const ATTEMPTS = 'ai8_attempts'
export const PROJECT_PLANS = 'ai8_project_plans'
export const GALLERY_COMMENTS = 'ai8_gallery_comments'
export const GALLERY_BUCKET = 'ai8-gallery'

// ── 학생 ────────────────────────────────────────────────────────────────────
export async function upsertStudent({ sessionId, studentNumber, name }) {
  const { data, error } = await supabase
    .from(STUDENTS)
    .upsert(
      { session_id: sessionId, student_number: studentNumber, name },
      { onConflict: 'session_id,student_number' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// ── 시도 저장 ───────────────────────────────────────────────────────────────
export async function insertAttempt(payload) {
  const { data, error } = await supabase.from(ATTEMPTS).insert(payload).select().single()
  if (error) throw error
  return data
}

export async function fetchMyAttempts({ studentId, mode = null }) {
  let q = supabase.from(ATTEMPTS).select('*').eq('student_id', studentId).order('created_at', { ascending: false })
  if (mode) q = q.eq('mode', mode)
  const { data, error } = await q
  if (error) throw error
  return data
}

// ── 갤러리 ──────────────────────────────────────────────────────────────────
export async function fetchGallery({ sessionNumber = null, mode = null, limit = 100 } = {}) {
  let q = supabase
    .from(ATTEMPTS)
    .select('*, student:ai8_students(id, student_number, name)')
    .eq('is_public', true)
    .eq('hidden_by_teacher', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (sessionNumber) q = q.eq('session_number', sessionNumber)
  if (mode) q = q.eq('mode', mode)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// ── Storage (이미지 등 바이너리) ────────────────────────────────────────────
export async function uploadBlob({ studentId, mode, file, ext = 'png' }) {
  const safeId = String(studentId).replace(/[^\w-]/g, '_')
  const path = `${mode}/${safeId}_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(GALLERY_BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ── 교사용 ──────────────────────────────────────────────────────────────────
export async function fetchAllAttemptsForTeacher() {
  const { data, error } = await supabase
    .from(ATTEMPTS)
    .select('*, student:ai8_students(id, student_number, name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function setTeacherHidden(attemptId, hidden) {
  const { error } = await supabase
    .from(ATTEMPTS)
    .update({ hidden_by_teacher: hidden })
    .eq('id', attemptId)
  if (error) throw error
}

export async function setTeacherScore(attemptId, { score, comment }) {
  const { error } = await supabase
    .from(ATTEMPTS)
    .update({ teacher_score: score, teacher_comment: comment })
    .eq('id', attemptId)
  if (error) throw error
}

// ── 5차시: 프로젝트 기획서 ───────────────────────────────────────────────────
export async function upsertProjectPlan(plan) {
  // student_id 기준 upsert. 한 학생당 1개 기획서 (마지막 저장본이 최신)
  const existing = await fetchMyProjectPlan(plan.student_id)
  if (existing) {
    const { data, error } = await supabase
      .from(PROJECT_PLANS)
      .update(plan)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from(PROJECT_PLANS).insert(plan).select().single()
  if (error) throw error
  return data
}

export async function fetchMyProjectPlan(studentId) {
  const { data, error } = await supabase
    .from(PROJECT_PLANS)
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// ── 6차시: 학급 학생 ─────────────────────────────────────────────────────────
export async function fetchClassStudents(sessionId) {
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('session_id', sessionId)
    .order('student_number', { ascending: true })
  if (error) throw error
  return data
}

/**
 * 같은 학급(session_id)의 모든 project 모드 시도(에이전트 발표·공개 토론·포트폴리오 포함)를
 * 작성자 정보와 함께 created_at 내림차순으로 가져온다. 표시 측에서 challenge_id로 용도를 구분한다.
 */
export async function fetchClassProjectAttempts(sessionId) {
  const students = await fetchClassStudents(sessionId)
  const ids = students.map((s) => s.id)
  if (!ids.length) return []
  return fetchProjectAttemptsForStudents(ids)
}

// ── 6차시: 갤러리 코멘트 ────────────────────────────────────────────────────
export async function addGalleryComment({ attemptId, authorId, content }) {
  const { data, error } = await supabase
    .from(GALLERY_COMMENTS)
    .insert({ attempt_id: attemptId, author_student_id: authorId, content })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchCommentsForAttempts(attemptIds) {
  if (!attemptIds.length) return []
  const { data, error } = await supabase
    .from(GALLERY_COMMENTS)
    .select('*, author:ai8_students(id, student_number, name)')
    .in('attempt_id', attemptIds)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchMyCommentCount(studentId) {
  const { count, error } = await supabase
    .from(GALLERY_COMMENTS)
    .select('id', { count: 'exact', head: true })
    .eq('author_student_id', studentId)
  if (error) throw error
  return count || 0
}

// ── 6차시: 학생별 project mode 작품 가져오기 ─────────────────────────────────
export async function fetchProjectAttemptsForStudents(studentIds) {
  if (!studentIds.length) return []
  const { data, error } = await supabase
    .from(ATTEMPTS)
    .select('*, student:ai8_students(id, student_number, name)')
    .eq('mode', 'project')
    .eq('hidden_by_teacher', false)
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
