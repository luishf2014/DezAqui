import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import ContestsListPage from './pages/ContestsListPage'
import ContestDetailsPage from './pages/ContestDetailsPage'
import JoinContestPage from './pages/JoinContestPage'
import LoginPage from './pages/LoginPage'
import MyTicketsPage from './pages/MyTicketsPage'
import RankingPage from './pages/RankingPage'
import RankingsPage from './pages/RankingsPage'
// Importações do guard e páginas admin
import RequireAdmin from './routes/RequireAdmin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminContestsList from './pages/admin/AdminContestsList'
import AdminContestForm from './pages/admin/AdminContestForm'
import AdminDraws from './pages/admin/AdminDraws'
import AdminParticipants from './pages/admin/AdminParticipants'
import AdminActivations from './pages/admin/AdminActivations'
import AdminFinance from './pages/admin/AdminFinance'
import AdminReports from './pages/admin/AdminReports'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* MODIFIQUEI AQUI - Redirecionar para /contests ao abrir o site */}
          <Route path="/" element={<Navigate to="/contests" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/contests" element={<ContestsListPage />} />
          <Route path="/contests/:id" element={<ContestDetailsPage />} />
          {/* Rota de participação adicionada */}
          <Route path="/contests/:id/join" element={<JoinContestPage />} />
          {/* MODIFIQUEI AQUI - Rota de Ranking */}
          <Route path="/contests/:id/ranking" element={<RankingPage />} />
          {/* MODIFIQUEI AQUI - Rota de Rankings Gerais */}
          <Route path="/rankings" element={<RankingsPage />} />
          {/* MODIFIQUEI AQUI - Rota de Meus Tickets */}
          <Route path="/my-tickets" element={<MyTicketsPage />} />
          
          {/* CHATGPT: alterei aqui - Rotas Administrativas protegidas com RequireAdmin usando Outlet */}
          <Route path="/admin" element={<RequireAdmin />}>
            <Route index element={<AdminDashboard />} />
            <Route path="contests" element={<AdminContestsList />} />
            <Route path="contests/new" element={<AdminContestForm />} />
            <Route path="contests/:id" element={<AdminContestForm />} />
            <Route path="draws" element={<AdminDraws />} />
            <Route path="participants" element={<AdminParticipants />} />
            <Route path="activations" element={<AdminActivations />} />
            <Route path="finance" element={<AdminFinance />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
