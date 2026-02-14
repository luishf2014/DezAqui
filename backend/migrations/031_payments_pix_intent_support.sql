-- ============================================
-- Migração 031: Suporte ao fluxo Pix com intent
-- ============================================
--
-- 1. Cria pix_payment_intents (se não existir) - pedidos Pix pendentes
-- 2. Permite participation_id nulo em payments (ticket criado pelo webhook após confirmação)
-- 3. Adiciona intent_id em payments para vincular ao pix_payment_intent
--

-- Tabela pix_payment_intents (usada pela Edge Function asaas-create-pix)
CREATE TABLE IF NOT EXISTS public.pix_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  selected_numbers INTEGER[] NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  discount_code TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
  asaas_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pix_payment_intents_user_id ON public.pix_payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_pix_payment_intents_status ON public.pix_payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_pix_payment_intents_asaas_payment_id ON public.pix_payment_intents(asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;

-- Payments: participation_id pode ser nulo (ticket criado pelo webhook após confirmação)
ALTER TABLE public.payments ALTER COLUMN participation_id DROP NOT NULL;

-- Payments: intent_id para vincular ao pix_payment_intent
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS intent_id UUID REFERENCES public.pix_payment_intents(id);
CREATE INDEX IF NOT EXISTS idx_payments_intent_id ON public.payments(intent_id) WHERE intent_id IS NOT NULL;

-- Payments: contest_id e user_id (para pagamentos via intent; a Edge Function os insere)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS contest_id UUID REFERENCES public.contests(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.payments.intent_id IS 'ID do pix_payment_intent quando o ticket é criado pelo webhook após confirmação Pix';
