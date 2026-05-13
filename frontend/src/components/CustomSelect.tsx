/**
 * Select customizado — abre para baixo ou para cima conforme espaço na viewport,
 * com altura máxima ajustada para a lista caber e poder rolar até ao fim.
 */
import { useState, useRef, useEffect, useLayoutEffect } from 'react'

export interface CustomSelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: CustomSelectOption[]
  id?: string
  className?: string
  disabled?: boolean
  placeholder?: string
}

const LIST_MARGIN_PX = 8
const LIST_CAP_PX = 320
const LIST_MIN_PX = 120

function viewportHeight(): number {
  if (typeof window === 'undefined') return 800
  return window.visualViewport?.height ?? window.innerHeight
}

function viewportOffsetTop(): number {
  if (typeof window === 'undefined' || !window.visualViewport) return 0
  return window.visualViewport.offsetTop
}

export default function CustomSelect({
  value,
  onChange,
  options,
  id,
  className = '',
  disabled = false,
  placeholder = 'Selecione...',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [placement, setPlacement] = useState<'down' | 'up'>('down')
  const [listMaxPx, setListMaxPx] = useState(LIST_CAP_PX)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)
  const displayLabel = selectedOption?.label ?? placeholder

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return
    const el = containerRef.current
    const measure = () => {
      const r = el.getBoundingClientRect()
      const vh = viewportHeight()
      const vTop = viewportOffsetTop()
      const spaceBelow = vh - (r.bottom - vTop) - LIST_MARGIN_PX
      const spaceAbove = r.top - vTop - LIST_MARGIN_PX
      const openDown = spaceBelow >= LIST_MIN_PX && spaceBelow >= spaceAbove
      if (openDown) {
        setPlacement('down')
        setListMaxPx(Math.max(LIST_MIN_PX, Math.min(LIST_CAP_PX, spaceBelow)))
      } else {
        setPlacement('up')
        setListMaxPx(Math.max(LIST_MIN_PX, Math.min(LIST_CAP_PX, Math.max(spaceAbove, LIST_MIN_PX))))
      }
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [isOpen, options])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative" id={id}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
        className={`w-full px-4 py-2 min-h-[44px] border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E7F43] focus:border-transparent text-left flex items-center justify-between bg-white disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-[#1F1F1F]/60 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className={`absolute left-0 right-0 z-[100] overflow-y-auto overscroll-y-contain rounded-xl border border-[#E5E5E5] bg-white shadow-lg py-1 ${
            placement === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'
          }`}
          style={{ maxHeight: listMaxPx }}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className={`px-4 py-2.5 cursor-pointer hover:bg-[#F9F9F9] transition-colors last:pb-3 ${
                opt.value === value ? 'bg-[#1E7F43]/10 font-semibold text-[#1E7F43]' : 'text-[#1F1F1F]'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
