import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import ContestsListPage from './pages/ContestsListPage'
import ContestDetailsPage from './pages/ContestDetailsPage'
import JoinContestPage from './pages/JoinContestPage'
import LoginPage from './pages/LoginPage'
import ProtectedAdminRoute from './components/ProtectedAdminRoute'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminContestsList from './pages/admin/AdminContestsList'
import AdminContestForm from './pages/admin/AdminContestForm'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/contests" element={<ContestsListPage />} />
          <Route path="/contests/:id" element={<ContestDetailsPage />} />
          {/* Rota de participação adicionada */}
          <Route path="/contests/:id/join" element={<JoinContestPage />} />
          
          {/* Rotas Administrativas */}
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/contests"
            element={
              <ProtectedAdminRoute>
                <AdminContestsList />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/contests/new"
            element={
              <ProtectedAdminRoute>
                <AdminContestForm />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin/contests/:id"
            element={
              <ProtectedAdminRoute>
                <AdminContestForm />
              </ProtectedAdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
