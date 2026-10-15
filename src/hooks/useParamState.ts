import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** A piece of view state kept in the URL query (`?key=value`), so tabs and filters survive reloads and are linkable. */
export function useParamState<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(key) as T | null
  const value = raw && (!allowed || allowed.includes(raw)) ? raw : fallback
  const set = useCallback(
    (v: T) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          if (v === fallback) next.delete(key)
          else next.set(key, v)
          return next
        },
        { replace: true },
      ),
    [key, fallback, setParams],
  )
  return [value, set]
}
