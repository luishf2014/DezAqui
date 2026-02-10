import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import Home from './pages/Home'
import ContestsListPage from './pages/ContestsListPage'
import ContestDetailsPage from './pages/ContestDetailsPage'
import JoinContestPage from './pages/JoinContestPage'
import CheckoutPage from './pages/CheckoutPage'
import CartPage from './pages/CartPage'
import LoginPage from './pages/LoginPage'
import MyTicketsPage from './pages/MyTicketsPage'
import RankingPage from './pages/RankingPage'
import RankingsPage from './pages/RankingsPage'
import SettingsPage from './pages/SettingsPage'
import ComoFuncionaPage from './pages/ComoFuncionaPage'
import RegulamentoPage from './pages/RegulamentoPage'
import CentralDeAjudaPage from './pages/CentraldeAjudaPage'
import TermosDeUsoPage from './pages/TermosDeUsoPage'

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
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Redirecionar para /contests ao abrir o site */}
            <Route path="/" element={<Navigate to="/contests" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/contests" element={<ContestsListPage />} />
            <Route path="/contests/:id" element={<ContestDetailsPage />} />
            {/* Rota de participacao adicionada */}
            <Route path="/contests/:id/join" element={<JoinContestPage />} />
            {/* Rota de checkout */}
            <Route path="/contests/:id/checkout" element={<CheckoutPage />} />
            {/* Rota do carrinho */}
            <Route path="/cart" element={<CartPage />} />
            {/* Rota de Ranking */}
            <Route path="/contests/:id/ranking" element={<RankingPage />} />
            {/* Rota de Rankings Gerais */}
            <Route path="/rankings" element={<RankingsPage />} />
            {/* Rota de Meus Tickets */}
            <Route path="/my-tickets" element={<MyTicketsPage />} />
            {/* Rota de Configuracoes */}
            <Route path="/settings" element={<SettingsPage />} />

            {/* Páginas institucionais */}
            <Route path="/como-funciona" element={<ComoFuncionaPage />} />
            <Route path="/regulamento" element={<RegulamentoPage />} />
            <Route path="/central-de-ajuda" element={<CentralDeAjudaPage />} />
            <Route path="/termos-de-uso" element={<TermosDeUsoPage />} />
          
          {/* MODIFIQUEI AQUI - Rotas Administrativas protegidas com RequireAdmin usando Outlet */}
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
      </CartProvider>
    </AuthProvider>
  )
}

export default App
