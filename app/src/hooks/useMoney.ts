import { useStore } from '../store'
import { money } from '../utils/format'

/** Currency formatter bound to settings; respects "Ocultar importes". */
export function useMoney() {
  const currency = useStore((s) => s.settings.currency)
  const hide = useStore((s) => s.settings.hideAmounts)
  return (cents: number, opts?: { compact?: boolean; sign?: boolean }) => (hide ? '•••• €'.replace('€', currencySymbol(currency)) : money(cents, currency, opts))
}

function currencySymbol(c: string) {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: c }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? c
  } catch {
    return c
  }
}
