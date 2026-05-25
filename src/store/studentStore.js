import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStudentStore = create(
  persist(
    (set) => ({
      // 학생 식별
      studentId: null,       // ai8_students.id
      sessionId: '',         // 학급 (예: "3-5")
      studentNumber: '',
      name: '',

      // API 키
      anthropicKey: '',
      openaiKey: '',

      setStudent: ({ studentId, sessionId, studentNumber, name }) =>
        set({ studentId, sessionId, studentNumber, name }),

      setAnthropicKey: (k) => set({ anthropicKey: k }),
      setOpenaiKey: (k) => set({ openaiKey: k }),

      reset: () =>
        set({
          studentId: null,
          sessionId: '',
          studentNumber: '',
          name: '',
        }),
    }),
    { name: 'ai8-student' }
  )
)

export default useStudentStore
