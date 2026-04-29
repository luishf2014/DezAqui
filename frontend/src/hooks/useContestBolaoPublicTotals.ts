/**
 * Totais públicos do bolão (contagem + soma efetivamente paga).
 * Igual desktop/mobile; atualiza quando o utilizador regressa ao separador/app (Safari/Android),
 * onde o SPA costuma ficar em memória sem refetch ao abrir novamente de outra app.
 */
import { useCallback, useEffect, useState } from 'react'
import { countActiveParticipationsByContest } from '../services/participationsService'
import { sumBolaoCollectedForContest } from '../services/paymentsService'

export function useContestBolaoPublicTotals(contestId: string | undefined) {
  const [publicActiveParticipationCount, setPublicActiveParticipationCount] = useState<number | null>(null)
  const [publicCollectedSum, setPublicCollectedSum] = useState<number | null>(null)

  const reload = useCallback((options?: { clearFirst?: boolean }) => {
    if (!contestId) return
    const clear = options?.clearFirst !== false
    if (clear) {
      setPublicActiveParticipationCount(null)
      setPublicCollectedSum(null)
    }
    Promise.all([countActiveParticipationsByContest(contestId), sumBolaoCollectedForContest(contestId)])
      .then(([cnt, sum]) => {
        setPublicActiveParticipationCount(cnt)
        setPublicCollectedSum(sum)
      })
      .catch(() => {
        setPublicActiveParticipationCount(0)
        setPublicCollectedSum(null)
      })
  }, [contestId])

  useEffect(() => {
    reload({ clearFirst: true })
  }, [reload])

  useEffect(() => {
    if (!contestId) return

    const onVisible = () => {
      if (document.visibilityState === 'visible') reload({ clearFirst: false })
    }

    const onOnline = () => reload({ clearFirst: false })

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [contestId, reload])

  return {
    publicActiveParticipationCount,
    publicCollectedSum,
    reloadBolaoTotals: reload,
  }
}
