# Plataforma Configurável de Gestão de Concursos Numéricos

## 📌 Visão Geral

Esta plataforma é um **sistema Web + PWA** para gestão de concursos numéricos participativos, permitindo a criação de concursos totalmente configuráveis, controle de participantes, múltiplos sorteios, ranking em tempo real e rateio automático de valores.

O sistema foi concebido como um **motor genérico de concursos**, podendo ser adaptado a diferentes modalidades numéricas (ex.: Mega Sena, Quina, Lotofácil ou modelos personalizados definidos pelo operador).

---

## 🎯 Objetivo do Projeto

Construir uma solução:

* Robusta, escalável e modular
* Totalmente configurável via painel administrativo
* Capaz de automatizar:

  * Ativação de participações
  * Execução de sorteios
  * Cálculo de ranking
  * Rateio financeiro
* Integrada a pagamentos digitais via Pix
* Com **rastreabilidade completa** de dados e eventos

---

## 🧱 Arquitetura Técnica

### Stack Principal

| Camada     | Tecnologia                                    |
| ---------- | --------------------------------------------- |
| Frontend   | React + Vite + TailwindCSS                    |
| Backend    | Supabase (PostgreSQL + Auth + Edge Functions) |
| Pagamentos | Asaas API (Pix)                               |
| Plataforma | Web + PWA                                     |
| IDE        | Cursor (AI‑First Development)                 |

---

## 🚀 Como Começar

### Pré-requisitos

- Node.js 18+ e npm/yarn/pnpm
- Conta no Supabase (https://supabase.com)
- Git

### Instalação

1. **Clone o repositório**
   ```bash
   git clone <repo-url>
   cd gestao-numerica
   ```

2. **Configure o Supabase**
   - Crie um projeto no Supabase
   - Execute as migrações na ordem correta (veja `backend/migrations/README.md`)
   - Anote a URL do projeto e a chave anon

3. **Configure o Frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   ```
   
   Edite `.env.local` com suas credenciais do Supabase:
   ```
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon
   ```

4. **Inicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

O frontend estará disponível em `http://localhost:3000`

---

## 📁 Estrutura do Projeto

```
gestao-numerica/
├── docs/                    # Documentação do projeto
│   ├── 00_context.md        # Contexto geral
│   ├── 01_domain_model.md   # Modelo de domínio
│   ├── 02_phase1_notes.md   # Notas da Fase 1
│   └── 03_architecture.md   # Arquitetura do sistema
├── frontend/                # Aplicação React
│   ├── src/
│   │   ├── contexts/        # Contextos React (Auth, etc)
│   │   ├── lib/             # Bibliotecas e utilitários
│   │   ├── pages/           # Páginas da aplicação
│   │   └── components/      # Componentes reutilizáveis
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   └── migrations/          # Migrações SQL do banco
│       └── 001_init.sql     # Migração inicial
└── README.md
```

---

## 🧩 Funcionalidades do Sistema

### 👤 Usuário Final

* Pré-cadastro com:

  * Nome
  * Celular
  * Seleção de números
* Escolha de números:

  * Manual
  * Automática ("surpresinha")
* Visualização em tempo real de:

  * Ranking
  * Números sorteados (com destaque visual)
  * Histórico de sorteios
  * Progresso geral do concurso

---

### 🛠️ Administrador

* Criação e gestão de concursos
* Configuração de regras:

  * Universo numérico
  * Quantidade de números por participação
  * Datas de início e encerramento
  * Sorteios múltiplos com datas e horários
* Gestão de participantes
* Ativação de participações:

  * Automática (Pix)
  * Manual (pagamentos offline)
* Parametrização financeira
* Visualização de arrecadação e rateio

---

## 🎲 Sorteios

* Múltiplos sorteios por concurso
* Datas e horários configuráveis
* Histórico **imutável** de todos os sorteios
* Reprocessamento automático de:

  * Acertos
  * Ranking
  * Destaques visuais

---

## 🏆 Ranking

* Atualização automática após cada sorteio
* Destaque visual dos números sorteados
* Classificação baseada na quantidade de acertos
* Ranking sempre reflete o **estado atual do concurso**

---

## 💰 Regras de Premiação (Configuráveis)

Distribuição padrão (editável por concurso):

* **65%** — Maior pontuação (ex.: 10 acertos)
* **10%** — Segunda maior pontuação (ex.: 9 acertos)
* **7%** — Menor pontuação
* **18%** — Taxa administrativa

### Menor Pontuação

* Identificada automaticamente como a menor quantidade de acertos entre todas as participações válidas
* Em caso de empate, o valor é dividido igualmente

---

## 💳 Integração com Pagamentos (Pix)

* Integração com **API Asaas**
* Geração de QR Code Pix dinâmico
* Webhooks para confirmação automática de pagamento
* Ativação automática da participação após confirmação
* Ativação manual disponível para pagamentos em dinheiro

> ⚠️ O modelo comercial, fiscal e regulatório junto ao provedor de pagamento é de responsabilidade do operador da plataforma.

---

## 🔔 Notificações

* Notificação automática de vencedores ao final do concurso
* Canais configuráveis:

  * WhatsApp
  * E-mail
  * SMS

---

## 📦 Entregáveis

* Plataforma Web/PWA funcional
* Backend com APIs documentadas
* Integração Pix operante
* Manual de operação (PDF)
* Código-fonte completo

---

## ⚠️ Observação Técnica e Legal

Esta plataforma é fornecida **exclusivamente como uma solução tecnológica configurável**.

Toda e qualquer responsabilidade legal, fiscal, regulatória ou comercial relacionada ao uso da plataforma é integralmente do operador.

---

## 🗺️ Roadmap de Desenvolvimento

### 🟢 FASE 1 — Fundação do Sistema (Core)

**Objetivo:** Criar a base técnica sólida do sistema

* [x] Setup do projeto (Vite + React)
* [x] Configuração do Supabase
* [x] Modelagem do banco de dados

  * [x] Usuários
  * [x] Concursos
  * [x] Participações
  * [x] Sorteios
  * [x] Pagamentos
* [x] Autenticação administrativa
  * [x] Sistema de login/cadastro
  * [x] Contexto de autenticação (AuthContext)
  * [x] Verificação de permissões admin (isAdmin)
  * [x] Proteção de rotas administrativas (RequireAdmin)
  * [x] Correção de políticas RLS para perfis
  * [x] Logout funcional com transições suaves
  * [x] Redirecionamento automático pós-login baseado em role
  * [x] Persistência de sessão
* [x] Painel administrativo básico
  * [x] Dashboard administrativo (/admin)
  * [x] Lista de concursos (/admin/contests)
  * [x] Formulário de criar/editar concursos (/admin/contests/new, /admin/contests/:id)
  * [x] Placeholders para módulos futuros (sorteios, participantes, ativações, financeiro, relatórios)
  * [x] Navegação e layout consistente
* [x] CRUD de concursos
  * [x] Criar novo concurso
  * [x] Listar todos os concursos
  * [x] Visualizar detalhes do concurso
  * [x] Editar concurso existente
  * [x] Deletar concurso
  * [x] Filtros por status (Todos, Ativos, Rascunhos, Finalizados)

---

### 🟡 FASE 2 — Participações e Ranking

**Objetivo:** Segurança e experiência completa do usuário final

**Segurança (RLS):**
* [x] RLS da tabela profiles
* [x] RLS da tabela contests
* [x] RLS da tabela draws
* [x] RLS da tabela payments
* [x] RLS da tabela participations

**Participações e Ranking:**
* [ ] Pré-cadastro de usuários
* [x] Volante numérico dinâmico
* [x] Surpresinha automática
* [x] Status da participação (pendente / ativa)
* [ ] Ranking em tempo real
* [ ] Destaque visual dos números sorteados
* [x] Histórico de sorteios

---

### 🔵 FASE 3 — Pagamentos e Ativação

**Objetivo:** Automatização financeira

* [ ] Integração Asaas Pix
* [ ] Geração de QR Code dinâmico
* [ ] Webhook de confirmação de pagamento
* [ ] Ativação automática da participação
* [ ] Ativação manual pelo administrador
* [ ] Logs financeiros

---

### 🟣 FASE 4 — Sorteios e Rateio

**Objetivo:** Inteligência de negócio

* [ ] Cadastro de sorteios
* [ ] Agendamento por data e horário
* [ ] Recalculo automático de acertos
* [ ] Atualização de ranking
* [ ] Rateio automático por categoria
* [ ] Tratamento de empates

---

### 🔴 FASE 5 — Finalização e Escala

**Objetivo:** Produto pronto para operação real

* [ ] Sistema de notificações
* [ ] Painel financeiro avançado
* [ ] Relatórios
* [ ] Ajustes finais de UX/UI
* [ ] Testes finais
* [ ] Documentação final
* [ ] Deploy

---

## 🚀 Status do Projeto

* 🟢 Em desenvolvimento
* 📦 Arquitetura definida
* ⚙️ Escalável
* 🔒 Preparado para produção
