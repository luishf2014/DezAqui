import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const normalizeDigits = (v?: string) => (v || '').replace(/[^\d]/g, '')
const trim = (v?: string) => (v || '').trim()

function phoneToEmail(phoneDigits: string): string {
  return `${phoneDigits}@dezaqui.local`
}

function generateTemporaryPassword(length = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => chars[b % chars.length]).join('')
}

function validateCpf(cpfValue: string): boolean {
  const cleanCpf = normalizeDigits(cpfValue)
  if (cleanCpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cleanCpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf[i]) * (10 - i)
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleanCpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf[i]) * (11 - i)
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  return remainder === parseInt(cleanCpf[10])
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Variáveis de ambiente ausentes' }, 500)
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authorization inválido' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    })
    const sellerAuth = await userRes.json()
    if (!sellerAuth?.id) {
      return jsonResponse({ error: 'Token inválido ou expirado' }, 401)
    }

    const sellerId = sellerAuth.id as string
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: sellerProf, error: sellerErr } = await admin
      .from('profiles')
      .select('id, is_seller, is_active')
      .eq('id', sellerId)
      .maybeSingle()

    if (
      sellerErr ||
      !sellerProf ||
      (sellerProf as { is_seller?: boolean }).is_seller !== true ||
      (sellerProf as { is_active?: boolean }).is_active === false
    ) {
      return jsonResponse({ error: 'Apenas cambistas activos podem cadastrar clientes' }, 403)
    }

    const body = await req.json()
    const name = trim(body?.name)
    const email = trim(body?.email).toLowerCase()
    const countryDial = normalizeDigits(body?.countryDial) || '55'
    const phoneNational = normalizeDigits(body?.phone)
    const cpf = normalizeDigits(body?.cpf)
    const birthDate = trim(body?.birthDate)

    let phoneDigits = phoneNational
    if (countryDial !== '55') {
      phoneDigits = `${countryDial}${phoneNational}`
    }

    if (!name || name.length < 2) {
      return jsonResponse({ error: 'Informe o nome completo do cliente' }, 400)
    }

    if (countryDial === '55' && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      return jsonResponse({ error: 'Telefone inválido (com DDD)' }, 400)
    }
    if (countryDial !== '55' && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
      return jsonResponse({ error: 'Telefone inválido' }, 400)
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      return jsonResponse({ error: 'Informe um e-mail válido' }, 400)
    }

    if (!cpf || !validateCpf(cpf)) {
      return jsonResponse({ error: 'CPF inválido' }, 400)
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return jsonResponse({ error: 'Data de nascimento inválida' }, 400)
    }

    const signUpEmail = phoneToEmail(phoneDigits)

    const { data: existingByPhone } = await admin
      .from('profiles')
      .select('id')
      .eq('phone', phoneDigits)
      .limit(1)

    if (existingByPhone && existingByPhone.length > 0) {
      return jsonResponse({
        error: 'Este telefone já está cadastrado. Seleccione o cliente na aba «Nova venda».',
        code: 'phone_exists',
      }, 409)
    }

    const { data: existingByCpf } = await admin
      .from('profiles')
      .select('id')
      .eq('cpf', cpf)
      .limit(1)

    if (existingByCpf && existingByCpf.length > 0) {
      return jsonResponse({ error: 'Este CPF já está cadastrado', code: 'cpf_exists' }, 409)
    }

    const temporaryPassword = generateTemporaryPassword(10)

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: signUpEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name,
        phone: phoneDigits,
        email,
        cpf,
        birth_date: birthDate,
        must_change_password: true,
        created_by_seller_id: sellerId,
      },
    })

    if (createErr || !created?.user?.id) {
      const msg = createErr?.message || 'Erro ao criar conta'
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        return jsonResponse({
          error: 'Este telefone já está cadastrado. Seleccione o cliente na aba «Nova venda».',
          code: 'phone_exists',
        }, 409)
      }
      return jsonResponse({ error: msg }, 400)
    }

    const clientId = created.user.id

    await new Promise((r) => setTimeout(r, 350))

    const { data: bindResult, error: bindErr } = await admin.rpc('rpc_internal_bind_client_to_seller', {
      p_seller_id: sellerId,
      p_client_id: clientId,
    })

    if (bindErr) {
      console.error('[seller-create-client] bind error:', bindErr.message)
    }

    const bound = (bindResult as { bound?: boolean } | null)?.bound === true

    return jsonResponse({
      clientId,
      name,
      phone: phoneDigits,
      loginPhone: phoneDigits,
      temporaryPassword,
      sellerBound: bound,
    })
  } catch (e) {
    console.error('[seller-create-client]', e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Erro interno' }, 500)
  }
})
