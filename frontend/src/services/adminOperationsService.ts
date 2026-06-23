import { supabase } from '../lib/supabase'
import type { CreatePixPaymentResponse } from './mercadopagoService'
import type { SellerCreateClientResult } from './sellerAreaService'

export type AdminOperationsClientRow = {
  id: string
  name: string
  email: string
  phone?: string | null
  cpf?: string | null
}

export async function listAdminClientsRpc(): Promise<AdminOperationsClientRow[]> {
  const { data, error } = await supabase.rpc('rpc_admin_list_clients')
  if (error) {
    const msg = error.message || 'Erro ao carregar clientes'
    if (msg.includes('schema cache') || msg.includes('rpc_admin_list_clients')) {
      throw new Error(
        'Função de listagem de clientes não encontrada no Supabase — execute a migração 050_admin_sales_rpc.sql no SQL Editor.'
      )
    }
    throw new Error(msg)
  }

  const rows = Array.isArray(data) ? data : []
  return rows.map((raw) => {
    const r = raw as Record<string, unknown>
    return {
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      email: String(r.email ?? ''),
      phone: r.phone == null ? null : String(r.phone),
      cpf: r.cpf == null ? null : String(r.cpf),
    }
  })
}

export async function adminCreateClient(params: {
  name: string
  phone: string
  countryDial: string
  email: string
  cpf: string
  birthDate: string
}): Promise<SellerCreateClientResult> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Sessão expirada. Inicie sessão novamente.')
  }

  const { data, error } = await supabase.functions.invoke('seller-create-client', {
    body: {
      name: params.name.trim(),
      phone: params.phone,
      countryDial: params.countryDial,
      email: params.email.trim(),
      cpf: params.cpf.replace(/\D/g, ''),
      birthDate: params.birthDate,
    },
  })

  if (error) {
    throw new Error(error.message || 'Erro ao cadastrar cliente')
  }

  const response = (data ?? {}) as Record<string, unknown>
  if (response.error) {
    throw new Error(String(response.error))
  }

  if (!response.clientId || !response.temporaryPassword) {
    throw new Error('Resposta inválida do servidor')
  }

  return {
    clientId: String(response.clientId),
    name: String(response.name ?? params.name),
    phone: String(response.phone ?? ''),
    loginPhone: String(response.loginPhone ?? response.phone ?? ''),
    temporaryPassword: String(response.temporaryPassword),
    sellerBound: false,
  }
}

export type AdminCashSaleResult = {
  participationId: string
  ticketCode: string
  amount: number
}

export async function adminCreateCashSale(params: {
  userId: string
  contestId: string
  numbers: number[]
}): Promise<AdminCashSaleResult> {
  const { data, error } = await supabase.rpc('rpc_admin_create_cash_sale', {
    p_user_id: params.userId,
    p_contest_id: params.contestId,
    p_numbers: params.numbers,
  })
  if (error) {
    const msg = error.message || 'Erro ao registar venda em dinheiro'
    if (msg.includes('schema cache') || msg.includes('rpc_admin_create_cash_sale')) {
      throw new Error(
        'Função de venda em dinheiro não encontrada no Supabase — execute a migração 050_admin_sales_rpc.sql no SQL Editor.'
      )
    }
    throw new Error(msg)
  }

  const raw = data as Record<string, unknown> | null
  if (!raw?.participation_id || !raw?.ticket_code) {
    throw new Error('Resposta inválida ao registar venda')
  }

  return {
    participationId: String(raw.participation_id),
    ticketCode: String(raw.ticket_code),
    amount: Number(raw.amount ?? 0),
  }
}

export async function adminCreatePixSale(params: {
  buyerUserId: string
  contestId: string
  numbers: number[]
  amount: number
  customerName: string
  customerEmail?: string
  customerPhone?: string
  customerCpfCnpj?: string
}): Promise<CreatePixPaymentResponse> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Sessão expirada. Inicie sessão novamente.')
  }

  const { data, error } = await supabase.functions.invoke('mercadopago-create-pix', {
    body: {
      buyerUserId: params.buyerUserId,
      contestId: params.contestId,
      selectedNumbers: params.numbers,
      amount: params.amount,
      description: 'Venda administrativa — DezAqui',
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      customerCpfCnpj: params.customerCpfCnpj,
    },
  })

  if (error) {
    throw new Error(error.message || 'Erro ao gerar Pix')
  }

  const response = (data ?? {}) as Record<string, unknown>
  if (response.error) {
    throw new Error(String(response.error))
  }
  if (!response.id || !(response.qrCode as Record<string, unknown>)?.encodedImage) {
    throw new Error('Resposta inválida do servidor Pix')
  }

  const qr = response.qrCode as Record<string, string>
  return {
    id: String(response.id),
    status: String(response.status ?? 'pending'),
    expirationDate: String(response.expirationDate ?? qr.expirationDate ?? ''),
    qrCode: {
      payload: qr.payload,
      encodedImage: qr.encodedImage,
      expirationDate: qr.expirationDate || String(response.expirationDate ?? ''),
    },
  }
}
