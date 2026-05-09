<div align="center">

# 🎯 DezAqui — Plataforma de Concursos Numéricos

### Sistema completo para criação, gestão e operação de concursos numéricos com sorteios, ranking e premiação automática

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Mercado Pago Pix](https://img.shields.io/badge/Mercado_Pago-Pix-00B1EA?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

[📦 Funcionalidades](#-principais-funcionalidades) •
[🚀 Tecnologias](#-stack-tecnológica) •
[📥 Instalação](#-instalação) •
[🔐 Segurança](#-segurança) •
[📈 Roadmap](#-roadmap) •
[👨‍💻 Autor](#-autor)

</div>

---

## 🎉 Atualizações Importantes

- ✅ Pix via **Mercado Pago**, com secrets só nas **Supabase Edge Functions** (`mercadopago-create-pix` / `mercadopago-webhook`)
- ✅ Contas de usuário **ativas ou inativas** (`profiles.is_active`) para controlar participação e fluxos relacionados
- ✅ Fluxo **cambistas / indicações**: código de referral, **comissões sobre vendas pagas**, créditos de bilhete bonificado a cada **10** vendas qualificadas
- ✅ **Área «Meu link»** (vendedor logado) e painel admin **Parceiros e comissões** (`/admin/partners`), incluindo **bilhetes bonificados** (valor zero na arrecadação pública — opcionalmente debite ou não um crédito de indicação)
- ✅ Encerramento de concurso e sorteios: comportamento atual depende das **migrations** já aplicadas (evita afirmar regra única aqui)
- ✅ Ranking sempre visível, com medalhas por **categoria** de prémio
- ✅ Premiação automática segundo percentuais configuráveis do bolão  
- ✅ Múltiplos sorteios por concurso  
- ✅ Relatórios e exportações (CSV, PDF, Excel, conforme páginas ativas)
- ✅ Ativação de participações: Pix (automático por webhook) e dinheiro (manual)
- ✅ Sistema de cupons e descontos no checkout  

---

## 📋 Sobre o Projeto

O **DezAqui** é uma plataforma **Web + PWA** desenvolvida para operar **concursos numéricos participativos** de forma profissional, segura e escalável.

O sistema funciona como um **motor genérico de concursos**, permitindo que o administrador configure regras, valores, sorteios e percentuais sem necessidade de alterações no código.

Projetado para cenários reais de produção, com foco em:

- Confiabilidade  
- Rastreabilidade  
- Segurança financeira  
- Escalabilidade  

---

## 🎯 Objetivo

Eliminar a necessidade de múltiplos sistemas, centralizando em uma única plataforma:

- Cadastro e autenticação de usuários  
- Participações com números manuais ou automáticos  
- Pagamentos via Pix e dinheiro  
- Sorteios manuais ou automáticos  
- Ranking em tempo real  
- Premiação automática com rateio  
- Relatórios financeiros e operacionais  
- Painel administrativo completo  

---

## ✨ Principais Funcionalidades

### 👤 Usuário Final

- Cadastro e autenticação
- CPF obrigatório para pagamentos Pix
- Escolha de números:
  - Manual
  - Automática (surpresinha)
- Checkout com:
  - Pix (QR Code + copia e cola)
  - Dinheiro (offline)
  - Cupons de desconto
- Acompanhamento em tempo real:
  - Ranking
  - Números sorteados
- Área **Meus Tickets**:
  - Código único
  - Status da participação
  - Resultado financeiro
- **Vendedor** (utilizadores promovidos no admin): página **Meu link** com código de referral, resumo e resgate opcional de **bilhete bonificado por crédito**, quando a conta está ativa e as regras do produto o permitem.

### 🛠️ Administrador

- CRUD completo de concursos
- Configuração de regras:
  - Universo numérico
  - Quantidade de números
  - Valor da participação
  - Percentuais de premiação
- Gestão de sorteios:
  - Múltiplos sorteios
  - Encerramento do concurso conforme migrações aplicadas ao projeto
- Ativação de participações:
  - Pix Mercado Pago (webhook)
  - Dinheiro (manual)
- Parceiros, comissões e bonificações por indicação (`/admin/partners`)
- Participações bonificadas manuais (institucionais ou com consumo de crédito de indicação, conforme política configurada na base)
- Financeiro e relatórios
- Sistema de descontos
- Gestão de participantes e perfil (CPF obrigatório onde aplicável ao Pix)

---

## 🏆 Ranking e Premiação

- Ranking sempre exibido, mesmo sem ganhadores
- Pontuação baseada em acertos
- Premiação automática por categorias configuráveis (exemplos comuns neste projeto):
  - 🥇 **TOP** — acertos máximos configurados no bolão
  - 🥈 **SECOND** — degrau de acertos seguinte conforme definições do bolão
  - 🥉 **LOWEST** — entre as menores pontuações positivas
- Empates tratados corretamente
- Rateio proporcional salvo para auditoria
- Medalhas representam **categoria**, não posição matemática

---

## 🚀 Stack Tecnológica

### Frontend

```text
- React 18
- Vite
- TypeScript
- TailwindCSS
- PWA
```

## Backend & Database
- Supabase (BaaS)
- PostgreSQL
- Row Level Security (RLS)
- Database Triggers
- Edge Functions

## Pagamentos
- Mercado Pago (Pix via API)
- QR Code dinâmico / copia e cola conforme fluxo da função servidor
- Webhook dedicado (`mercadopago-webhook`) com validação de token/secrets em ambiente servidor

## DevOps & Tools
- Git & GitHub
- Supabase CLI
- ESLint
- Prettier

----

## 🔐 Segurança
Camadas de Proteção
 - Autenticação via Supabase Auth
 - JWT seguro
 - Controle de acesso por perfil (Admin / Usuário)
 - Row Level Security (RLS) no banco de dados
 - Credenciais do Mercado Pago (access token etc.) apenas em Supabase Edge Functions
 - Webhook com validação por token configurável (ver secrets da pasta `supabase/functions`)
 - Processamento idempotente
 - Transações seguras (pagamento + ativação)

----

## 📥 Instalação
  Pré-requisitos
   - Node.js 18+
   - Git
   - Conta no Supabase
   - Conta / credenciais Mercado Pago (homologação ou produção), conforme o ambiente que for usar

Passo a passo
```
# Clone o repositório
git clone https://github.com/luishf2014/dezaqui.git

# Acesse o frontend
cd dezaqui/frontend

# Instale as dependências
npm install

# Inicie o ambiente de desenvolvimento
npm run dev
```
A aplicação estará disponível em:
```
- http://localhost:3000
```
## 📂 Estrutura do Projeto
```
dezaqui/
├── frontend/                 # Aplicação Web (React + Vite)
│   └── src/
│       ├── pages/            # Páginas da aplicação
│       ├── services/         # Regras de negócio e integrações
│       ├── components/       # Componentes reutilizáveis
│       ├── contexts/         # Contextos React (Auth, etc)
│       └── lib/              # Utilitários e clientes (Supabase)
├── supabase/                 # Backend serverless
│   └── functions/            # Edge Functions
│       ├── mercadopago-create-pix/ # Criação de pagamentos Pix no servidor
│       ├── mercadopago-webhook/    # Confirmação de pagamentos
│       └── README.md               # pode conter nomenclatura legada — ver código das funções
├── backend/
│   └── migrations/           # Migrações SQL (`001_*` …; executar em ordem numérica crescente)
│       └── MIGRATIONS_RUN_ORDER.md # Guia inicial; há migrações além das listadas até ao último número na pasta — siga sempre a ordem dos ficheiros
└── README.md
```
---

## 📈 Roadmap (Implementado)
 - ✅ Sistema de autenticação
 - ✅ Participações e ranking
 - ✅ Sorteios múltiplos
 - ✅ Integração Pix (Mercado Pago + webhook)
 - ✅ Painel administrativo (concursos, sorteios, participantes, parceiros)
 - ✅ Indicações, comissões de vendedor e bilhetes bonificados por crédito / institucional
 - ✅ Área logada para vendedor (link de indicação / resumo próprio onde aplicável)
 - ✅ Relatórios financeiros e exportações disponíveis no produto

----

## 🔮 Implementações Futuras
 - Pagamento automático de prêmios
 - Auditoria administrativa completa
 - Permitir que o administrador configure o gateway de pagamento
 - Histórico completo de pagamentos
 - App mobile (React Native)

----

## ⚠️ Aviso Legal
Esta plataforma é fornecida exclusivamente como solução tecnológica.
Toda responsabilidade legal, fiscal ou regulatória referente ao uso em produção é integralmente do operador.

----

## 👨‍💻 Autor

<div align="center">

<img src="https://github.com/luishf2014.png" width="150" style="border-radius: 50%;" alt="Luis Henrique"/>

### **Luis Henrique**

Desenvolvedor Full Stack apaixonado por criar soluções que fazem a diferença.

[![GitHub](https://img.shields.io/badge/GitHub-luishf2014-181717?style=for-the-badge&logo=github)](https://github.com/luishf2014)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Luis_Henrique-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/luis-henrique-mt)
[![Email](https://img.shields.io/badge/Email-Contato-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:luis-henrique_mt@hotmail.com.br)

</div>

----

## 📄 Licença
Este projeto está sob a licença MIT.
Você pode usar, copiar, modificar e distribuir livremente, mantendo os créditos do autor.

----

<div align="center">

⭐ Se este projeto foi útil, considere deixar uma estrela
💬 Dúvidas ou sugestões? Abra uma issue

<br />

<strong>Desenvolvido com foco em qualidade, segurança e produto real.</strong>

</div>

---

<div align="center">

**[⬆ Voltar ao topo](#-dezaqui--plataforma-de-concursos-numéricos)**
</div>
