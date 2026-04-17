import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Mapa key (site_pages.key) -> visível ao público. null = a carregar. */
export function useSitePagesVisibilityMap(): Record<string, boolean> | null {
  const [map, setMap] = useState<Record<string, boolean> | null>(null)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('site_pages')
      .select('key, is_visible')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[useSitePagesVisibilityMap]', error)
          setMap({})
          return
        }
        const m: Record<string, boolean> = {}
        for (const row of data ?? []) {
          const r = row as { key: string; is_visible?: boolean | null }
          m[r.key] = r.is_visible !== false
        }
        setMap(m)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return map
}
