import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useStore } from '../../store'
import { useMoney } from '../../hooks/useMoney'
import { useToday } from '../../hooks/useToday'
import { Button, IconButton } from '../../components/ui/Button'
import { Panel, PanelTitle } from '../../components/ui/Misc'
import { Segmented } from '../../components/ui/Form'
import { ChartFrame, ChartTooltip, CHART, Legend, axisProps } from '../../components/charts'
import { cx } from '../../components/ui/cx'
import { byCategory, monthlySeries, totals } from './calc'
import { exportTransactionsCSV } from './TransactionsView'
import { addMonthsISO, capitalize, daysBetween, fmt, inRange, monthEnd, monthStart } from '../../utils/dates'
import { money, pct } from '../../utils/format'

type Mode = 'month' | 'year'

export function ReportsView() {
  const t0 = useToday()
  const [mode, setMode] = useState<Mode>('year')
  const [anchor, setAnchor] = useState(t0)
  const txs = useStore((s) => s.transactions)
  const accounts = useStore((s) => s.accounts)
  const categories = useStore((s) => s.categories)
  const budget = useStore((s) => s.budget)
  const currency = useStore((s) => s.settings.currency)
  const hide = useStore((s) => s.settings.hideAmounts)
  const m = useMoney()
  const axisMoney = (v: number) => (hide ? '' : money(v, currency, { compact: true }))

  const start = mode === 'year' ? `${anchor.slice(0, 4)}-01-01` : monthStart(anchor)
  const end = mode === 'year' ? `${anchor.slice(0, 4)}-12-31` : monthEnd(anchor)
  const prevStart = mode === 'year' ? `${Number(anchor.slice(0, 4)) - 1}-01-01` : monthStart(addMonthsISO(anchor, -1))
  const prevEnd = mode === 'year' ? `${Number(anchor.slice(0, 4)) - 1}-12-31` : monthEnd(addMonthsISO(anchor, -1))

  const data = useMemo(() => {
    const cur = totals(txs, start, end)
    const prev = totals(txs, prevStart, prevEnd)
    const series = monthlySeries(accounts, txs, start, end).map((p) => ({ ...p, label: capitalize(fmt(p.start, 'MMM')) }))
    const curCat = byCategory(txs, 'expense', start, end)
    const prevCat = byCategory(txs, 'expense', prevStart, prevEnd)
    const cats = categories
      .filter((c) => c.type === 'expense' && (curCat.get(c.id) || prevCat.get(c.id)))
      .map((c) => ({ id: c.id, name: c.name, color: c.color, value: curCat.get(c.id) ?? 0, prev: prevCat.get(c.id) ?? 0 }))
      .sort((a, b) => b.value - a.value)
    // Cumulative spending through the month, this vs previous month.
    const days = mode === 'month' ? daysBetween(start, end) : []
    const prevDays = mode === 'month' ? daysBetween(prevStart, prevEnd) : []
    let a = 0
    let b = 0
    const cumulative = days.map((d, i) => {
      a += txs.filter((t) => t.type === 'expense' && t.date === d).reduce((s, t) => s + t.amount, 0)
      const pd = prevDays[i]
      if (pd) b += txs.filter((t) => t.type === 'expense' && t.date === pd).reduce((s, t) => s + t.amount, 0)
      return { label: String(i + 1), current: d <= t0 ? a : null, previous: pd ? b : null }
    })
    const budgetRows = budget.monthlyTotal
      ? series.filter((p) => p.start <= t0 && (p.income > 0 || p.expense > 0)).map((p) => ({ month: p.label, spent: p.expense, limit: budget.monthlyTotal!, ok: p.expense <= budget.monthlyTotal! }))
      : []
    return { cur, prev, series, cats, cumulative, budgetRows }
  }, [txs, accounts, categories, budget, start, end, prevStart, prevEnd, mode, t0])

  const label = mode === 'year' ? anchor.slice(0, 4) : capitalize(fmt(anchor, 'MMMM yyyy'))
  const prevLabel = mode === 'year' ? String(Number(anchor.slice(0, 4)) - 1) : capitalize(fmt(prevStart, 'MMMM'))
  const maxCat = Math.max(1, ...data.cats.map((c) => Math.max(c.value, c.prev)))
  const fmtMoney = (v: number) => m(v)

  const compare = (now: number, before: number, invert = false) => {
    if (!before) return <span className="text-mute">sin datos de {prevLabel}</span>
    const d = (now - before) / Math.abs(before)
    const good = invert ? d <= 0 : d >= 0
    return (
      <span className={good ? 'text-ok' : 'text-danger'}>
        {d >= 0 ? '+' : '−'}
        {pct(Math.abs(d))} <span className="text-mute">vs {prevLabel}</span>
      </span>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Tipo de informe" size="sm" value={mode} onChange={setMode} options={[{ value: 'month', label: 'Mensual' }, { value: 'year', label: 'Anual' }]} />
          <div className="flex items-center">
            <IconButton label="Anterior" size="sm" onClick={() => setAnchor(addMonthsISO(anchor, mode === 'year' ? -12 : -1))}>
              <ChevronLeft size={17} />
            </IconButton>
            <span className="min-w-32 text-center font-display text-[17px] font-semibold">{label}</span>
            <IconButton label="Siguiente" size="sm" onClick={() => setAnchor(addMonthsISO(anchor, mode === 'year' ? 12 : 1))}>
              <ChevronRight size={17} />
            </IconButton>
          </div>
        </div>
        <Button size="sm" icon={<Download size={15} />} onClick={() => exportTransactionsCSV(txs.filter((t) => inRange(t.date, start, end)))}>
          Exportar {label} en CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: 'Ingresos', v: data.cur.income, c: compare(data.cur.income, data.prev.income) },
          { l: 'Gastos', v: data.cur.expense, c: compare(data.cur.expense, data.prev.expense, true) },
          { l: 'Ahorro', v: data.cur.net, c: compare(data.cur.net, data.prev.net) },
        ].map((x) => (
          <Panel key={x.l}>
            <p className="text-sm text-mute">{x.l}</p>
            <p className={cx('display-num mt-1 text-[26px] font-semibold', x.v < 0 && 'text-danger')}>{m(x.v)}</p>
            <p className="mt-0.5 text-[13px]">{x.c}</p>
          </Panel>
        ))}
        <Panel tone="peach">
          <p className="text-sm text-peach-ink">Tasa de ahorro</p>
          <p className="display-num mt-1 text-[26px] font-semibold">{data.cur.income ? pct(data.cur.savingsRate) : '—'}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{data.prev.income ? `${pct(data.prev.savingsRate)} en ${prevLabel}` : 'Ahorro ÷ ingresos'}</p>
        </Panel>
      </div>

      {mode === 'year' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <PanelTitle action={<Legend items={[{ label: 'Ingresos', color: CHART.income }, { label: 'Gastos', color: CHART.expense }]} />}>Ingresos y gastos por mes</PanelTitle>
            <ChartFrame
              summary={`Ingresos y gastos por mes en ${label}.`}
              table={{ head: ['Mes', 'Ingresos', 'Gastos', 'Ahorro'], rows: data.series.map((p) => [p.label, m(p.income), m(p.expense), m(p.net)]) }}
            >
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={data.series} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={axisMoney} width={56} />
                    <Tooltip cursor={{ fill: 'rgba(37,42,46,.04)' }} content={<ChartTooltip format={fmtMoney} />} />
                    <Bar dataKey="income" name="Ingresos" fill={CHART.income} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="expense" name="Gastos" fill={CHART.expense} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartFrame>
          </Panel>
          <Panel>
            <PanelTitle sub="Saldo total de tus cuentas al final de cada mes">Evolución del saldo</PanelTitle>
            <ChartFrame summary={`Saldo a final de mes en ${label}.`} table={{ head: ['Mes', 'Saldo'], rows: data.series.map((p) => [p.label, m(p.balance)]) }}>
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={data.series.filter((p) => p.start <= t0)} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={axisMoney} width={56} domain={['auto', 'auto']} />
                    <Tooltip content={<ChartTooltip format={fmtMoney} />} />
                    <Line type="monotone" dataKey="balance" name="Saldo" stroke={CHART.ink} strokeWidth={2} dot={{ r: 3.5, fill: CHART.ink, stroke: 'white', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartFrame>
          </Panel>
          <Panel>
            <PanelTitle sub="Ingresos menos gastos de cada mes">Ahorro mensual</PanelTitle>
            <ChartFrame summary={`Ahorro mensual en ${label}.`} table={{ head: ['Mes', 'Ahorro'], rows: data.series.map((p) => [p.label, m(p.net)]) }}>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={data.series.filter((p) => p.start <= t0)} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={axisMoney} width={56} />
                    <ReferenceLine y={0} stroke={CHART.axis} />
                    <Tooltip cursor={{ fill: 'rgba(37,42,46,.04)' }} content={<ChartTooltip format={fmtMoney} />} />
                    <Bar dataKey="net" name="Ahorro" fill={CHART.accent} radius={[4, 4, 4, 4]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartFrame>
          </Panel>
          <BudgetPerformance rows={data.budgetRows} m={m} />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <PanelTitle action={<Legend items={[{ label: label, color: CHART.expense }, { label: prevLabel, color: '#b9bcbf' }]} />} sub="Gasto acumulado día a día">
              Ritmo de gasto
            </PanelTitle>
            <ChartFrame summary={`Gasto acumulado en ${label} frente a ${prevLabel}.`}>
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={data.cumulative} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" {...axisProps} interval={4} />
                    <YAxis {...axisProps} tickFormatter={axisMoney} width={56} />
                    <Tooltip content={<ChartTooltip format={fmtMoney} labelFormat={(l) => `Día ${l}`} />} />
                    {budget.monthlyTotal && <ReferenceLine y={budget.monthlyTotal} stroke={CHART.axis} strokeDasharray="4 4" label={{ value: 'Presupuesto', position: 'insideTopRight', fill: CHART.axis, fontSize: 12 }} />}
                    <Line type="monotone" dataKey="previous" name={prevLabel} stroke="#b9bcbf" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="current" name={label} stroke={CHART.expense} strokeWidth={2} dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartFrame>
          </Panel>
          <BudgetPerformance rows={data.budgetRows} m={m} />
        </div>
      )}

      <Panel>
        <PanelTitle sub={`${label} frente a ${prevLabel}. La marca gris es el periodo anterior.`}>Gasto por categoría</PanelTitle>
        {data.cats.length ? (
          <ul className="space-y-3.5">
            {data.cats.map((c) => (
              <li key={c.id} className="grid gap-1 sm:grid-cols-[200px_1fr_120px] sm:items-center sm:gap-4">
                <span className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                  {c.name}
                </span>
                <div className="relative h-3 rounded-full bg-sunken" role="img" aria-label={`${c.name}: ${m(c.value)}, antes ${m(c.prev)}`}>
                  <div className="bar-progress h-full rounded-full" style={{ width: `${(c.value / maxCat) * 100}%`, background: CHART.expense }} />
                  {c.prev > 0 && <div className="absolute -top-1 h-5 w-0.5 rounded bg-ink/45" style={{ left: `${(c.prev / maxCat) * 100}%` }} />}
                </div>
                <span className="num text-right text-sm">
                  <span className="font-medium">{m(c.value)}</span>
                  {c.prev > 0 && <span className={cx('block text-[12px]', c.value > c.prev ? 'text-danger' : 'text-ok')}>{c.value > c.prev ? '+' : '−'}{pct(Math.abs(c.value - c.prev) / c.prev)}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">No hay gastos en este periodo.</p>
        )}
      </Panel>
    </div>
  )
}

function BudgetPerformance({ rows, m }: { rows: { month: string; spent: number; limit: number; ok: boolean }[]; m: (c: number) => string }) {
  return (
    <Panel>
      <PanelTitle sub="Gasto de cada mes frente al tope mensual">Cumplimiento del presupuesto</PanelTitle>
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.month} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 text-sm">
              <span className="text-mute">{r.month}</span>
              <div className="h-2 overflow-hidden rounded-full bg-sunken">
                <div className="bar-progress h-full rounded-full" style={{ width: `${Math.min(100, (r.spent / r.limit) * 100)}%`, background: r.ok ? 'var(--color-peach-ink)' : 'var(--color-danger)' }} />
              </div>
              <span className={cx('num text-right', !r.ok && 'text-danger')}>
                {r.ok ? `Sobró ${m(r.limit - r.spent)}` : `+${m(r.spent - r.limit)}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">Define un tope mensual en «Presupuesto» para ver aquí cómo lo cumples cada mes.</p>
      )}
    </Panel>
  )
}
