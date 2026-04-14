/** Lista para seletor de DDI (mobile). Brasil primeiro. */
export type CountryCallingCode = {
  iso: string
  name: string
  dial: string
}

export function countryFlagEmoji(iso: string): string {
  const cc = iso.toUpperCase()
  if (cc.length !== 2) return '🌐'
  return [...cc].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('')
}

/** Códigos numéricos sem "+". */
export const COUNTRY_CALLING_CODES: CountryCallingCode[] = [
  { iso: 'BR', name: 'Brasil', dial: '55' },
  { iso: 'PT', name: 'Portugal', dial: '351' },
  { iso: 'US', name: 'Estados Unidos', dial: '1' },
  { iso: 'AR', name: 'Argentina', dial: '54' },
  { iso: 'UY', name: 'Uruguai', dial: '598' },
  { iso: 'PY', name: 'Paraguai', dial: '595' },
  { iso: 'BO', name: 'Bolívia', dial: '591' },
  { iso: 'CL', name: 'Chile', dial: '56' },
  { iso: 'CO', name: 'Colômbia', dial: '57' },
  { iso: 'PE', name: 'Peru', dial: '51' },
  { iso: 'VE', name: 'Venezuela', dial: '58' },
  { iso: 'EC', name: 'Equador', dial: '593' },
  { iso: 'MX', name: 'México', dial: '52' },
  { iso: 'ES', name: 'Espanha', dial: '34' },
  { iso: 'FR', name: 'França', dial: '33' },
  { iso: 'DE', name: 'Alemanha', dial: '49' },
  { iso: 'IT', name: 'Itália', dial: '39' },
  { iso: 'GB', name: 'Reino Unido', dial: '44' },
  { iso: 'CH', name: 'Suíça', dial: '41' },
  { iso: 'NL', name: 'Países Baixos', dial: '31' },
  { iso: 'BE', name: 'Bélgica', dial: '32' },
  { iso: 'AO', name: 'Angola', dial: '244' },
  { iso: 'MZ', name: 'Moçambique', dial: '258' },
  { iso: 'CV', name: 'Cabo Verde', dial: '238' },
  { iso: 'ST', name: 'São Tomé e Príncipe', dial: '239' },
  { iso: 'TL', name: 'Timor-Leste', dial: '670' },
  { iso: 'MO', name: 'Macau', dial: '853' },
  { iso: 'JP', name: 'Japão', dial: '81' },
  { iso: 'CN', name: 'China', dial: '86' },
  { iso: 'KR', name: 'Coreia do Sul', dial: '82' },
  { iso: 'IN', name: 'Índia', dial: '91' },
  { iso: 'AU', name: 'Austrália', dial: '61' },
  { iso: 'NZ', name: 'Nova Zelândia', dial: '64' },
  { iso: 'ZA', name: 'África do Sul', dial: '27' },
  { iso: 'IL', name: 'Israel', dial: '972' },
  { iso: 'AE', name: 'Emirados Árabes Unidos', dial: '971' },
  { iso: 'AF', name: 'Afeganistão', dial: '93' },
  { iso: 'AL', name: 'Albânia', dial: '355' },
  { iso: 'DZ', name: 'Argélia', dial: '213' },
  { iso: 'AD', name: 'Andorra', dial: '376' },
]

export function findCountryByDial(dial: string): CountryCallingCode | undefined {
  return COUNTRY_CALLING_CODES.find((c) => c.dial === dial)
}
