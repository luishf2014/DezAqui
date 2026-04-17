import { Link } from 'react-router-dom'

type Props = {
  pageKey: string
  to: string
  label: string
  /** null = a carregar; chave em falta = visível */
  visibilityMap: Record<string, boolean> | null
  isAdmin: boolean
}

/**
 * Link institucional no rodapé: oculto para não-admin se a página estiver invisível;
 * admin vê sempre, com etiqueta quando está invisível ao público.
 */
export default function FooterInstitutionalLink({
  pageKey,
  to,
  label,
  visibilityMap,
  isAdmin,
}: Props) {
  const hiddenFromPublic = visibilityMap?.[pageKey] === false
  if (!isAdmin && hiddenFromPublic) return null

  return (
    <li>
      <Link
        to={to}
        className={
          isAdmin && hiddenFromPublic
            ? 'text-amber-100/95 hover:text-white transition-colors text-sm border-b border-dashed border-amber-200/50'
            : 'text-white/80 hover:text-white transition-colors text-sm'
        }
        title={isAdmin && hiddenFromPublic ? 'Invisível para utilizadores — só admins veem este link' : undefined}
      >
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {label}
          {isAdmin && hiddenFromPublic && (
            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100">
              Invisível
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}
