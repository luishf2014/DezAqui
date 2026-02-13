/**
 * MODIFIQUEI AQUI - Serviço para referências de concurso oficial (múltiplas por bolão)
 * Informativas, sem vínculo com sorteios.
 */
import { supabase } from '../lib/supabase'
import { ContestOfficialRef } from '../types'

export async function listOfficialRefsByContestId(contestId: string): Promise<ContestOfficialRef[]> {
  const { data, error } = await supabase
    .from('contest_official_refs')
    .select('*')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Erro ao buscar referências de concurso oficial: ${error.message}`)
  }
  return data || []
}

export interface CreateOfficialRefInput {
  contest_id: string
  official_contest_name: string
  official_contest_code: string
  official_contest_numbers?: string | null
  official_contest_date?: string | null
}

export async function createOfficialRef(input: CreateOfficialRefInput): Promise<ContestOfficialRef> {
  const { data, error } = await supabase
    .from('contest_official_refs')
    .insert(input)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar referência: ${error.message}`)
  }
  return data
}

export interface UpdateOfficialRefInput {
  official_contest_name?: string
  official_contest_code?: string
  official_contest_numbers?: string | null
  official_contest_date?: string | null
}

export async function updateOfficialRef(id: string, input: UpdateOfficialRefInput): Promise<ContestOfficialRef> {
  const { data, error } = await supabase
    .from('contest_official_refs')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar referência: ${error.message}`)
  }
  return data
}

export async function deleteOfficialRef(id: string): Promise<void> {
  const { error } = await supabase
    .from('contest_official_refs')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Erro ao excluir referência: ${error.message}`)
  }
}
