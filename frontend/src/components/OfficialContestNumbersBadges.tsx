/**
 * Exibe os números do concurso oficial em badges dourados ( design do sistema )
 */
import { formatOfficialRefNumbers } from '../utils/contestOfficialRefUtils'

interface OfficialContestNumbersBadgesProps {
  numbers: string | null | undefined
  className?: string
  /** Tamanho: 'sm' = text-sm, 'base' = text-base (padrão) */
  size?: 'sm' | 'base'
}

export default function OfficialContestNumbersBadges({ numbers, className = '', size = 'base' }: OfficialContestNumbersBadgesProps) {
  if (!numbers?.trim()) return null

  const formatted = formatOfficialRefNumbers(numbers)
  if (!formatted) return null

  const parts = formatted.split(' ')
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-sm sm:text-base'

  return (
    <div className={`flex flex-wrap gap-1.5 mt-1.5 ${className}`}>
      {parts.map((num, idx) => (
        <span
          key={`${num}-${idx}`}
          className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-2xl bg-[#F4C430] text-[#1F1F1F] font-semibold font-mono shadow-sm ${sizeClass}`}
        >
          {num}
        </span>
      ))}
    </div>
  )
}
