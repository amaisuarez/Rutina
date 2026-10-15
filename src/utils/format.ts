const numberFmt = new Intl.NumberFormat('es-ES')
const pctFmt = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 })
const moneyFmts = new Map<string, Intl.NumberFormat>()

function moneyFmt(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`
  let f = moneyFmts.get(key)
  if (!f) {
    f = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 0 : 2,
    })
    moneyFmts.set(key, f)
  }
  return f
}

/** Formats cents as currency with Spanish conventions (1.234,56 €). */
export function money(cents: number, currency = 'EUR', opts: { compact?: boolean; sign?: boolean } = {}): string {
  const s = moneyFmt(currency, !!opts.compact).format(cents / 100)
  return opts.sign && cents > 0 ? `+${s}` : s
}

export function num(n: number): string {
  return numberFmt.format(n)
}

export function pct(ratio: number): string {
  return pctFmt.format(Number.isFinite(ratio) ? ratio : 0)
}

/**
 * Parses user-typed amounts into cents. Accepts Spanish ("1.234,56") and
 * plain ("1234.56") notation. Returns null when the text is not a positive amount.
 */
export function parseMoney(input: string): number | null {
  let s = input.trim().replace(/\s|€|\$|£/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null
  const cents = Math.round(parseFloat(s) * 100)
  return cents > 0 ? cents : null
}

/** Cents → editable string ("12,50"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function plural(n: number, one: string, many: string): string {
  return `${num(n)} ${n === 1 ? one : many}`
}

export function duration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
