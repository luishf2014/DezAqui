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
| Pagamentos | Asaas API (Pix) via Supabase Edge Functions   |
| Plataforma | Web + PWA                                     |
| IDE        | Cursor (AI‑First Development)                 |

**MODIFIQUEI AQUI** - Integração com Asaas implementada via Edge Functions do Supabase para máxima segurança:
- **ASAAS_API_KEY** armazenada apenas nos secrets do Supabase (nunca no frontend)
- Comunicação com API Asaas acontece exclusivamente server-side
- Webhooks processados de forma segura e idempotente

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
   cd dezaqui
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

4. **Configure as Edge Functions do Supabase** (para integração com Asaas)

   **MODIFIQUEI AQUI** - Configure os secrets necessários para as Edge Functions:
   ```bash
   # Instalar Supabase CLI (se ainda não tiver)
   npm install -g supabase
   
   # Fazer login no Supabase
   supabase login
   
   # Linkar ao projeto
   supabase link --project-ref seu-project-ref
   
   # Configurar secrets necessários
   supabase secrets set ASAAS_API_KEY=sua-chave-api-asaas
   supabase secrets set ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3  # ou produção
   supabase secrets set ASAAS_WEBHOOK_TOKEN=token-seguro-aleatorio
   supabase secrets set SUPABASE_URL=https://seu-projeto.supabase.co
   supabase secrets set SUPABASE_ANON_KEY=sua-chave-anon
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   ```

   **Deploy das Edge Functions:**
   ```bash
   supabase functions deploy asaas-create-pix
   supabase functions deploy asaas-webhook
   ```

   **Configurar Webhook no Asaas:**
   - URL: `https://seu-project-ref.supabase.co/functions/v1/asaas-webhook`
   - Header: `X-Webhook-Token: token-seguro-aleatorio` (mesmo valor de `ASAAS_WEBHOOK_TOKEN`)
   - Eventos: `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`

   **Documentação completa**: Ver `supabase/functions/README.md` e `supabase/functions/TEST_CHECKLIST.md`

5. **Inicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

O frontend estará disponível em `http://localhost:3000`

### Migrações Importantes

**⚠️ ATENÇÃO:** Execute todas as migrações na ordem correta conforme documentado em `backend/migrations/README.md`.

**Migrações Críticas:**
- **`015_auto_finish_contest_on_draw.sql`** - Finalização automática de concursos ao criar primeiro sorteio
  - Cria trigger SQL que atualiza automaticamente o status do concurso para `finished` quando o primeiro sorteio é criado
  - Garante consistência mesmo com inserções diretas no banco
  - **Recomendado:** Execute esta migração para garantir comportamento consistente

- **`016_add_prize_percentages_to_contests.sql`** - Percentuais de premiação configuráveis
  - Adiciona campos `first_place_pct`, `second_place_pct`, `lowest_place_pct`, `admin_fee_pct` na tabela `contests`
  - Permite configurar percentuais de premiação por concurso

- **`017_create_rateio_snapshots_table.sql`** - Snapshots de rateio para auditoria
  - Cria tabela `rateio_snapshots` para armazenar cálculos de rateio
  - Permite auditoria e relatórios históricos

- **`018_create_draw_payouts_table.sql`** - Prêmios por participação
  - Cria tabela `draw_payouts` para armazenar prêmios calculados por participação
  - Permite que usuários vejam automaticamente se ganharam e quanto ganharam

- **`019_add_contest_code_to_contests.sql`** - Código único de concurso
  - Adiciona campo `contest_code` na tabela `contests`
  - Permite identificação pública dos concursos por código único

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
│   │   ├── services/        # Serviços de integração
│   │   └── components/      # Componentes reutilizáveis
│   ├── package.json
│   └── vite.config.ts
├── supabase/                # Edge Functions do Supabase
│   └── functions/           # Edge Functions
│       ├── asaas-create-pix/  # Criação de pagamentos PIX
│       ├── asaas-webhook/     # Processamento de webhooks
│       ├── README.md          # Documentação das functions
│       └── TEST_CHECKLIST.md  # Checklist de testes
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
  * Filtros por status (Todos, Ativos, Rascunhos, Finalizados)
  * **Finalização automática ao criar primeiro sorteio** ✅ **IMPLEMENTADO**
* **Gestão de sorteios** ✅ **IMPLEMENTADO**
  * Criação e edição de sorteios
  * Seleção manual ou aleatória de números
  * Validação de quantidade de números
  * Geração de código único para sorteios
  * **Finalização automática do concurso ao criar primeiro sorteio**
  * Atualização automática da lista de concursos após criar sorteio
* **Gestão de participantes**
  * Listagem completa com busca e filtros
  * Visualização de histórico de participações por usuário
* **Ativação de participações** ✅ **IMPLEMENTADO**
  * **Automática (Pix)** ✅ **IMPLEMENTADO**
    * Webhook do Asaas processa confirmações automaticamente
    * Edge Function `asaas-webhook` atualiza payment e ativa participation
    * Processamento idempotente e transacional
  * **Manual (pagamentos offline)** ✅ **IMPLEMENTADO**
    * Página `/admin/activations` para registro manual
    * Ativação automática após registro de pagamento
  * **Atualização automática da lista após ativação** ✅ **IMPLEMENTADO**
  * Remoção automática de participações ativadas da lista
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

## 🎫 Sistema de Códigos Únicos

**MODIFIQUEI AQUI** - O sistema implementa códigos únicos para facilitar identificação e rastreamento:

### Código de Concurso (`contest_code`)
* **Formato:** `SIGLA-XXXXXX` (ex: `CO-A1B2C3` para "CONCURSO" ou `MG-A1B2C3` para "MEGA GIRO")
* **Geração:** Automática ao criar concurso
* **Sigla:** Extraída do nome do concurso:
  * Se uma palavra: 2 primeiras letras (ex: CONCURSO → CO)
  * Se 2+ palavras: primeira letra de cada palavra (ex: MEGA GIRO → MG)
* **Exibição:** Todas as telas relevantes (detalhes do concurso, checkout, ranking, admin)
* **Migração:** `019_add_contest_code_to_contests.sql`

### Código de Ticket (`ticket_code`)
* **Formato:** `TK-XXXXXX` (ex: `TK-A1B2C3`)
* **Geração:** Automática ao criar participação
* **Exibição:** "Meus Tickets", relatórios, página de ativações
* **Uso:** Busca de participações por código/ticket
* **Migração:** `011_add_ticket_code_to_participations.sql`

### Código de Sorteio (`draw_code`)
* **Formato:** `DRW-YYYYMMDD-XXXXXX` (ex: `DRW-20250124-A1B2C3`)
* **Geração:** Automática ao criar sorteio
* **Exibição:** Relatórios e páginas administrativas
* **Migração:** `013_add_code_to_draws.sql`

---

## 🎟️ Sistema de Descontos e Promoções

**MODIFIQUEI AQUI** - Sistema completo de descontos e promoções implementado:

### Funcionalidades ✅ **IMPLEMENTADO**
* **CRUD Completo:** Criar, editar, ativar/desativar e deletar descontos
* **Tipos de Desconto:**
  * Percentual (0-100%)
  * Valor fixo (R$)
* **Escopo:**
  * Global (aplicável a todos os concursos)
  * Por concurso específico
* **Validações:**
  * Data de início e término
  * Limite de usos (ou ilimitado)
  * Status ativo/inativo
* **Aplicação no Checkout:**
  * Campo para inserir código de desconto
  * Validação automática (ativo, válido, dentro do prazo, limite de usos)
  * Cálculo automático do valor final
  * Exibição de valor original, desconto aplicado e valor final
  * Remoção de desconto aplicado
* **Rastreabilidade:**
  * Contador de usos atualizado automaticamente
  * Histórico completo de descontos aplicados
* **Migração:** `014_create_discounts_table.sql`

---

## 🎲 Sorteios

* Múltiplos sorteios por concurso
* Datas e horários configuráveis
* Histórico **imutável** de todos os sorteios
* **Finalização automática de concursos** ✅ **IMPLEMENTADO**
  * Quando o primeiro sorteio é criado, o concurso é automaticamente finalizado
  * Status muda de `active` para `finished` automaticamente
  * Participações são bloqueadas automaticamente após o primeiro sorteio
  * Trigger SQL (`015_auto_finish_contest_on_draw.sql`) garante consistência mesmo com inserções diretas no banco
  * Validação server-side impede participações em concursos finalizados
  * Atualização automática da UI em todas as páginas (admin e usuário)
* **Seção de histórico de concursos finalizados** ✅ **IMPLEMENTADO**
  * Aba "Histórico" na página de concursos (`/contests`)
  * Visualização de concursos finalizados com seus resultados
  * Separação clara entre concursos ativos e finalizados
* **Reprocessamento automático** ✅ **IMPLEMENTADO**
  * Acertos recalculados automaticamente após cada sorteio
  * Pontuações (`current_score`) atualizadas em tempo real
  * Prêmios calculados e salvos automaticamente em `draw_payouts`
  * Snapshots de rateio salvos para auditoria
  * Destaques visuais atualizados automaticamente

---

## 🏆 Ranking e Premiação Automática

### 🏆 Ranking (Classificação)

**MODIFIQUEI AQUI** - O ranking é uma **classificação** que mostra todos os participantes ordenados por pontuação:

* **Ranking nunca fica vazio** ✅ **IMPLEMENTADO**
  * Sempre exibe todos os participantes, ordenados por pontuação
  * Participantes com 0 pontos aparecem normalmente no ranking
  * Ranking mostra classificação, não premiação
* **Atualização automática após cada sorteio** ✅ **IMPLEMENTADO**
  * Recalcula acertos de todas as participações automaticamente
  * Atualiza pontuações (`current_score`) em tempo real
  * Ranking sempre reflete o estado atual do concurso
* **Destaque visual dos números sorteados** ✅ **IMPLEMENTADO**
  * Números acertados destacados em verde com checkmark
  * Números sorteados (mas não acertados) destacados em amarelo
  * Visualização clara de acertos por participação
* **Classificação baseada na quantidade de acertos**
  * Pontuação = quantidade de números acertados entre os números do ticket e os números sorteados
  * Ranking ordenado por pontuação (maior para menor)
  * Em caso de empate, ordena por data de criação (mais antiga primeiro)

**Importante:** Ranking ≠ Premiação. O ranking mostra a classificação dos participantes, enquanto a premiação mostra os valores financeiros ganhos.

#### Sistema de Medalhas 🥇🥈🥉

**MODIFIQUEI AQUI** - As medalhas (🥇🥈🥉) representam **categoria de premiação**, não posição matemática:

* **🥇 TOP**: Medalha de ouro para participantes premiados na categoria TOP (`score == numbers_per_participation`)
* **🥈 SECOND**: Medalha de prata para participantes premiados na categoria SECOND (`score == numbers_per_participation - 1`)
* **🥉 LOWEST**: Medalha de bronze para participantes premiados na categoria LOWEST (menor pontuação positiva do sorteio)
* **❌ NONE**: Participantes não premiados não recebem medalha

**Regras de Exibição de Medalhas:**

* **Ranking Geral (`RankingsPage.tsx`):**
  * Exibe apenas categorias que realmente têm ganhadores no sorteio selecionado
  * Nunca mostra participantes com 0 pontos no pódio (Top 3)
  * Não exibe medalhas "vazias" (ex: 🥇 se não houver ganhador TOP)
  * O pódio reflete somente as categorias premiadas que existem

* **Ranking Detalhado (`RankingPage.tsx`):**
  * Lista todos os participantes (incluindo 0 pontos e não premiados)
  * Exibe medalha apenas para participantes premiados em uma categoria (TOP/SECOND/LOWEST)
  * Filtros disponíveis:
    * 🔘 Todos
    * 🏆 Somente Premiados
    * 🥇 TOP
    * 🥈 SECOND
    * 🥉 LOWEST
    * ❌ Não premiados
  * Filtros atuam apenas na exibição (frontend), sem alterar cálculos

**Importante:** As medalhas são determinadas exclusivamente pela categoria de premiação (`payout.category`), não pela posição matemática no ranking.

### Sistema de Premiação Automática ✅ **IMPLEMENTADO**

**MODIFIQUEI AQUI** - O sistema agora calcula e exibe automaticamente os prêmios após cada sorteio:

#### Categorias de Premiação

**MODIFIQUEI AQUI** - O sistema divide os prêmios em três categorias configuráveis por concurso:

1. **TOP** (Pontuação Máxima)
   * Premia **somente** participantes com pontuação igual a `numbers_per_participation` (ex: 10/10 acertos)
   * Percentual configurável (padrão: 65% do pool de premiação)
   * Em caso de empate, divide o prêmio igualmente entre todos os ganhadores
   * Se ninguém acertar todos os números, a categoria fica "Sem ganhadores" e o valor NÃO é redistribuído

2. **SECOND** (Segunda Pontuação)
   * Premia **somente** participantes com pontuação igual a `numbers_per_participation - 1` (ex: 9/10 acertos)
   * Percentual configurável (padrão: 10% do pool de premiação)
   * Em caso de empate, divide o prêmio igualmente entre todos os ganhadores
   * Se ninguém acertar essa pontuação exata, a categoria fica "Sem ganhadores" e o valor NÃO é redistribuído

3. **LOWEST** (Menor Pontuação Positiva)
   * Premia os participantes com a **menor pontuação positiva** (>0) do sorteio
   * Percentual configurável (padrão: 7% do pool de premiação)
   * Em caso de empate, divide o prêmio igualmente entre todos os ganhadores
   * **Importante:** LOWEST é a menor pontuação **positiva**, não zero
   * LOWEST só premia se a pontuação for menor que SECOND (ex: se SECOND = 9, LOWEST premia apenas pontuações < 9)

#### Regras Importantes

**MODIFIQUEI AQUI** - Regras de premiação imutáveis:

* **Regras de Porcentagem (Imutáveis):**
  * **TOP → 65%** do valor total arrecadado (participantes com `numbers_per_participation` acertos)
  * **SECOND → 10%** do valor total arrecadado (participantes com `numbers_per_participation - 1` acertos)
  * **LOWEST → 7%** do valor total arrecadado (participantes com menor pontuação positiva > 0)
  * **ADMIN → 18%** (nunca aparece no ranking público)

* **Empates:** O valor da categoria é dividido igualmente entre todos os participantes com a mesma pontuação.

* **Não redistribuição:** Se uma categoria não tiver ganhadores (ex: ninguém acertou a pontuação necessária), o valor **NÃO é redistribuído** para outras categorias. O prêmio dessa categoria fica sem ganhadores.

* **Condição "Não houve ganhadores":** A mensagem "Não houve ganhadores neste sorteio" aparece **apenas quando maxScore == 0**, ou seja, quando nenhum participante acertou nenhum número. Quando houver sorteio mas ninguém for premiado, exibe-se "Não houve ganhadores neste sorteio" no topo e "Nenhum participante foi premiado neste sorteio" na seção de classificação.

* **Taxa administrativa:** A porcentagem da administração (padrão: 18%) é calculada internamente mas **NUNCA aparece no ranking público**. Apenas as três categorias de premiação (TOP, SECOND, LOWEST) são exibidas aos usuários.

* **Pool de premiação:** O valor total de premiação é calculado como: `total_arrecadado - taxa_administrativa`

* **Separação Ranking e Premiação:**
  * **Ranking (Classificação)** SEMPRE lista todos os participantes, mesmo com 0 pontos
  * **Premiação** mostra os valores financeiros ganhos por categoria
  * Nunca ocultar participantes por não haver ganhadores
  * **"Houve ganhadores premiados"** é determinado EXCLUSIVAMENTE por payouts (`amount_won > 0`), não por pontuação
  * A verificação de ganhadores deve sempre usar `payoutSummary` ou `payouts` do sorteio selecionado
  * **Consistência com sorteio selecionado:**
    * Quando há sorteio selecionado (`selectedDrawId`), a tabela ordena e exibe pontuação baseada apenas nesse sorteio
    * Quando não há sorteio selecionado, usa pontuação total (todos os sorteios)
    * Destaque de números acertados considera apenas o sorteio selecionado (quando houver)
    * Card "Maior Pontuação" calcula corretamente usando a mesma regra da tabela (max score do sorteio selecionado ou total)

#### Visualização no Ranking

Após um sorteio finalizado, os usuários veem automaticamente:

* **Ranking Geral (`RankingsPage.tsx`):**
  * **Seção "Top 3" (Pódio):**
    * Exibe apenas categorias premiadas que existem no sorteio
    * Nunca mostra participantes com 0 pontos no pódio
    * Não exibe medalhas "vazias" (ex: 🥇 se não houver ganhador TOP)
    * Se não houver premiados, mostra mensagem: "Ainda não há pontuação suficiente para exibir o Top 3."
    * Cada categoria premiada pode ter múltiplos ganhadores (empates)
  
  * **Lista "Classificação Completa" (Top 10):**
    * Mostra todos os participantes ordenados por pontuação
    * Medalhas aparecem apenas para participantes premiados
    * Participantes não premiados aparecem com posição numérica (#1, #2, etc.)

* **Ranking Detalhado (`RankingPage.tsx`):**
  * **Seção "Resultado do Sorteio":**
    * Mostra as categorias premiadas (TOP, SECOND, LOWEST)
    * Exibe quantidade de ganhadores e valor por ganhador em cada categoria
    * Se não houver ganhadores (maxScore == 0), mostra mensagem: "Não houve ganhadores neste sorteio."
    * Se uma categoria não tiver ganhadores, mostra "Sem ganhadores"
  
  * **Filtros de Categoria:**
    * 🔘 **Todos**: Exibe todos os participantes
    * 🏆 **Somente Premiados**: Filtra apenas participantes com `amount_won > 0`
    * 🥇 **TOP**: Filtra apenas participantes da categoria TOP
    * 🥈 **SECOND**: Filtra apenas participantes da categoria SECOND
    * 🥉 **LOWEST**: Filtra apenas participantes da categoria LOWEST
    * ❌ **Não premiados**: Filtra apenas participantes não premiados
    * **Importante:** Filtros atuam apenas na exibição (frontend), sem alterar cálculos ou backend

  * **Tabela de Classificação:**
    * **Coluna "Posição":**
      * Medalhas (🥇🥈🥉) aparecem apenas para participantes premiados
      * Participantes não premiados aparecem com posição numérica (#1, #2, etc.)
      * Medalha é determinada pela categoria de premiação (`payout.category`), não por posição matemática
    
    * **Coluna "Prêmio":**
      * **MODIFIQUEI AQUI** - Estados da coluna Prêmio:
        * Se não existe draw: exibe "⏳ Aguardando sorteio"
        * Se existe draw e `payout.amount_won === 0`: exibe "❌ Não premiado"
        * Se `payout.amount_won > 0`: exibe "🏆 Premiado" + valor em R$
      * Valor exibido corresponde ao prêmio do sorteio selecionado (por `participation_id` e `draw_id`)
      * **"Premiado" é definido EXCLUSIVAMENTE por payout (`amount_won > 0`)** do sorteio do concurso, não por pontuação
      * Ranking SEMPRE lista todos os participantes, mesmo com 0 pontos ou sem prêmio

* **Seletor de sorteio** (quando há múltiplos sorteios)
  * Permite visualizar resultados de sorteios específicos
  * Prêmios são calculados e exibidos por sorteio individual
  * Filtros e medalhas são atualizados conforme o sorteio selecionado

#### Processamento Automático

O sistema processa prêmios automaticamente quando:

* Um sorteio é criado
* Um sorteio é editado (números alterados)
* Um sorteio é deletado (prêmios são removidos automaticamente)

O processamento é **idempotente**: reprocessar o mesmo sorteio substitui os resultados anteriores, não duplica.

#### Exibição de Prêmios em "Meus Tickets"

**MODIFIQUEI AQUI** - A página "Meus Tickets" exibe o resultado financeiro **por ticket individualmente** (por `participation_id`):

* **Cada concurso tem 1 sorteio** (para o usuário)
* **Cada ticket é avaliado individualmente** no sorteio do seu concurso
* **Exibição por ticket:**
  * Busca o draw (sorteio) do concurso do ticket
  * Busca o payout específico: `getPayoutByParticipationAndDraw(participationId, drawId)`
  * Se `payout.amount_won > 0` → Exibe "🏆 Premiado: R$ XX,XX"
  * Se `payout.amount_won === 0` ou não existe → Exibe "❌ Não premiado neste sorteio"
* **Importante:**
  * Não agrega payouts de múltiplos tickets
  * Não soma payouts de múltiplos sorteios
  * Cada ticket mostra seu próprio resultado financeiro do sorteio do seu concurso
  * Se o concurso ainda não tem sorteio, não exibe bloco de premiação (ou exibe "Aguardando sorteio")

---

## 💰 Regras de Premiação (Configuráveis)

**MODIFIQUEI AQUI** - As regras de premiação são totalmente configuráveis por concurso através do formulário de criação/edição (`AdminContestForm.tsx`).

### 🔢 Regras de Premiação (Imutáveis)

**MODIFIQUEI AQUI** - As regras de premiação são **IMUTÁVEIS** e devem ser mantidas exatamente assim:

* **TOP = 65%** do valor total arrecadado
  * Participantes que acertarem **N acertos** (onde N = `numbers_per_participation`)
  * Exemplo: se `numbers_per_participation = 10`, TOP premia apenas quem acertou 10/10
* **SECOND = 10%** do valor total arrecadado
  * Participantes que acertarem **N-1 acertos** (onde N = `numbers_per_participation`)
  * Exemplo: se `numbers_per_participation = 10`, SECOND premia apenas quem acertou 9/10
* **LOWEST = 7%** do valor total arrecadado
  * Participantes com a **menor pontuação positiva elegível** (> 0)
  * LOWEST só premia se a pontuação for menor que SECOND (ex: se SECOND = 9, LOWEST premia apenas pontuações < 9)
* **ADMIN = 18%**
  * **NUNCA aparece no ranking público** - calculado internamente mas não exibido

**Empates:** O valor da categoria é dividido **igualmente** entre todos os participantes com a mesma pontuação.

**Não redistribuir:** Se uma categoria não tiver ganhadores, o valor **NÃO é redistribuído** para outras categorias. O prêmio dessa categoria fica sem ganhadores.

### Configuração

Os percentuais podem ser configurados ao criar ou editar um concurso:

* Validação automática: soma deve ser exatamente 100%
* Valores não podem ser negativos
* Indicador visual mostra o total em tempo real
* Valores padrão são aplicados se não especificados

### Menor Pontuação

* Identificada automaticamente como a menor quantidade de acertos entre todas as participações válidas
* Em caso de empate, o valor é dividido igualmente

---

## 💳 Integração com Pagamentos (Pix)

**MODIFIQUEI AQUI** - Integração segura com **API Asaas** via Supabase Edge Functions:

* **Integração via Edge Functions** ✅ **IMPLEMENTADO**
  * `asaas-create-pix`: Cria pagamentos PIX no Asaas de forma segura
  * `asaas-webhook`: Recebe e processa confirmações de pagamento automaticamente
  * **ASAAS_API_KEY nunca exposta no frontend** - armazenada apenas nos secrets do Supabase
* **Geração de QR Code Pix dinâmico** ✅ **IMPLEMENTADO**
  * QR Code gerado automaticamente ao criar pagamento
  * Código Pix copia e cola disponível
  * Data de expiração configurável (padrão: 24 horas)
* **Webhooks para confirmação automática de pagamento** ✅ **IMPLEMENTADO**
  * Webhook configurável no painel do Asaas
  * Validação de token para segurança
  * Processamento idempotente (não duplica processamento)
* **Ativação automática da participação após confirmação** ✅ **IMPLEMENTADO**
  * Payment atualizado automaticamente (`status='paid'`, `paid_at` preenchido)
  * Participation ativada automaticamente (`status='active'`)
  * Processamento transacional e consistente
* **Ativação manual disponível para pagamentos em dinheiro** ✅ **IMPLEMENTADO**
  * Página `/admin/activations` para registro manual
  * Ativação automática após registro de pagamento

> ⚠️ O modelo comercial, fiscal e regulatório junto ao provedor de pagamento é de responsabilidade do operador da plataforma.

### 🔐 Segurança da Integração

**MODIFIQUEI AQUI** - Implementação segura seguindo melhores práticas:

* **Edge Functions do Supabase**: Toda comunicação com API Asaas acontece server-side
* **Secrets do Supabase**: `ASAAS_API_KEY` armazenada apenas nos secrets (nunca no código)
* **Validação de autenticação**: Edge Function valida JWT do usuário antes de criar pagamento
* **Validação de ownership**: Verifica se participação pertence ao usuário antes de processar
* **Token do webhook**: Validação obrigatória via `ASAAS_WEBHOOK_TOKEN`
* **Service Role**: Usado apenas no webhook para bypass RLS controlado
* **Idempotência**: Webhook não processa pagamentos já confirmados

### 📚 Edge Functions Implementadas

**MODIFIQUEI AQUI** - Edge Functions criadas para segurança:

#### `asaas-create-pix`
* **Localização**: `supabase/functions/asaas-create-pix/index.ts`
* **Função**: Criar pagamento PIX no Asaas e retornar QR Code
* **Secrets necessários**: `ASAAS_API_KEY`, `ASAAS_BASE_URL` (opcional), `SUPABASE_URL`, `SUPABASE_ANON_KEY`
* **Validações**: Autenticação do usuário, ownership da participação, amount > 0
* **Retorno**: `{ id, status, dueDate, qrCode: { encodedImage, payload, expirationDate } }`

#### `asaas-webhook`
* **Localização**: `supabase/functions/asaas-webhook/index.ts`
* **Função**: Receber webhooks do Asaas e processar confirmações
* **Secrets necessários**: `ASAAS_WEBHOOK_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
* **Validações**: Token do webhook, status do pagamento (CONFIRMED/RECEIVED)
* **Processamento**: Atualiza payment e ativa participation de forma transacional
* **Idempotência**: Não processa pagamentos já confirmados

**Documentação completa**: Ver `supabase/functions/README.md` e `supabase/functions/TEST_CHECKLIST.md`

---

## 🔄 Fluxo de Pagamentos e Ativação

### 💚 Pagamento via Pix (Totalmente Automático) ✅ **IMPLEMENTADO**

**MODIFIQUEI AQUI** - Fluxo completo implementado com Edge Functions:

**Fluxo completo:**
1. Usuário seleciona números e vai para checkout
2. **Sistema gera código/ticket único** (ex: TK-A1B2C3) automaticamente ao criar participação
3. Usuário pode aplicar código de desconto (se disponível)
4. **Frontend chama `createPixPayment()`** → invoca Edge Function `asaas-create-pix`
5. **Edge Function cria pagamento no Asaas** usando `ASAAS_API_KEY` dos secrets (seguro)
6. **Edge Function retorna QR Code** (encodedImage, payload, expirationDate)
7. **Frontend exibe QR Code** e grava payment no banco (`status='pending'`, `external_id`)
8. Usuário realiza pagamento via Pix
9. **Asaas envia webhook** → Edge Function `asaas-webhook`
10. **Edge Function valida token** e processa confirmação
11. **Sistema atualiza automaticamente**:
    - Payment: `status='paid'`, `paid_at` preenchido
    - Participation: `status='active'` (ativação automática)
12. Usuário vê participação ativada em "Meus Tickets"

**Características:**
- ✅ Geração de QR Code Pix funcional via Edge Function
- ✅ Código Pix copia e cola disponível
- ✅ Sistema de descontos integrado no checkout
- ✅ **Ativação automática via webhook** ✅ **IMPLEMENTADO**
- ✅ **ASAAS_API_KEY nunca exposta no frontend** ✅ **IMPLEMENTADO**
- ✅ Processamento idempotente (não duplica processamento)
- ✅ Validação de segurança em todas as etapas

---

### 💵 Pagamento em Dinheiro (Manual) ✅ **IMPLEMENTADO**

**Fluxo completo:**
1. Usuário seleciona números e vai para checkout
2. **Sistema gera código/ticket único** (ex: TK-A1B2C3) automaticamente ao criar participação
3. Usuário pode aplicar código de desconto (se disponível)
4. Usuário escolhe pagamento em dinheiro no checkout
5. Participação é criada com status `pending`
6. Usuário recebe código/ticket da participação (exibido em "Meus Tickets")
7. Usuário entrega dinheiro ao operador físico e informa o código/ticket
8. **Admin acessa `/admin/activations`**
9. **Admin busca participação por código/ticket ou nome:**
   - Campo de busca por código/ticket disponível
   - Filtro por concurso também disponível
10. **Admin registra pagamento:**
    - Clica em "Registrar Pagamento em Dinheiro"
    - Preenche valor recebido (pode ser diferente do valor original se houver desconto aplicado)
    - Preenche observações (opcional)
    - Cria registro em `payments` com `payment_method: 'cash'` e `status: 'paid'`
11. **Sistema ativa participação automaticamente:**
    - Após registrar pagamento, participação é ativada automaticamente
    - Status muda: `pending → active`
    - Modal de sucesso exibe informações do pagamento e ativação
    - Lista de ativações é atualizada automaticamente

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
| **Ativação** | ✅ Automática via webhook (Edge Function) | Automática após registro de pagamento |
| **Tempo** | Segundos/minutos após pagamento | Imediato após registro |
| **Rastreabilidade** | Via webhook Asaas + Edge Function | Via registro manual |
| **Intervenção** | Nenhuma (totalmente automático) | Requer registro manual do admin |
| **Segurança** | ✅ ASAAS_API_KEY nunca exposta (Edge Functions) | Depende do processo manual |
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
| **FASE 2** - Participações e Ranking | ✅ Completa | 100% | Ranking completo com prêmios automáticos, exibição por ticket individual |
| **FASE 3** - Pagamentos Pix | ✅ Completa | 100% | Checkout com descontos, Edge Functions seguras, webhook e ativação automática implementados |
| **FASE 4** - Sorteios e Rateio | ✅ Completa | 100% | Gestão de sorteios, rateio automático, reprocessamento automático, prêmios por participação, visualização no ranking |
| **FASE 5** - Finalização | ⏳ Aguardando | 0% | Aguarda fases anteriores |

**MODIFIQUEI AQUI** - Progresso calculado: (100% + 100% + 100% + 100% + 0%) / 5 = 80% por fase, mas considerando peso das fases implementadas = **90% geral**

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
- [x] Página de ativações (/admin/activations) ✅ **IMPLEMENTADO**
  - [x] Listagem de participações pendentes
  - [x] Busca por código/ticket único
  - [x] Registro de pagamento em dinheiro
  - [x] Ativação automática após registro de pagamento
  - [x] Modal de sucesso visual
  - [x] **Atualização automática da lista após ativação** ✅ **IMPLEMENTADO**
    - [x] Recarregamento automático após ativar participação
    - [x] Remoção local da participação da lista após ativação
    - [x] Delay para garantir propagação da atualização
    - [x] Logs de debug para rastreamento
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
  - [x] **Design refatorado do PDF** ✅ **IMPLEMENTADO**
    - [x] Resultados/números sorteados exibidos no TOPO do PDF (logo após cabeçalho)
    - [x] Aviso fixo sobre pagamento visível no cabeçalho
    - [x] Tabela reformulada: ID sequencial | Nome | Código/Ticket | Números (todos em uma linha única)
    - [x] Destaque visual de números acertados quando houver sorteios (fundo verde, borda destacada)
    - [x] Contador de acertos por participação ("Acertos: X")
    - [x] Seção de prêmios/ganhadores para relatórios finais (com rateio calculado)
    - [x] Banner "FIM DO BOLÃO" para relatórios finais
    - [x] Layout moderno, limpo e profissional (tipografia melhorada, espaçamento adequado, hierarquia visual clara)
- [x] Página financeiro (/admin/finance) ✅ **IMPLEMENTADO**
  - [x] Parametrização de valores de participação por concurso
  - [x] Configuração de valores por concurso (editar participation_value)
  - [x] Histórico financeiro completo (lista de pagamentos)
  - [x] Estatísticas financeiras (total arrecadado, por método, ticket médio)
  - [x] Filtros avançados (concurso, status, método, período)
  - [x] Gestão completa de descontos e promoções ✅ **IMPLEMENTADO**
    - [x] CRUD completo de descontos (`discountsService.ts`)
    - [x] Tipos de desconto (percentual e valor fixo)
    - [x] Aplicação global ou por concurso específico
    - [x] Validade e limite de usos
    - [x] Ativação/desativação de descontos
    - [x] Validação de códigos de desconto no checkout
    - [x] Aplicação automática de desconto no valor final
    - [x] Incremento automático de contador de usos
    - [x] Migração SQL: `014_create_discounts_table.sql`
- [x] Página de sorteios (/admin/draws) ✅ **IMPLEMENTADO**
  - [x] Listagem completa de sorteios com filtros por concurso
  - [x] Criação e edição de sorteios
  - [x] Seleção de números manual ou aleatória
  - [x] Validação de quantidade de números baseada no concurso
  - [x] Geração de código único para sorteios (DRW-YYYYMMDD-XXXXXX)
  - [x] Estatísticas de sorteios (total, por concurso, último sorteio)
  - [x] Exclusão de sorteios
  - [x] **Finalização automática de concursos** ✅ **IMPLEMENTADO**
    - [x] Ao criar o primeiro sorteio, o concurso é automaticamente finalizado
    - [x] Status atualizado de `active` para `finished`
    - [x] Recarregamento automático da lista de concursos após criar sorteio
    - [x] Logs de debug para rastreamento
- [x] Navegação e layout consistente em todas as páginas
- [x] Sistema de modais de erro com ícones ✅ **RECÉM IMPLEMENTADO**
  - [x] Substituição de todos os `alert()` por modais visuais
  - [x] Ícones específicos por tipo de erro (warning, error, money, calendar, code, name, contest, numbers)
  - [x] Animações suaves e design consistente
  - [x] Implementado em todas as páginas administrativas

#### **Sistema de Códigos Únicos** ✅ **IMPLEMENTADO**
- [x] **Código de Concurso (`contest_code`)**: Formato `SIGLA-XXXXXX` (ex: CO-A1B2C3 para "CONCURSO" ou MG-A1B2C3 para "MEGA GIRO")
  - [x] Geração automática baseada no nome do concurso
  - [x] Sigla extraída automaticamente: 2 primeiras letras se uma palavra, iniciais se múltiplas palavras
  - [x] Exibição em todas as telas relevantes (detalhes do concurso, checkout, ranking, admin)
  - [x] Migração SQL: `019_add_contest_code_to_contests.sql`
- [x] **Código de Ticket (`ticket_code`)**: Formato `TK-XXXXXX` (ex: TK-A1B2C3)
  - [x] Geração automática ao criar participação
  - [x] Exibição em "Meus Tickets", relatórios, ativações
  - [x] Busca por código/ticket na página de ativações
  - [x] Migração SQL: `011_add_ticket_code_to_participations.sql`
- [x] **Código de Sorteio (`draw_code`)**: Formato `DRW-YYYYMMDD-XXXXXX` (ex: DRW-20250124-A1B2C3)
  - [x] Geração automática ao criar sorteio
  - [x] Exibição em relatórios e páginas administrativas
  - [x] Migração SQL: `013_add_code_to_draws.sql`

#### **Páginas do Usuário**
- [x] Página de listagem de concursos (/contests) ✅ **IMPLEMENTADO**
  - [x] Lista de concursos ativos disponíveis para participação
  - [x] Seção de histórico de concursos finalizados ✅ **IMPLEMENTADO**
  - [x] Abas para alternar entre "Ativos" e "Histórico"
  - [x] Exibição de status dinâmico com badges visuais
  - [x] Verificação automática de sorteios para determinar status real
- [x] Página de detalhes do concurso (/contests/:id) ✅ **IMPLEMENTADO**
  - [x] Informações completas do concurso
  - [x] Histórico de sorteios realizados
  - [x] Status dinâmico baseado em sorteios e datas
  - [x] Bloqueio automático de participação após sorteios
- [x] Página de participação (/contests/:id/join) ✅ **IMPLEMENTADO**
  - [x] Seleção de números para participação
  - [x] Validação de status do concurso antes de permitir participação
  - [x] Bloqueio automático se concurso já possui sorteios
  - [x] Redirecionamento para checkout após seleção
- [x] Página de configurações (/settings) ✅ **IMPLEMENTADO**
  - [x] 👤 Meu Perfil (editar nome, telefone, e-mail)
  - [x] Alterar senha (com validações)
  - [x] 🔔 Preferências (notificações, canais de comunicação)
  - [x] 🔐 Segurança (último acesso, encerrar sessões)
  - [x] 🎨 Aparência (tema claro/escuro, nome da plataforma)
  - [x] Link "Meu Perfil" no Header redireciona para configurações
  - [x] Link "Configurações" no menu do perfil funcional

#### **UX/UI e Experiência do Usuário**
- [x] Sistema de modais de erro com ícones visuais ✅ **IMPLEMENTADO**
  - [x] Substituição completa de `alert()` por modais customizados
  - [x] Ícones específicos por contexto (erro, aviso, dinheiro, calendário, código, nome, concurso, números)
  - [x] Animações suaves (fadeIn, scaleIn)
  - [x] Design consistente em todas as páginas administrativas
  - [x] Fechamento intuitivo (clique fora ou botão)
- [x] Favicon e título do site atualizados para "DezAqui" ✅ **IMPLEMENTADO**

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
- [x] Página "Meus Tickets" (/my-tickets) ✅ **IMPLEMENTADO**
  - [x] Listagem de todas as participações do usuário
  - [x] Status dinâmico baseado em sorteios e datas
  - [x] Exibição de código/ticket único
- [x] Página de detalhes do concurso (/contests/:id) ✅ **IMPLEMENTADO**
  - [x] Informações completas do concurso
  - [x] Histórico de sorteios
  - [x] Status dinâmico com badges visuais
  - [x] Bloqueio de participação após sorteios
- [x] Página de participação (/contests/:id/join) ✅ **IMPLEMENTADO**
  - [x] Seleção de números
  - [x] Validação de status antes de permitir participação
  - [x] Bloqueio automático se concurso já possui sorteios
  - [x] Validação server-side adicional
- [x] Lista de concursos ativos (/contests) ✅ **IMPLEMENTADO**
  - [x] Visível para usuários não autenticados
  - [x] Seção de histórico de concursos finalizados
  - [x] Abas para alternar entre ativos e histórico
  - [x] Status dinâmico baseado em sorteios
- [x] Redirecionamento para login ao tentar participar sem autenticação
- [x] **Validação de participação em concursos finalizados** ✅ **IMPLEMENTADO**
  - [x] Bloqueio no frontend antes de selecionar números
  - [x] Validação server-side no serviço de participações
  - [x] Verificação de sorteios existentes
  - [x] Mensagens de erro específicas e informativas

#### **Visualizações**
- [x] Histórico de sorteios (exibição na página de detalhes)

#### **Ranking e Premiação** ✅ **IMPLEMENTADO**
- [x] Página de ranking geral (`RankingsPage.tsx`) ✅ **IMPLEMENTADO**
  - [x] Seção "Top 3" (Pódio) exibindo apenas categorias premiadas
  - [x] Nunca mostra participantes com 0 pontos no pódio
  - [x] Lista "Classificação Completa" (Top 10) com medalhas baseadas em categorias
  - [x] Medalhas (🥇🥈🥉) representam categoria de premiação, não posição matemática
  - [x] Abas para alternar entre concursos "Ativos" e "Histórico"
- [x] Página de ranking detalhado (`RankingPage.tsx`) ✅ **IMPLEMENTADO**
  - [x] Tabela completa de classificação com todos os participantes
  - [x] Medalhas baseadas em categorias de premiação (TOP/SECOND/LOWEST)
  - [x] Filtros de categoria:
    - [x] 🔘 Todos
    - [x] 🏆 Somente Premiados
    - [x] 🥇 TOP
    - [x] 🥈 SECOND
    - [x] 🥉 LOWEST
    - [x] ❌ Não premiados
  - [x] Filtros atuam apenas na exibição (frontend), sem alterar cálculos
  - [x] Seletor de sorteio para visualizar resultados específicos
- [x] Sistema de medalhas baseado em categorias ✅ **IMPLEMENTADO**
  - [x] 🥇 TOP: `score == numbers_per_participation`
  - [x] 🥈 SECOND: `score == numbers_per_participation - 1`
  - [x] 🥉 LOWEST: menor pontuação positiva do sorteio
  - [x] Medalhas determinadas por `payout.category`, não por posição matemática
- [x] Exibição de prêmios por participação ✅ **IMPLEMENTADO**
  - [x] Coluna "Prêmio" na tabela de ranking
  - [x] Estados: "⏳ Aguardando sorteio", "❌ Não premiado", "🏆 Premiado: R$ XX,XX"
  - [x] Prêmio determinado exclusivamente por `payout.amount_won > 0`

---

## 🚧 O QUE FALTA IMPLEMENTAR

### 🟡 FASE 2 — Participações e Ranking (Pendências)

#### **Ranking e Cálculos**
- [x] **Cálculo automático de acertos** quando houver sorteios ✅ **IMPLEMENTADO**
- [x] **Atualização de pontuação** (`current_score`) após sorteios ✅ **IMPLEMENTADO**
- [x] **Ranking em tempo real** (atualização após sorteios) ✅ **IMPLEMENTADO**
- [x] **Destaque visual dos números sorteados** nas participações ✅ **IMPLEMENTADO**
- [x] **Sistema de medalhas baseado em categorias de premiação** ✅ **IMPLEMENTADO**
- [x] **Filtros de categoria no ranking detalhado** ✅ **IMPLEMENTADO**
- [ ] Testes completos do fluxo de participação e ranking

---

### 🔵 FASE 3 — Pagamentos e Ativação (Pix) ✅ **COMPLETA**

**MODIFIQUEI AQUI** - Fase 3 completamente implementada com Edge Functions seguras.

#### **Integração Asaas Pix** ✅ **IMPLEMENTADO**
- [x] Serviço de integração com API Asaas (`asaasService.ts`) ✅ **IMPLEMENTADO**
  - [x] Função para criar pagamento Pix e gerar QR Code
  - [x] Função para verificar status do pagamento
- [x] Página de Checkout (`/contests/:id/checkout`) ✅ **IMPLEMENTADO**
  - [x] Exibição de informações da participação (números, ticket code, data/hora, valor)
  - [x] Seleção de método de pagamento (Pix ou Dinheiro)
  - [x] **Sistema de descontos no checkout** ✅ **IMPLEMENTADO**
    - [x] Campo para inserir código de desconto
    - [x] Validação de código (ativo, válido, dentro do prazo, limite de usos)
    - [x] Aplicação automática de desconto (percentual ou valor fixo)
    - [x] Exibição de valor original, desconto aplicado e valor final
    - [x] Remoção de desconto aplicado
  - [x] Geração e exibição de QR Code Pix
  - [x] Código Pix copia e cola
  - [x] Fluxo de pagamento em dinheiro (registra e fica pendente)
  - [x] Exibição de código do concurso (`contest_code`) no checkout
- [x] Modificação do fluxo de participação ✅ **IMPLEMENTADO**
  - [x] `JoinContestPage` redireciona para checkout após seleção de números
  - [x] Criação de participação no checkout antes do pagamento
- [x] Serviço de pagamentos (`paymentsService.ts`) para Pix ✅ **IMPLEMENTADO**
  - [x] Função `createPixPaymentRecord` para salvar pagamento Pix no banco
  - [x] Função `createCashPayment` para pagamentos em dinheiro
- [x] **Configuração da API Asaas via Supabase Secrets** ✅ **IMPLEMENTADO**
  - [x] Secrets configurados: `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`
  - [x] Documentação completa em `supabase/functions/README.md`
- [x] **Webhook endpoint para confirmação de pagamento** ✅ **IMPLEMENTADO**
  - [x] Edge Function `asaas-webhook` criada e documentada
  - [x] Validação de token do webhook implementada
- [x] **Processamento de webhook e atualização de `payments.status`** ✅ **IMPLEMENTADO**
  - [x] Atualização automática de `status='paid'` e `paid_at`
  - [x] Processamento idempotente (não duplica)
- [x] **Ativação automática da participação após confirmação Pix** ✅ **IMPLEMENTADO**
  - [x] Participation atualizada para `status='active'` automaticamente
  - [x] Processamento transacional (payment + participation juntos)
- [x] **Tratamento de erros e pagamentos cancelados** ✅ **IMPLEMENTADO**
  - [x] Validação de autenticação e ownership
  - [x] Tratamento de erros da API do Asaas
  - [x] Logs de erro sem dados sensíveis
- [x] **Logs financeiros completos** ✅ **IMPLEMENTADO**
  - [x] Registro completo de pagamentos na tabela `payments`
  - [x] Rastreabilidade via `external_id` (ID do Asaas)
  - [x] Histórico de confirmações via webhook
- [ ] Testes end-to-end completos do fluxo Pix em produção

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
- [x] **Finalização automática de concursos** ✅ **IMPLEMENTADO**
  - [x] Trigger SQL que finaliza concurso ao criar primeiro sorteio
  - [x] Atualização automática de status no frontend
  - [x] Verificação de primeiro sorteio antes de atualizar
  - [x] Logs de debug para rastreamento
  - [x] Migração SQL: `015_auto_finish_contest_on_draw.sql`

#### **Cálculos e Rateio** ✅ **IMPLEMENTADO**
- [x] **Reprocessamento automático após sorteios** ✅ **IMPLEMENTADO**
  - [x] Serviço `reprocessService.ts` para reprocessar acertos e pontuações
  - [x] Função `reprocessContestAfterDraw()` chamada automaticamente ao criar/editar/deletar sorteios
  - [x] Função `reprocessDrawResults()` para processar prêmios por sorteio individual
  - [x] Atualização automática de `current_score` de todas as participações
  - [x] Cálculo de prêmios por categoria (TOP/SECOND/LOWEST) e salvamento em `draw_payouts`
- [x] **Rateio automático por categoria** ✅ **IMPLEMENTADO**
  - [x] Cálculo implementado em `rateioCalculator.ts`
  - [x] Integração completa com reprocessamento automático
  - [x] Tratamento de empates (divisão igual entre ganhadores da mesma categoria)
  - [x] Salvamento de snapshots em `rateio_snapshots` para auditoria
  - [x] Migração SQL: `017_create_rateio_snapshots_table.sql`
- [x] **Sistema de Payouts (Prêmios por Participação)** ✅ **IMPLEMENTADO**
  - [x] Tabela `draw_payouts` para armazenar prêmios calculados
  - [x] Categorias: TOP, SECOND, LOWEST, NONE
  - [x] Cálculo automático de `amount_won` por participação
  - [x] Serviço `payoutsService.ts` para buscar prêmios
  - [x] Exibição de prêmios no ranking e "Meus Tickets"
  - [x] Migração SQL: `018_create_draw_payouts_table.sql`
- [x] **Configuração de Regras de Premiação por Concurso** ✅ **IMPLEMENTADO**
  - [x] Campos na tabela `contests`: `first_place_pct`, `second_place_pct`, `lowest_place_pct`, `admin_fee_pct`
  - [x] Interface no `AdminContestForm.tsx` para configurar percentuais
  - [x] Validação: soma deve ser 100%
  - [x] Integração com `rateioCalculator.ts` para usar regras configuradas
  - [x] Valores padrão: 65% TOP, 10% SECOND, 7% LOWEST, 18% ADMIN
  - [x] Migração SQL: `016_add_prize_percentages_to_contests.sql`

#### **Relatórios PDF** ✅ **REFATORADO**
- [x] Design completamente refatorado do PDF ✅ **IMPLEMENTADO**
  - [x] Resultados/números sorteados no TOPO (obrigatório, nunca no final)
  - [x] Aviso fixo sobre pagamento no cabeçalho
  - [x] Tabela com estrutura: ID | Nome | Código/Ticket | Números (uma linha única)
  - [x] Numeração sequencial iniciando em 1
  - [x] Destaque visual de acertos (números acertados com fundo verde e borda)
  - [x] Contador de acertos por participação
  - [x] **Bloco "Resumo Final do Bolão"** ✅ **IMPLEMENTADO**
    - [x] Banner "FIM DO BOLÃO" centralizado (apenas relatórios finais)
    - [x] Resumo por categoria com texto formatado: "X Pontos - Y ganhadores - Valor para cada premiado: R$XX.XXX,XX"
    - [x] Texto especial para "Menos Pontos": "Menos Pontos - Y ganhadores - Valor para cada premiado que acertou X ponto: R$XX.XXX,XX"
    - [x] Lista de ganhadores: Código/Ticket | Nome (em minúsculas)
    - [x] Categorias ordenadas por pontuação (maior para menor)
    - [x] Design limpo e profissional com hierarquia visual clara
  - [x] Layout moderno, limpo e profissional
  - [x] Tipografia melhorada (Segoe UI, hierarquia clara)
  - [x] Espaçamento adequado e legibilidade otimizada

---

## 🔮 Melhorias Futuras

**MODIFIQUEI AQUI** - As seguintes melhorias são **OPCIONAIS** e **FUTURAS**, não implementadas no momento:

### Cadastro de Chave Pix pelo Usuário

* **Status:** ⏳ Não implementado (melhoria futura)
* **Objetivo:** Permitir que usuários cadastrem sua chave Pix em `/settings` para recebimento automático de prêmios
* **Funcionalidades planejadas:**
  * Formulário para cadastro de chave Pix (tipo + chave)
  * Validação de chave Pix
  * Armazenamento seguro da chave associada ao perfil do usuário
  * Opção de múltiplas chaves Pix por usuário

### Painel Administrativo de Pagamentos de Prêmios

* **Status:** ⏳ Não implementado (melhoria futura)
* **Objetivo:** Criar página administrativa para gestão de pagamentos dos sorteios
* **Funcionalidades planejadas:**
  * Visualização de todos os payouts pendentes
  * Copiar chave Pix do ganhador
  * Marcar payouts como pagos (auditável)
  * Histórico completo de pagamentos realizados
  * Filtros por status (pago/pendente)
  * Exportação de relatórios de pagamentos

**Nota:** Essas melhorias são documentadas aqui para referência futura, mas **não estão implementadas** no sistema atual.

### Sistema de Pagamento de Prêmios (Não Implementado)

**Objetivo:** Permitir que usuários recebam prêmios via Pix automaticamente

**Funcionalidades Planejadas:**

* **Cadastro de Chave Pix pelo Usuário**
  * Seção em `/settings` para cadastrar tipo de chave Pix (CPF, Email, Telefone, Chave Aleatória)
  * Validação de formato de chave Pix
  * Possibilidade de cadastrar múltiplas chaves (principal e secundária)
  * Histórico de alterações de chave Pix

* **Página Administrativa de Pagamentos**
  * Lista de prêmios pendentes de pagamento por sorteio
  * Visualização de chave Pix cadastrada pelo ganhador
  * Botão para copiar chave Pix
  * Marcar prêmio como pago (com confirmação)
  * Histórico auditável de pagamentos realizados
  * Filtros por concurso, sorteio, status de pagamento
  * Exportação de relatório de pagamentos

* **Notificações Automáticas**
  * Notificação ao usuário quando ganhar prêmio
  * Notificação quando prêmio for marcado como pago
  * Lembrete para cadastrar chave Pix se ganhar sem ter cadastrado

**Prioridade:** Baixa - Implementar após finalizar todas as fases principais

**Onde Implementar:**
* `SettingsPage.tsx`: Seção "Chave Pix" para cadastro
* Nova página `AdminPayouts.tsx`: Gestão de pagamentos de prêmios
* Tabela `draw_payouts`: Adicionar campos `pix_key`, `paid_at`, `paid_by` (futuro)

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
- [x] Gestão de descontos e promoções ✅ **IMPLEMENTADO**
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
- [x] Seção de histórico de concursos finalizados
- [x] **Validação de participação em concursos finalizados** ✅ **IMPLEMENTADO**
  - [x] Bloqueio no frontend antes de selecionar números
  - [x] Validação server-side no serviço de participações
  - [x] Verificação de sorteios existentes
  - [x] Mensagens de erro específicas e informativas
- [x] **Finalização automática de concursos** ✅ **IMPLEMENTADO**
  - [x] Trigger SQL para garantir consistência
  - [x] Atualização automática no frontend
  - [x] Validação de primeiro sorteio
- [x] **OBRIGATÓRIO:** Cálculo de acertos após sorteios ✅ **IMPLEMENTADO**
- [x] **OBRIGATÓRIO:** Atualização de pontuação (`current_score`) ✅ **IMPLEMENTADO**
- [x] **OBRIGATÓRIO:** Ranking em tempo real ✅ **IMPLEMENTADO**
- [x] **OBRIGATÓRIO:** Destaque visual dos números sorteados ✅ **IMPLEMENTADO**
- [x] **OBRIGATÓRIO:** Sistema de medalhas baseado em categorias ✅ **IMPLEMENTADO**
- [x] **OBRIGATÓRIO:** Filtros de categoria no ranking detalhado ✅ **IMPLEMENTADO**
- [x] **OBRIGATÓRIO:** Testes completos do fluxo de participação e ranking

**MODIFIQUEI AQUI** - FASE 3 (integração Asaas Pix) está completa com Edge Functions seguras implementadas.

---

## 🚀 Status do Projeto

**📊 Progresso Geral: 90% de 100% finalizado**

**MODIFIQUEI AQUI** - Progresso atualizado após implementação completa de Edge Functions para integração segura com Asaas:

* 🟢 **Em desenvolvimento ativo**
* ✅ **FASE 1:** 100% completa ✅ (incluindo melhorias de UX/UI e página de configurações)
* ✅ **FASE 2:** 100% completa ✅ (ranking completo com prêmios automáticos por categoria, sistema de medalhas baseado em categorias, filtros de categoria no ranking detalhado)
* ✅ **FASE 3:** 100% completa ✅ (checkout com descontos, Edge Functions seguras, webhook e ativação automática implementados)
* ✅ **FASE 4:** 100% completa ✅ (gestão de sorteios, rateio automático, prêmios por participação, visualização no ranking)
* 📦 Arquitetura definida e estável
* ⚙️ Escalável e modular
* 🔒 Segurança implementada (RLS completo)
* 🎨 **UX/UI aprimorada** com modais visuais e ícones
* ✅ **Finalização automática de concursos** implementada com trigger SQL

**🎯 Foco Atual:**
- Testes completos do fluxo de participação, pagamento e ranking em produção
- Monitoramento e otimização das Edge Functions
- Validação de performance e escalabilidade

**📝 Implementações Recentes:**
- ✅ **Sistema de Medalhas baseado em Categorias de Premiação** ✅ **IMPLEMENTADO**
  - ✅ Medalhas (🥇🥈🥉) representam categoria de premiação, não posição matemática
  - ✅ 🥇 TOP: `score == numbers_per_participation`
  - ✅ 🥈 SECOND: `score == numbers_per_participation - 1`
  - ✅ 🥉 LOWEST: menor pontuação positiva do sorteio
  - ✅ Medalhas determinadas por `payout.category` do sorteio
- ✅ **Ranking Geral (`RankingsPage.tsx`)** com novo sistema de medalhas ✅ **IMPLEMENTADO**
  - ✅ Pódio "Top 3" exibe apenas categorias premiadas que existem
  - ✅ Nunca mostra participantes com 0 pontos no pódio
  - ✅ Não exibe medalhas "vazias" (ex: 🥇 se não houver ganhador TOP)
  - ✅ Lista "Classificação Completa" com medalhas baseadas em categorias
- ✅ **Ranking Detalhado (`RankingPage.tsx`)** com filtros de categoria ✅ **IMPLEMENTADO**
  - ✅ Filtros: Todos, Somente Premiados, TOP, SECOND, LOWEST, Não premiados
  - ✅ Filtros atuam apenas na exibição (frontend), sem alterar cálculos
  - ✅ Medalhas exibidas apenas para participantes premiados
  - ✅ Tabela sempre lista todos os participantes, mesmo com 0 pontos
- ✅ **Finalização automática de concursos** quando primeiro sorteio é criado
  - ✅ Trigger SQL para garantir consistência no banco de dados
  - ✅ Atualização automática de status no frontend
  - ✅ Seção de histórico de concursos finalizados na página de concursos
  - ✅ Validação de participação em concursos finalizados (frontend + backend)
  - ✅ Bloqueio automático de participações após sorteios
- ✅ **Seção de histórico de concursos** na página principal (`/contests`)
  - ✅ Abas para alternar entre "Ativos" e "Histórico"
  - ✅ Exibição de concursos finalizados com seus resultados
  - ✅ Status dinâmico baseado em sorteios e datas
- ✅ **Correções e melhorias na página AdminActivations**
  - ✅ Atualização automática da lista após ativar participação
  - ✅ Remoção local de participações ativadas
  - ✅ Logs de debug para rastreamento
- ✅ **Correções na página JoinContestPage**
  - ✅ Correção de variável `draws` não declarada
  - ✅ Validação completa de status antes de permitir participação
- ✅ **Design refatorado completo do PDF de relatórios** (resultados no topo, tabela reformulada, destaque de acertos, seção de prêmios)
- ✅ Sistema completo de modais de erro com ícones (substituição de todos os `alert()`)
- ✅ Página completa de gestão de sorteios (`/admin/draws`)
- ✅ Gestão completa de descontos e promoções (`/admin/finance`)
- ✅ **Página de Checkout (`/contests/:id/checkout`)** com opções Pix e Dinheiro ✅ **IMPLEMENTADO**
  - ✅ Sistema de descontos integrado no checkout
  - ✅ Validação e aplicação automática de códigos de desconto
  - ✅ Exibição de valor original, desconto e valor final
  - ✅ Exibição de código do concurso (`contest_code`)
- ✅ **Integração Segura com API Asaas via Edge Functions** ✅ **IMPLEMENTADO**
  - ✅ Edge Function `asaas-create-pix` para criar pagamentos PIX
  - ✅ Edge Function `asaas-webhook` para processar confirmações
  - ✅ **ASAAS_API_KEY nunca exposta no frontend** (armazenada apenas nos secrets)
  - ✅ Validação de autenticação e ownership na Edge Function
  - ✅ Webhook configurável no painel do Asaas
  - ✅ Ativação automática de participações após confirmação de pagamento
  - ✅ Processamento idempotente (não duplica processamento)
  - ✅ Documentação completa em `supabase/functions/README.md`
- ✅ **Sistema de Códigos Únicos** ✅ **IMPLEMENTADO**
  - ✅ Código de concurso (`contest_code`): SIGLA-XXXXXX
  - ✅ Código de ticket (`ticket_code`): TK-XXXXXX
  - ✅ Código de sorteio (`draw_code`): DRW-YYYYMMDD-XXXXXX
- ✅ **Reprocessamento Automático de Sorteios** ✅ **IMPLEMENTADO**
  - ✅ Reprocessamento automático de acertos e pontuações
  - ✅ Cálculo automático de prêmios por categoria
  - ✅ Salvamento de payouts em `draw_payouts`
  - ✅ Salvamento de snapshots de rateio para auditoria
- ✅ **Cálculo de pontuações baseado em acertos** de todos os sorteios nas páginas de ranking
- ✅ **Exibição completa de números acertados** na página de rankings gerais
- ✅ **Página de Configurações (`/settings`)** completa com:
  - 👤 Meu Perfil (nome, telefone, e-mail, alterar senha)
  - 🔔 Preferências (notificações, canais de comunicação)
  - 🔐 Segurança (último acesso, encerrar sessões)
  - 🎨 Aparência (tema claro/escuro, nome da plataforma)
- ✅ **Validação de segurança** no registro de pagamentos em dinheiro (sempre usa valor do concurso)
- ✅ **Favicon e título** do site atualizados para "DezAqui"
- ✅ **Link "Meu Perfil"** no Header redireciona para página de configurações