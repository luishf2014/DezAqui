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
* Gestão de participações:

  * Visualizar todas as participações em "Meus Tickets"
  * Ver status (pendente/ativa/cancelada)
  * Ver código/ticket único de cada participação
  * Cancelar participações próprias (funcionalidade futura)

---

### 🛠️ Administrador

* **Criação e gestão de concursos**
  * CRUD completo de concursos
  * Configuração de regras (universo numérico, quantidade de números, datas)
* **Gestão de participantes**
  * Listagem completa com busca e filtros
  * Visualização de histórico de participações por usuário
* **Ativação de participações**
  * Automática (Pix) - **Aguardando FASE 3**
  * Manual (pagamentos offline) - ✅ **Implementado**
* **Relatórios e análises** ✅ **Implementado**
  * Relatórios completos, de arrecadação e de rateio
  * Exportação em CSV, PDF e Excel
  * Gráficos de arrecadação por período
  * Cálculo e visualização de rateio
* **Financeiro** ✅ **Implementado**
  * Parametrização de valores de participação por concurso
  * Histórico financeiro completo com filtros avançados
  * Estatísticas financeiras em tempo real
  * Gestão de valores e configurações financeiras
* **Cancelamento de participações** - **Funcionalidade futura**
  * Buscar por código/ticket, nome, email ou telefone
  * Cancelar participações individuais ou múltiplas

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

## 🔄 Fluxo de Pagamentos e Ativação

### 💚 Pagamento via Pix (Automático)

**Fluxo completo:**
1. Usuário seleciona números e cria participação → Status: `pending`
2. **Sistema gera código/ticket único** (ex: TKT-20250124-A1B2C3) automaticamente
3. Sistema gera QR Code Pix via API Asaas
4. Usuário realiza pagamento via Pix
5. **Webhook do Asaas confirma pagamento automaticamente**
6. Sistema atualiza `payments.status: 'pending' → 'paid'`
7. **Sistema ativa participação automaticamente** → `participations.status: 'pending' → 'active'`
8. Usuário recebe confirmação (participação aparece como "Ativa" em "Meus Tickets")
9. Admin pode buscar participação por código/ticket em caso de problemas

**Características:**
- ✅ Ativação 100% automática
- ✅ Sem intervenção manual necessária
- ✅ Rastreabilidade completa via webhook
- ✅ Confirmação em segundos/minutos após pagamento

---

### 💵 Pagamento em Dinheiro (Manual)

**Fluxo completo:**
1. Usuário seleciona números e cria participação → Status: `pending`
2. **Sistema gera código/ticket único** (ex: TKT-20250124-A1B2C3) automaticamente
3. Usuário recebe código/ticket da participação (exibido em "Meus Tickets")
4. Usuário entrega dinheiro ao operador físico e informa o código/ticket
5. **Admin acessa `/admin/activations`**
6. **Admin busca participação por código/ticket ou nome:**
   - Campo de busca por código/ticket disponível
   - Filtro por concurso também disponível
7. **Admin registra pagamento:**
   - Clica em "Registrar Pagamento em Dinheiro"
   - Preenche valor recebido e observações
   - Cria registro em `payments` com `payment_method: 'cash'` e `status: 'paid'`
8. **Sistema ativa participação automaticamente:**
   - Após registrar pagamento, participação é ativada automaticamente
   - Status muda: `pending → active`
   - Modal de sucesso exibe informações do pagamento e ativação

**Características:**
- ⚙️ Requer registro manual do pagamento pelo administrador
- ✅ Ativação automática após registro de pagamento
- 📝 Registro completo do pagamento na tabela `payments`
- 🔍 Rastreabilidade e auditoria completa
- 💼 Ideal para pagamentos offline/presenciais
- 🎉 Modal de sucesso visual após registro e ativação

---

### 📊 Comparação dos Métodos

| Aspecto | Pix (Automático) | Dinheiro (Manual) |
|---------|------------------|-------------------|
| **Ativação** | Automática via webhook | Automática após registro de pagamento |
| **Tempo** | Segundos/minutos | Imediato após registro |
| **Rastreabilidade** | Via webhook Asaas | Via registro manual |
| **Intervenção** | Nenhuma | Requer registro manual do admin |
| **Ideal para** | Pagamentos online | Pagamentos presenciais |

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

### 📊 Resumo do Progresso

| Fase | Status | Progresso | Próximos Passos |
|------|--------|-----------|-----------------|
| **FASE 1** - Fundação do Sistema | ✅ Completa | 100% | Pronta para produção |
| **FASE 2** - Participações e Ranking | 🟡 Em Andamento | ~70% | Cálculos de ranking e acertos |
| **FASE 3** - Pagamentos Pix | ⏳ Aguardando | 0% | Aguarda conclusão Fases 1 e 2 |
| **FASE 4** - Sorteios e Rateio | 🟡 Em Andamento | ~60% | Gestão de sorteios implementada, falta cálculos automáticos |
| **FASE 5** - Finalização | ⏳ Aguardando | 0% | Aguarda fases anteriores |

---

## ✅ O QUE JÁ FOI IMPLEMENTADO

### 🟢 FASE 1 — Fundação do Sistema (Core) ✅

#### **Infraestrutura e Setup**
- [x] Setup do projeto (Vite + React)
- [x] Configuração do Supabase
- [x] Modelagem completa do banco de dados (usuários, concursos, participações, sorteios, pagamentos)

#### **Autenticação e Segurança**
- [x] Sistema de login/cadastro completo
- [x] Contexto de autenticação (AuthContext)
- [x] Verificação de permissões admin (isAdmin)
- [x] Proteção de rotas administrativas (RequireAdmin)
- [x] Políticas RLS para todas as tabelas
- [x] Logout funcional com transições suaves
- [x] Redirecionamento automático pós-login baseado em role (admin/user)
- [x] Persistência de sessão

#### **Painel Administrativo**
- [x] Dashboard administrativo (/admin)
- [x] CRUD completo de concursos
  - [x] Criar, listar, visualizar, editar e deletar concursos
  - [x] Filtros por status (Todos, Ativos, Rascunhos, Finalizados)
- [x] Página de ativações (/admin/activations)
  - [x] Listagem de participações pendentes
  - [x] Busca por código/ticket único
  - [x] Registro de pagamento em dinheiro
  - [x] Ativação automática após registro de pagamento
  - [x] Modal de sucesso visual
- [x] Página de participantes (/admin/participants)
  - [x] Listagem completa de participantes (agrupados por usuário)
  - [x] Filtros por concurso e status
  - [x] Busca por nome, email, código/ticket ou ID
  - [x] Visualização de detalhes e histórico de participações
  - [x] Estatísticas de participantes e participações
- [x] Página de relatórios (/admin/reports) ✅ **IMPLEMENTADO**
  - [x] Geração de relatórios por concurso e sorteio
  - [x] Tipos de relatório: Completo, Arrecadação, Rateio
  - [x] Relatórios de arrecadação por período (últimos 30 dias)
  - [x] Cálculo e visualização de rateio
  - [x] Exportação de dados (CSV, PDF, Excel)
  - [x] Gráficos e análises estatísticas (gráfico de barras de arrecadação)
  - [x] Seleção de concurso e sorteio específico
  - [x] Filtros de período para relatórios de arrecadação
- [x] Página financeiro (/admin/finance) ✅ **IMPLEMENTADO**
  - [x] Parametrização de valores de participação por concurso
  - [x] Configuração de valores por concurso (editar participation_value)
  - [x] Histórico financeiro completo (lista de pagamentos)
  - [x] Estatísticas financeiras (total arrecadado, por método, ticket médio)
  - [x] Filtros avançados (concurso, status, método, período)
  - [x] Gestão completa de descontos e promoções ✅ **IMPLEMENTADO**
    - [x] CRUD completo de descontos
    - [x] Tipos de desconto (percentual e valor fixo)
    - [x] Aplicação global ou por concurso específico
    - [x] Validade e limite de usos
    - [x] Ativação/desativação de descontos
- [x] Página de sorteios (/admin/draws) ✅ **IMPLEMENTADO**
  - [x] Listagem completa de sorteios com filtros por concurso
  - [x] Criação e edição de sorteios
  - [x] Seleção de números manual ou aleatória
  - [x] Validação de quantidade de números baseada no concurso
  - [x] Geração de código único para sorteios (DRW-YYYYMMDD-XXXXXX)
  - [x] Estatísticas de sorteios (total, por concurso, último sorteio)
  - [x] Exclusão de sorteios
- [x] Navegação e layout consistente em todas as páginas
- [x] Sistema de modais de erro com ícones ✅ **RECÉM IMPLEMENTADO**
  - [x] Substituição de todos os `alert()` por modais visuais
  - [x] Ícones específicos por tipo de erro (warning, error, money, calendar, code, name, contest, numbers)
  - [x] Animações suaves e design consistente
  - [x] Implementado em todas as páginas administrativas

#### **Sistema de Tickets**
- [x] Código/ticket único para participações (TKT-YYYYMMDD-XXXXXX)
- [x] Geração automática de código único
- [x] Exibição de código/ticket em todas as interfaces relevantes

#### **UX/UI e Experiência do Usuário**
- [x] Sistema de modais de erro com ícones visuais ✅ **IMPLEMENTADO**
  - [x] Substituição completa de `alert()` por modais customizados
  - [x] Ícones específicos por contexto (erro, aviso, dinheiro, calendário, código, nome, concurso, números)
  - [x] Animações suaves (fadeIn, scaleIn)
  - [x] Design consistente em todas as páginas administrativas
  - [x] Fechamento intuitivo (clique fora ou botão)

#### **🔮 Melhorias Opcionais / Ajustes Futuros (FASE 1)**
*Estas melhorias são opcionais e podem ser implementadas posteriormente para aprimorar a experiência do administrador:*

- [ ] **Filtros por método de pagamento** na página AdminActivations
  - Adicionar filtro para separar participações com pagamento Pix vs Dinheiro
  - Facilita a visualização e gestão por tipo de pagamento
  - *Nota: Será mais útil após implementação da FASE 3 (Pix)*

- [ ] **Histórico completo de ativações e pagamentos**
  - Criar seção de histórico mostrando todas as ativações realizadas
  - Exibir histórico de pagamentos registrados
  - Log de ações administrativas (quem ativou, quando)
  - Melhora rastreabilidade e auditoria

---

### 🟡 FASE 2 — Participações e Ranking ✅ (Parcial)

#### **Segurança (RLS)**
- [x] RLS da tabela profiles
- [x] RLS da tabela contests
- [x] RLS da tabela draws
- [x] RLS da tabela payments
- [x] RLS da tabela participations

#### **Participações do Usuário**
- [x] Pré-cadastro de usuários (via formulário de cadastro)
- [x] Volante numérico dinâmico (00-99)
- [x] Surpresinha automática (geração aleatória)
- [x] Status da participação (pendente / ativa / cancelada)
- [x] Página "Meus Tickets" (/my-tickets)
- [x] Página de detalhes do concurso (/contests/:id)
- [x] Página de participação (/contests/:id/join)
- [x] Lista de concursos ativos (/contests) visível para usuários não autenticados
- [x] Redirecionamento para login ao tentar participar sem autenticação

#### **Visualizações**
- [x] Histórico de sorteios (exibição na página de detalhes)

---

## 🚧 O QUE FALTA IMPLEMENTAR

### 🟡 FASE 2 — Participações e Ranking (Pendências)

#### **Ranking e Cálculos**
- [ ] **Cálculo automático de acertos** quando houver sorteios
- [ ] **Atualização de pontuação** (`current_score`) após sorteios
- [ ] **Ranking em tempo real** (atualização após sorteios)
- [ ] **Destaque visual dos números sorteados** nas participações
- [ ] Testes completos do fluxo de participação

---

### 🔵 FASE 3 — Pagamentos e Ativação (Pix)

**⚠️ PRÉ-REQUISITOS:** Fases 1 e 2 devem estar 100% completas antes de iniciar Fase 3

#### **Integração Asaas Pix**
- [ ] Configuração da API Asaas (credenciais, ambiente sandbox/produção)
- [ ] Serviço de pagamentos (`paymentsService.ts`) para Pix
- [ ] Geração de QR Code Pix dinâmico
- [ ] Página de pagamento Pix (/contests/:id/payment)
- [ ] Webhook endpoint para confirmação de pagamento
- [ ] Processamento de webhook e atualização de `payments.status`
- [ ] Ativação automática da participação após confirmação Pix
- [ ] Tratamento de erros e pagamentos cancelados
- [ ] Logs financeiros completos
- [ ] Testes end-to-end do fluxo Pix completo

---

### 🟣 FASE 4 — Sorteios e Rateio

#### **Gestão de Sorteios** ✅ **PARCIALMENTE IMPLEMENTADO**
- [x] Interface para criar e gerenciar sorteios (/admin/draws) ✅ **IMPLEMENTADO**
  - [x] Listagem completa de sorteios com filtros
  - [x] Criação de sorteios com seleção de números
  - [x] Edição de sorteios existentes
  - [x] Exclusão de sorteios
  - [x] Seleção manual de números (grid interativo)
  - [x] Geração aleatória de números respeitando limites do concurso
  - [x] Validação de quantidade de números baseada em `numbers_per_participation`
  - [x] Botão "Limpar Seleção" para remover todos os números
  - [x] Contador visual de números selecionados
  - [x] Modais de erro com ícones para validações
- [x] Agendamento por data e horário (campo datetime-local)
- [x] Geração de código único para sorteios (DRW-YYYYMMDD-XXXXXX) ✅ **Implementado**
- [x] Estatísticas de sorteios (total, por concurso, último sorteio)

#### **Cálculos e Rateio** (Pendências)
- [ ] Recalculo automático de acertos após sorteios
- [ ] Atualização de ranking após cada sorteio
- [ ] Rateio automático por categoria (cálculo já implementado em `rateioCalculator.ts`, falta integração)
- [ ] Tratamento de empates no rateio
- [ ] **Configuração de Regras de Premiação por Concurso** (FASE 4)
  - [ ] Adicionar campos na tabela `contests` para percentuais de rateio
  - [ ] Interface no `AdminContestForm.tsx` para configurar regras
  - [ ] Integração com `rateioCalculator.ts` para usar regras configuradas

---

## 🔮 FUNCIONALIDADES FUTURAS PLANEJADAS

### ❌ Cancelamento de Participações

**Objetivo:** Permitir que usuários e administradores cancelem participações quando necessário

**Para Administradores:**
- Buscar participações por código/ticket, nome, email ou telefone
- Visualizar todas as participações de um usuário
- Cancelar participações individuais ou múltiplas
- Validações: só pode cancelar se não houver sorteios realizados; não pode cancelar participação já cancelada
- Histórico de cancelamentos para auditoria

**Para Usuários:**
- Cancelar participações próprias em "Meus Tickets"
- Validações: só pode cancelar suas próprias participações; só pode cancelar se não houver sorteios realizados
- Confirmação antes de cancelar
- Feedback visual após cancelamento

**Regras de Negócio:**
- Status permitidos para cancelamento: `pending` ou `active`
- Status após cancelamento: `cancelled`
- Participações canceladas não entram em sorteios futuros
- Histórico permanece para auditoria

**Onde Implementar:**
- AdminActivations: Botão "Cancelar" em cada participação
- AdminParticipants: Gestão completa de participantes
- MyTicketsPage: Botão "Cancelar Participação" em cada ticket

**Prioridade:** Média - Implementar após finalizar Fases 1 e 2

---

### 🔴 FASE 5 — Finalização e Escala

**Objetivo:** Produto pronto para operação real

- [ ] Sistema de notificações (WhatsApp, E-mail, SMS)
- [x] Painel financeiro básico ✅ **Implementado**
- [ ] Gestão de descontos e promoções (funcionalidade futura)
- [ ] Ajustes finais de UX/UI
- [ ] Testes finais completos
- [ ] Documentação final
- [ ] Deploy em produção

---

## ✅ CHECKLIST DE FINALIZAÇÃO

### 🎯 Antes de Iniciar FASE 3 (Asaas Pix)

**FASE 1 - Verificações Finais:**
- [x] Dashboard administrativo funcional
- [x] CRUD completo de concursos
- [x] Página de ativações com registro de pagamento em dinheiro
- [x] Página de participantes com busca e filtros
- [x] Página de relatórios com exportação (CSV, PDF, Excel)
- [x] Sistema de código/ticket único implementado
- [x] Autenticação e autorização funcionando
- [ ] **OPCIONAL:** Filtros por método de pagamento (Pix/Dinheiro)
- [ ] **OPCIONAL:** Histórico completo de ativações e pagamentos
- ✅ **FASE 1 COMPLETA** - Melhorias opcionais documentadas em "Melhorias Opcionais / Ajustes Futuros"

**FASE 2 - Verificações Finais:**
- [x] Participações do usuário funcionando
- [x] Página "Meus Tickets" implementada
- [x] Lista pública de concursos ativos
- [ ] **OBRIGATÓRIO:** Cálculo de acertos após sorteios
- [ ] **OBRIGATÓRIO:** Atualização de pontuação (`current_score`)
- [ ] **OBRIGATÓRIO:** Ranking em tempo real
- [ ] **OBRIGATÓRIO:** Destaque visual dos números sorteados
- [ ] **OBRIGATÓRIO:** Testes completos do fluxo de participação

**⚠️ IMPORTANTE:** As tarefas marcadas como **OBRIGATÓRIO** devem estar 100% completas antes de iniciar a FASE 3 (integração Asaas Pix).

---

## 🚀 Status do Projeto

**📊 Progresso Geral: 48% de 100% finalizado**

* 🟢 **Em desenvolvimento ativo**
* ✅ **FASE 1:** 100% completa ✅ (incluindo melhorias de UX/UI)
* 🟡 **FASE 2:** ~70% completa (faltam cálculos de ranking e acertos)
* ⏳ **FASE 3:** Aguardando conclusão das Fases 1 e 2
* 🟡 **FASE 4:** ~60% completa (gestão de sorteios implementada, falta cálculos automáticos)
* 📦 Arquitetura definida e estável
* ⚙️ Escalável e modular
* 🔒 Segurança implementada (RLS completo)
* 🎨 **UX/UI aprimorada** com modais visuais e ícones

**🎯 Foco Atual:**
- Finalizar cálculos de ranking e acertos (FASE 2)
- Implementar destaque visual dos números sorteados
- Implementar recálculo automático de acertos após sorteios (FASE 4)
- Testes completos do fluxo de participação
- **Próximo passo:** Iniciar FASE 3 (integração Asaas Pix) após conclusão das pendências obrigatórias

**📝 Implementações Recentes:**
- ✅ Sistema completo de modais de erro com ícones (substituição de todos os `alert()`)
- ✅ Página completa de gestão de sorteios (`/admin/draws`)
- ✅ Gestão completa de descontos e promoções (`/admin/finance`)
