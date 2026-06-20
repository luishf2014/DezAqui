import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
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
import LastPurchasePage from './pages/LastPurchasePage'
import RankingPage from './pages/RankingPage'
import RankingsPage from './pages/RankingsPage'
import SettingsPage from './pages/SettingsPage'
import ComoFuncionaPage from './pages/ComoFuncionaPage'
import RegulamentoPage from './pages/RegulamentoPage'
import CentralDeAjudaPage from './pages/CentraldeAjudaPage'
import TermosDeUsoPage from './pages/TermosDeUsoPage'
import PoliticaApostaPage from './pages/PoliticaApostaPage'
import PoliticaKYCPage from './pages/PoliticaKYCPage'
import JogoResponsavelPage from './pages/JogoResponsavelPage'
import PoliticaPrivacidadePage from './pages/PoliticaPrivacidadePage'
import NotificationsPage from './pages/NotificationsPage'
import PurchaseSuccessPage from './pages/PurchaseSuccessPage'

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
import AdminPartners from './pages/admin/AdminPartners'
import SellerAreaPage from './pages/SellerAreaPage'
import ReferAndEarnPage from './pages/ReferAndEarnPage'
import RequireSeller from './routes/RequireSeller'
import MustChangePasswordGate from './components/MustChangePasswordGate'

function LegacyConcursosContestRedirect({ suffix }: { suffix?: string }) {
  const { id } = useParams<{ id: string }>()
  const loc = useLocation()
  if (!id) return <Navigate to="/contests" replace />
  const base = suffix ? `/contests/${id}${suffix}` : `/contests/${id}`
  return <Navigate to={`${base}${loc.search}`} replace />
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <MustChangePasswordGate />
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
            {/* MODIFIQUEI AQUI - alias em português (?ref=CÓDIGO) */}
            <Route path="/concursos/:id" element={<LegacyConcursosContestRedirect />} />
            <Route path="/concursos/:id/join" element={<LegacyConcursosContestRedirect suffix="/join" />} />
            {/* Rota do carrinho */}
            <Route path="/cart" element={<CartPage />} />
            {/* Página de sucesso de compra */}
            <Route path="/compra/sucesso" element={<PurchaseSuccessPage />} />
            {/* Rota de Ranking */}
            <Route path="/contests/:id/ranking" element={<RankingPage />} />
            {/* Rota de Rankings Gerais */}
            <Route path="/rankings" element={<RankingsPage />} />
            {/* Rota de Meus Tickets */}
            <Route path="/my-tickets" element={<MyTicketsPage />} />
            {/* Rota de Última Compra */}
            <Route path="/ultima-compra" element={<LastPurchasePage />} />
            {/* Configurações: qualquer usuário autenticado (comum ou admin); cada um vê só o próprio perfil (RLS + id da sessão) */}
            <Route path="/settings" element={<SettingsPage />} />
            {/* Rota de Notificações */}
            <Route path="/notifications" element={<NotificationsPage />} />
            {/* MODIFIQUEI AQUI — apenas profiles.is_seller (guard no RequireSeller). */}
            <Route path="/meu-link" element={<RequireSeller><SellerAreaPage /></RequireSeller>} />
            <Route path="/minhas-vendas" element={<RequireSeller><SellerAreaPage /></RequireSeller>} />
            <Route path="/indique-e-ganhe" element={<ReferAndEarnPage />} />

            {/* Páginas institucionais */}
            <Route path="/como-funciona" element={<ComoFuncionaPage />} />
            <Route path="/regulamento" element={<RegulamentoPage />} />
            <Route path="/central-de-ajuda" element={<CentralDeAjudaPage />} />
            <Route path="/termos-de-uso" element={<TermosDeUsoPage />} />
            <Route path="/politica-de-aposta" element={<PoliticaApostaPage />} />
            <Route path="/politica-kyc" element={<PoliticaKYCPage />} />
            <Route path="/jogo-responsavel" element={<JogoResponsavelPage />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidadePage />} />
          
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
            <Route path="partners" element={<AdminPartners />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
