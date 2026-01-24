import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import ContestsListPage from './pages/ContestsListPage'
import ContestDetailsPage from './pages/ContestDetailsPage'
import JoinContestPage from './pages/JoinContestPage'
import LoginPage from './pages/LoginPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/contests" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/contests" element={<ContestsListPage />} />
          <Route path="/contests/:id" element={<ContestDetailsPage />} />
          {/* Rota de participação adicionada */}
          <Route path="/contests/:id/join" element={<JoinContestPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
