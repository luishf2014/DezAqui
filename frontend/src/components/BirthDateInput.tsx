import { useEffect, useMemo, useState } from 'react'
import {
  BIRTH_DATE_MIN,
  brDigitsToIso,
  formatBirthDateMask,
  getMaxBirthDateForAdultsIso,
  isoDateToBrDigits,
} from '../utils/birthDate'

const DEFAULT_TEXT_INPUT_CLASS =
  'rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 shadow-sm focus:border-[#1E7F43] focus:outline-none focus:ring-2 focus:ring-[#3CCB7F]/40'

const DEFAULT_CALENDAR_BUTTON_CLASS =
  'relative flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center self-stretch rounded-xl border border-[#E5E5E5] bg-white text-[#1E7F43] shadow-sm'

export type BirthDateInputProps = {
  id?: string
  name?: string
  valueDigits: string
  onChangeDigits: (digits: string) => void
  required?: boolean
  showAgeHint?: boolean
  textInputClassName?: string
  calendarButtonClassName?: string
}

export default function BirthDateInput({
  id = 'birthDate',
  name = 'birthDate',
  valueDigits,
  onChangeDigits,
  required = false,
  showAgeHint = false,
  textInputClassName = DEFAULT_TEXT_INPUT_CLASS,
  calendarButtonClassName = DEFAULT_CALENDAR_BUTTON_CLASS,
}: BirthDateInputProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobileViewport(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const pickerValue = useMemo(() => brDigitsToIso(valueDigits) ?? '', [valueDigits])

  const handleDigitsChange = (raw: string) => {
    onChangeDigits(raw.replace(/\D/g, '').slice(0, 8))
  }

  return (
    <>
      <div className="md:hidden flex gap-2">
        <input
          id={`${id}-mobile`}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          required={required && isMobileViewport}
          value={formatBirthDateMask(valueDigits)}
          onChange={(e) => handleDigitsChange(e.target.value)}
          className={`min-w-0 flex-1 ${textInputClassName}`}
          placeholder="dd/mm/aaaa"
          maxLength={10}
        />
        {/*
          iOS Safari não abre o calendário com showPicker()/click() em input escondido (sr-only).
          O toque precisa ir direto ao type="date": input invisível cobre o ícone (área mín. ~44pt).
        */}
        <div className={calendarButtonClassName}>
          <input
            type="date"
            id={`${id}-picker-native`}
            value={pickerValue}
            min={BIRTH_DATE_MIN}
            max={getMaxBirthDateForAdultsIso()}
            onChange={(e) => {
              const v = e.target.value
              if (v) onChangeDigits(isoDateToBrDigits(v))
            }}
            aria-label="Abrir calendário para escolher a data"
            className="absolute inset-0 z-10 h-full min-h-[48px] w-full cursor-pointer opacity-[0.01] appearance-none"
          />
          <span className="pointer-events-none flex items-center justify-center px-3 py-3" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
        </div>
      </div>
      <div className="hidden md:block">
        <input
          id={`${id}-desktop`}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          required={required && !isMobileViewport}
          value={formatBirthDateMask(valueDigits)}
          onChange={(e) => handleDigitsChange(e.target.value)}
          className={`block w-full ${textInputClassName}`}
          placeholder="dd/mm/aaaa"
          maxLength={10}
        />
      </div>
      {showAgeHint && (
        <p className="mt-1 text-xs text-[#1F1F1F]/50">É necessário ter pelo menos 18 anos.</p>
      )}
    </>
  )
}
