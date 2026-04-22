# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DezAqui is a **Web + PWA platform** for managing numeric participatory contests (lottery-style). It allows fully configurable contests, participant management, multiple draws, real-time rankings, and automatic prize distribution.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TailwindCSS + TypeScript |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Payments | Asaas API (Pix) via Supabase Edge Functions |
| Platform | Web + PWA |

## Development Commands

All frontend commands run from the `frontend/` directory:

```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run type-check   # TypeScript type checking
npm run lint         # ESLint
npm run preview      # Preview production build
```

### Supabase Edge Functions

```bash
# Login and link project
supabase login
supabase link --project-ref <project-ref>

# Deploy Edge Functions
supabase functions deploy asaas-create-pix
supabase functions deploy asaas-webhook

# Manage secrets
supabase secrets set ASAAS_API_KEY=<key>
supabase secrets list
```

### Database Migrations

SQL migrations are in `backend/migrations/`. Ficheiros `001_*.sql` … `036_*.sql` — executar em ordem numérica (ver `MIGRATIONS_RUN_ORDER.md`). Exemplos:
- `001_init.sql` — schema inicial
- `015_create_discounts_table.sql` — descontos
- `016_auto_finish_contest_on_draw.sql` — concurso a terminar ao criar sorteio
- `019_create_draw_payouts_table.sql` — prémios por participação
- `021_add_cpf_to_profiles.sql` — CPF (Pix)

## Architecture

### Frontend Structure (`frontend/src/`)

```
contexts/       # React contexts (AuthContext for auth state)
components/     # Reusable UI components
pages/          # Route pages
  admin/        # Admin-only pages (dashboard, contests, draws, etc.)
services/       # Supabase data access layer (one service per domain)
types/          # TypeScript interfaces (index.ts defines all domain types)
utils/          # Helper functions (code generators, calculators, etc.)
lib/            # Supabase client setup
```

### Key Services Pattern

Each service in `services/` handles one domain entity:
- `contestsService.ts` - Contest CRUD
- `participationsService.ts` - Participation management
- `drawsService.ts` - Draw management
- `paymentsService.ts` - Payment records
- `payoutsService.ts` - Prize payouts per participation
- `reprocessService.ts` - Recalculates scores/prizes after draws
- `discountsService.ts` - Discount code management

### Supabase Edge Functions (`supabase/functions/`)

- `asaas-create-pix/` - Creates Pix payments via Asaas API (ASAAS_API_KEY never exposed to frontend)
- `asaas-webhook/` - Receives Asaas payment confirmations, auto-activates participations

### Key Domain Concepts

**Contest Flow:**
1. Admin creates contest (draft → active)
2. Users select numbers and create participation (pending)
3. User pays via Pix or cash
4. Participation becomes active
5. Admin creates draw → contest auto-finishes
6. System auto-calculates scores and prizes

**Prize Categories:**
- TOP (65%): All numbers correct (`numbers_per_participation`)
- SECOND (10%): One less than max (`numbers_per_participation - 1`)
- LOWEST (7%): Lowest positive score
- ADMIN (18%): Platform fee (never shown publicly)

**Unique Codes:**
- Contest: `SIGLA-XXXXXX` (e.g., `MG-A1B2C3` for "MEGA GIRO")
- Ticket: `TK-XXXXXX` (e.g., `TK-A1B2C3`)
- Draw: `DRW-YYYYMMDD-XXXXXX` (e.g., `DRW-20250124-A1B2C3`)

### Environment Variables

Frontend (`frontend/.env.local`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Edge Function secrets (configured via `supabase secrets set`):
- `ASAAS_API_KEY` - Asaas API key
- `ASAAS_WEBHOOK_TOKEN` - Webhook validation token
- `SUPABASE_SERVICE_ROLE_KEY` - For webhook RLS bypass

## Important Patterns

### RLS (Row Level Security)
All tables have RLS policies. Admin checks use `is_admin` from `profiles` table. Services must respect these policies.

### Reprocessing After Draws
When a draw is created/edited/deleted, call `reprocessContestAfterDraw()` to:
1. Recalculate all participation scores
2. Calculate prize distribution per category
3. Save payouts to `draw_payouts` table

### Payment Flow
1. Frontend calls `createPixPayment()` → Edge Function
2. Edge Function creates Asaas payment, returns QR code
3. Frontend saves payment record with `external_id`
4. Asaas webhook triggers auto-activation

### CPF Requirement
CPF is mandatory for Pix payments. Validated on signup, sent to Asaas automatically.
