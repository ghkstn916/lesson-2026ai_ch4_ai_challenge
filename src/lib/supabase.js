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
  return data
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
