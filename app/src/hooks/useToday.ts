import { useEffect, useState } from 'react'
import { today } from '../utils/dates'

/** Current local date that updates after midnight while the app stays open. */
export function useToday() {
  const [d, setD] = useState(today)
  useEffect(() => {
    const id = setInterval(() => setD((prev) => (prev === today() ? prev : today())), 60_000)
    return () => clearInterval(id)
  }, [])
  return d
}
