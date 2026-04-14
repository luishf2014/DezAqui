import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COUNTRY_CALLING_CODES,
  countryFlagEmoji,
  findCountryByDial,
  type CountryCallingCode,
} from '../utils/countryCallingCodes'

type Props = {
  phone: string
  countryDial: string
  onPhoneChange: (value: string) => void
  onCountryDialChange: (dial: string) => void
  formatBrazil: (raw: string) => string
}

export default function MobilePhoneCountryInput({
  phone,
  countryDial,
  onPhoneChange,
  onCountryDialChange,
  formatBrazil,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => findCountryByDial(countryDial) ?? COUNTRY_CALLING_CODES[0],
    [countryDial]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return COUNTRY_CALLING_CODES
    return COUNTRY_CALLING_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        `+${c.dial}`.includes(q)
    )
  }, [search])

  const pickCountry = useCallback(
    (c: CountryCallingCode) => {
      onCountryDialChange(c.dial)
      onPhoneChange('')
      setOpen(false)
      setSearch('')
    },
    [onCountryDialChange, onPhoneChange]
  )

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const handlePhoneInput = (raw: string) => {
    if (countryDial === '55') {
      onPhoneChange(formatBrazil(raw))
      return
    }
    onPhoneChange(raw.replace(/\D/g, '').slice(0, 15))
  }

  return (
    <div ref={rootRef} className="relative mt-2">
      <div className="flex w-full overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-sm focus-within:border-[#1E7F43] focus-within:ring-2 focus-within:ring-[#3CCB7F]/40">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center gap-1.5 border-r border-[#E5E5E5] bg-white px-2.5 py-3 text-left text-sm text-[#1F1F1F]"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="text-lg leading-none" aria-hidden>
            {countryFlagEmoji(selected.iso)}
          </span>
          <span className="font-medium tabular-nums">+{countryDial}</span>
          <svg className="h-4 w-4 shrink-0 text-[#1F1F1F]/50" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <input
          id="phone-mobile"
          name="phone-mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label="Telefone (número local)"
          required
          value={phone}
          onChange={(e) => handlePhoneInput(e.target.value)}
          placeholder={countryDial === '55' ? '11 96123-4567' : 'Número local'}
          maxLength={countryDial === '55' ? 14 : 15}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 focus:outline-none focus:ring-0"
        />
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-lg"
          role="listbox"
        >
          <div className="border-b border-[#E5E5E5] p-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-[#F9F9F9] px-2 py-1.5">
              <svg className="h-4 w-4 shrink-0 text-[#1F1F1F]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar país ou código"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#1F1F1F] placeholder-[#1F1F1F]/40 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.map((c) => (
              <li key={`${c.iso}-${c.dial}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.dial === countryDial}
                  onClick={() => pickCountry(c)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F9F9F9] ${
                    c.dial === countryDial ? 'bg-[#F0F0F0]' : ''
                  }`}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {countryFlagEmoji(c.iso)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#1F1F1F]">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-[#1F1F1F]/50">+{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
