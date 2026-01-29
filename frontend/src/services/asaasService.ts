/**
 * Serviço de integração com API Asaas
 * FASE 3: Pagamentos e Ativação
 * 
 * MODIFIQUEI AQUI - Funções para gerar QR Code Pix via Edge Functions do Supabase
 * A lógica de criação de pagamento foi movida para Edge Function por segurança
 */

import { supabase } from '../lib/supabase'

export interface AsaasPixQRCodeResponse {
  encodedImage: string // Base64 da imagem do QR Code
  payload: string // Código Pix copia e cola
  expirationDate: string // Data de expiração do QR Code
}

export interface CreatePixPaymentParams {
  participationId: string
  ticketCode: string
  amount: number
  description: string
  customerName: string
  customerCpfCnpj?: string
  customerEmail?: string
  customerPhone?: string
}

export interface CreatePixPaymentResponse {
  id: string // ID do pagamento no Asaas
  qrCode: AsaasPixQRCodeResponse
  status: string
  dueDate: string
}

/**
 * Cria um pagamento Pix via Edge Function do Supabase
 * MODIFIQUEI AQUI - Função agora chama Edge Function ao invés de fazer fetch direto no Asaas
 * 
 * @param params Parâmetros do pagamento Pix
 * @returns Dados do pagamento incluindo QR Code
 */
export async function createPixPayment(params: CreatePixPaymentParams): Promise<CreatePixPaymentResponse> {
  try {
    // MODIFIQUEI AQUI - Chamar Edge Function do Supabase ao invés de API direta do Asaas
    const { data, error } = await supabase.functions.invoke('asaas-create-pix', {
      body: {
        participationId: params.participationId,
        ticketCode: params.ticketCode,
        amount: params.amount,
        description: params.description,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
        customerCpfCnpj: params.customerCpfCnpj,
      },
    })

    if (error) {
      throw new Error(error.message || 'Erro ao criar pagamento Pix')
    }

    if (!data) {
      throw new Error('Resposta vazia da Edge Function')
    }

    // MODIFIQUEI AQUI - Verificar se há erro na resposta
    if (data.error) {
      throw new Error(data.error)
    }

    return {
      id: data.id,
      qrCode: {
        encodedImage: data.qrCode?.encodedImage || '',
        payload: data.qrCode?.payload || '',
        expirationDate: data.qrCode?.expirationDate || data.dueDate,
      },
      status: data.status,
      dueDate: data.dueDate,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Erro desconhecido ao criar pagamento Pix')
  }
}

/**
 * Verifica o status de um pagamento no Asaas
 * MODIFIQUEI AQUI - Função desabilitada por segurança (não deve usar ASAAS_API_KEY no frontend)
 * 
 * NOTA: Esta função não está sendo usada no fluxo atual. O status do pagamento é verificado
 * automaticamente via webhook do Asaas. Se necessário no futuro, criar uma Edge Function
 * equivalente que use ASAAS_API_KEY dos secrets do Supabase.
 * 
 * @param paymentId ID do pagamento no Asaas
 * @returns Status do pagamento
 * @deprecated Esta função não deve ser usada pois exporia ASAAS_API_KEY no frontend
 */
export async function checkPaymentStatus(paymentId: string): Promise<{
  status: string
  paid: boolean
  paidDate?: string
}> {
  // MODIFIQUEI AQUI - Função desabilitada por segurança
  // Para verificar status, use a tabela payments do Supabase que é atualizada via webhook
  throw new Error(
    'checkPaymentStatus não está disponível por segurança. ' +
    'Use a tabela payments do Supabase que é atualizada automaticamente via webhook.'
  )
}
