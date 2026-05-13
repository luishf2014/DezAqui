/**
 * MODIFIQUEI AQUI — botões WhatsApp e Telegram no card do bolão (Bootstrap + ícones; ref só se logado).
 */
import { buildConcursosShareUrl, shareTelegramUrl, shareWhatsAppUrl } from '../utils/contestShareLink'

type Props = {
  contestId: string
  contestName: string
  /** MODIFIQUEI AQUI — código do perfil; omitir se anónimo */
  referralCode?: string | null
  compact?: boolean
}

export default function ContestSocialShareButtons({
  contestId,
  contestName,
  referralCode,
  compact,
}: Props) {
  const url = buildConcursosShareUrl(contestId, referralCode)
  const line = `Participe do bolão «${contestName}» na DezAqui!`
  const wa = shareWhatsAppUrl(line, url)
  const tg = shareTelegramUrl(line, url)

  const wrapClass = compact ? 'd-flex flex-wrap gap-2' : 'd-grid gap-2 d-sm-flex flex-sm-wrap'

  return (
    <div className={wrapClass}>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-sm d-inline-flex align-items-center justify-content-center gap-2 fw-semibold text-white border-0 shadow-sm"
        style={{ backgroundColor: '#25D366', minHeight: 40 }}
      >
        <i className="bi bi-whatsapp fs-5" aria-hidden />
        WhatsApp
      </a>
      <a
        href={tg}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-sm d-inline-flex align-items-center justify-content-center gap-2 fw-semibold text-white border-0 shadow-sm"
        style={{ backgroundColor: '#229ED9', minHeight: 40 }}
      >
        <i className="bi bi-telegram fs-5" aria-hidden />
        Telegram
      </a>
    </div>
  )
}
