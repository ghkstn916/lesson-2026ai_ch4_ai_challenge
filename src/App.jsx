import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import JoinPage from './pages/JoinPage.jsx'
import StudentHome from './pages/StudentHome.jsx'
import GalleryPage from './pages/GalleryPage.jsx'
import GuidePage from './components/GuidePage.jsx'
import PrivacyPage from './components/PrivacyPage.jsx'
import TeacherDashboard from './pages/TeacherDashboard.jsx'

import WarmupMode from './modes/WarmupMode.jsx'
import VisualMode from './modes/VisualMode.jsx'
import ImageMode from './modes/ImageMode.jsx'
import ToolMode from './modes/ToolMode.jsx'
import ReactMode from './modes/ReactMode.jsx'
import ProjectMode from './modes/ProjectMode.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<JoinPage />} />

        <Route path="/student" element={<StudentHome />} />
        <Route path="/student/warmup" element={<WarmupMode />} />
        <Route path="/student/visual" element={<VisualMode />} />
        <Route path="/student/image" element={<ImageMode />} />
        <Route path="/student/tool" element={<ToolMode />} />
        <Route path="/student/react" element={<ReactMode />} />
        <Route path="/student/project" element={<ProjectMode />} />

        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route path="*" element={<Navigate to="/join" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
