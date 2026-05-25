import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
})

export const STUDENTS = 'ai8_students'
export const ATTEMPTS = 'ai8_attempts'
export const PROJECT_PLANS = 'ai8_project_plans'
export const DISCUSSION_GROUPS = 'ai8_discussion_groups'
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

// ── 7차시: 프로젝트 기획서 ───────────────────────────────────────────────────
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

// ── 8차시: 학급 학생 + 자동 조 배정 ─────────────────────────────────────────
export async function fetchClassStudents(sessionId) {
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('session_id', sessionId)
    .order('student_number', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchExistingGroups(sessionId) {
  const { data, error } = await supabase
    .from(DISCUSSION_GROUPS)
    .select('*')
    .eq('session_id', sessionId)
    .order('group_number', { ascending: true })
  if (error) throw error
  return data
}

/**
 * 조 배정 — sessionId의 학생을 랜덤으로 그룹 크기 groupSize씩 묶어 저장.
 * 이미 그룹이 있으면 그대로 반환 (idempotent).
 */
export async function ensureGroups(sessionId, groupSize = 5) {
  const existing = await fetchExistingGroups(sessionId)
  if (existing.length > 0) return existing

  const students = await fetchClassStudents(sessionId)
  if (students.length === 0) return []

  // Fisher–Yates shuffle
  const shuffled = [...students]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const groups = []
  for (let i = 0; i < shuffled.length; i += groupSize) {
    const members = shuffled.slice(i, i + groupSize)
    groups.push({
      session_id: sessionId,
      group_number: groups.length + 1,
      member_student_ids: members.map((s) => s.id),
    })
  }

  const { data, error } = await supabase.from(DISCUSSION_GROUPS).insert(groups).select()
  if (error) throw error
  return data
}

export async function resetGroups(sessionId) {
  const { error } = await supabase.from(DISCUSSION_GROUPS).delete().eq('session_id', sessionId)
  if (error) throw error
}

export async function fetchMyGroup({ sessionId, studentId }) {
  const groups = await fetchExistingGroups(sessionId)
  return groups.find((g) => g.member_student_ids.includes(studentId)) || null
}

// ── 8차시: 갤러리 코멘트 ────────────────────────────────────────────────────
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

// ── 8차시: 학생별 project mode 작품 가져오기 ─────────────────────────────────
export async function fetchProjectAttemptsForStudents(studentIds) {
  if (!studentIds.length) return []
  const { data, error } = await supabase
    .from(ATTEMPTS)
    .select('*, student:ai8_students(id, student_number, name)')
    .eq('mode', 'project')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
