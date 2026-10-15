import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Pause, Pencil, PiggyBank, Play, Plus, Repeat, Target, Trash2 } from 'lucide-react'
import type { RecurringRule, SavingsGoal, TxRecurrenceFreq, TxType } from '../../types'
import { useStore } from '../../store'
import { choose, confirm, toast } from '../../store/ui'
import { useMoney } from '../../hooks/useMoney'
import { useToday } from '../../hooks/useToday'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, EmptyState, Menu, Panel, PanelTitle } from '../../components/ui/Misc'
import { Field, Input, Segmented, Select } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { ProgressBar, ProgressRing } from '../../components/ui/Progress'
import { cx } from '../../components/ui/cx'
import { budgetLines, byCategory, goalEstimate, goalSaved, monthElapsed, totals, upcomingRecurring } from './calc'
import { MoneyInput, TX_FREQ_LABEL } from './TransactionForm'
import { addMonthsISO, capitalize, diffDays, fmt, monthEnd, monthStart, relativeDay, today } from '../../utils/dates'
import { centsToInput, parseMoney, pct } from '../../utils/format'

/* ------------------------------------------------------------------ */
/* Budget                                                              */
/* ------------------------------------------------------------------ */

export function BudgetView() {
  const t0 = useToday()
  const m = useMoney()
  const [anchor, setAnchor] = useState(monthStart(t0))
  const budget = useStore((s) => s.budget)
  const txs = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const [editing, setEditing] = useState(false)
  const ms = monthStart(anchor)
  const me = monthEnd(anchor)
  const spent = totals(txs, ms, me).expense
  const elapsed = monthElapsed(anchor, t0)
  const lines = budgetLines(budget, txs, anchor)
  const catBy = new Map(categories.map((c) => [c.id, c]))
  const spentBy = byCategory(txs, 'expense', ms, me)
  const unbudgeted = [...spentBy].filter(([id]) => !budget.byCategory[id]).sort((a, b) => b[1] - a[1])
  const isPast = me < t0
  const total = budget.monthlyTotal

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center">
          <IconButton label="Mes anterior" size="sm" onClick={() => setAnchor(addMonthsISO(anchor, -1))}>
            <ChevronLeft size={17} />
          </IconButton>
          <span className="min-w-36 text-center font-display text-[17px] font-semibold">{capitalize(fmt(anchor, 'MMMM yyyy'))}</span>
          <IconButton label="Mes siguiente" size="sm" onClick={() => setAnchor(addMonthsISO(anchor, 1))}>
            <ChevronRight size={17} />
          </IconButton>
        </div>
        <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
          Editar presupuesto
        </Button>
      </div>

      {total || lines.length ? (
        <>
          {total ? (
            <Panel tone="peach">
              <div className="flex flex-wrap items-center gap-6">
                <ProgressRing value={spent / total} size={110} stroke={10} color={spent > total ? 'var(--color-danger)' : 'var(--color-peach-ink)'} track="rgb(255 255 255 / .7)" label={`Gastado el ${pct(spent / total)} del presupuesto`}>
                  <span className="display-num text-2xl font-semibold">{pct(spent / total)}</span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-peach-ink">Presupuesto mensual</p>
                  <p className="display-num text-[32px] leading-tight font-semibold">
                    {m(spent)} <span className="text-lg font-normal text-ink-2">de {m(total)}</span>
                  </p>
                  <p className="mt-1 text-sm text-ink-2">
                    {isPast
                      ? spent <= total
                        ? `Mes cerrado. Te sobraron ${m(total - spent)} del presupuesto.`
                        : `Mes cerrado con ${m(spent - total)} por encima del presupuesto.`
                      : spent > total
                        ? `Has superado el presupuesto en ${m(spent - total)}.`
                        : spent / total > elapsed + 0.1
                          ? `Vas algo por encima del ritmo: llevas el ${pct(elapsed)} del mes y el ${pct(spent / total)} del presupuesto.`
                          : `Vas a buen ritmo. Quedan ${m(total - spent)} para el resto del mes.`}
                  </p>
                </div>
              </div>
            </Panel>
          ) : null}

          {lines.length > 0 && (
            <Panel>
              <PanelTitle sub={!isPast && elapsed < 1 ? 'La marca vertical indica el ritmo esperado a día de hoy.' : undefined}>Límites por categoría</PanelTitle>
              <ul className="space-y-4">
                {lines.map((l) => {
                  const c = catBy.get(l.categoryId)
                  return (
                    <li key={l.categoryId}>
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="size-2.5 rounded-full" style={{ background: c?.color }} aria-hidden />
                          {c?.name ?? 'Categoría eliminada'}
                          {l.state === 'over' && <Badge tone="danger">Superado</Badge>}
                          {l.state === 'near' && <Badge tone="warn">Cerca del límite</Badge>}
                        </span>
                        <span className="num text-mute">
                          <span className="font-medium text-ink">{m(l.spent)}</span> de {m(l.limit)}
                        </span>
                      </div>
                      <ProgressBar
                        value={l.ratio}
                        marker={isPast ? undefined : elapsed}
                        color={l.state === 'over' ? 'var(--color-danger)' : l.state === 'near' ? 'var(--color-warn)' : 'var(--color-peach-ink)'}
                        label={`${c?.name}: ${pct(l.ratio)} del límite`}
                      />
                      <p className="mt-1 text-[12.5px] text-mute">{l.remaining >= 0 ? `${isPast ? 'Sobraron' : 'Quedan'} ${m(l.remaining)}` : `${m(-l.remaining)} por encima`}</p>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}
          {unbudgeted.length > 0 && (
            <Panel>
              <PanelTitle sub="Gasto de este mes en categorías sin límite">Sin presupuesto asignado</PanelTitle>
              <ul className="space-y-2 text-sm">
                {unbudgeted.map(([id, v]) => (
                  <li key={id} className="flex justify-between">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: catBy.get(id)?.color }} />
                      {catBy.get(id)?.name}
                    </span>
                    <span className="num">{m(v)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      ) : (
        <EmptyState
          icon={<Target size={20} />}
          title="Aún no tienes presupuesto"
          body="Fija un tope mensual y, si quieres, límites para las categorías en las que más gastas. Te avisaremos al acercarte."
          action={
            <Button variant="primary" onClick={() => setEditing(true)}>
              Crear presupuesto
            </Button>
          }
        />
      )}
      {editing && <BudgetEditor onClose={() => setEditing(false)} />}
    </div>
  )
}

function BudgetEditor({ onClose }: { onClose: () => void }) {
  const budget = useStore((s) => s.budget)
  const allCategories = useStore((s) => s.categories)
  const categories = allCategories.filter((c) => c.type === 'expense')
  const [total, setTotal] = useState(budget.monthlyTotal ? centsToInput(budget.monthlyTotal) : '')
  const [limits, setLimits] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(budget.byCategory).map(([k, v]) => [k, centsToInput(v)])))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    const t = total.trim() ? parseMoney(total) : null
    if (total.trim() && t === null) err.total = 'Importe no válido.'
    const byCat: Record<string, number> = {}
    for (const [k, v] of Object.entries(limits)) {
      if (!v.trim()) continue
      const c = parseMoney(v)
      if (c === null) err[k] = 'Importe no válido.'
      else byCat[k] = c
    }
    setErrors(err)
    if (Object.keys(err).length) return
    useStore.getState().setBudget({ monthlyTotal: t, byCategory: byCat })
    toast('Presupuesto guardado')
    onClose()
  }
  const sumLimits = Object.values(limits).reduce((s, v) => s + (parseMoney(v) ?? 0), 0)
  return (
    <Modal
      open
      onClose={onClose}
      title="Presupuesto mensual"
      description="Se aplica a todos los meses. Deja vacío lo que no quieras limitar."
      tone="peach"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="budget-form">
            Guardar presupuesto
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Tope de gasto mensual total" htmlFor="b-total" error={errors.total}>
          <MoneyInput id="b-total" value={total} onChange={setTotal} />
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-2">Límites por categoría</p>
          <ul className="divide-y divide-line rounded-ctl border border-line">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <label htmlFor={`b-${c.id}`} className="min-w-0 flex-1 text-sm">
                  {c.name}
                  {errors[c.id] && <span className="block text-[12px] text-danger">{errors[c.id]}</span>}
                </label>
                <input
                  id={`b-${c.id}`}
                  inputMode="decimal"
                  placeholder="Sin límite"
                  value={limits[c.id] ?? ''}
                  onChange={(e) => setLimits((l) => ({ ...l, [c.id]: e.target.value.replace(/[^\d.,]/g, '') }))}
                  className="num h-9 w-32 rounded-lg border border-line px-2.5 text-right text-sm placeholder:text-faint"
                />
              </li>
            ))}
          </ul>
          {sumLimits > 0 && (parseMoney(total) ?? Infinity) < sumLimits && (
            <p className="mt-2 text-[13px] text-warn">La suma de los límites por categoría supera el tope total.</p>
          )}
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Savings goals                                                       */
/* ------------------------------------------------------------------ */

export function GoalsView() {
  const goals = useStore((s) => s.goals)
  const m = useMoney()
  const t0 = useToday()
  const [editing, setEditing] = useState<SavingsGoal | 'new' | null>(null)
  const [contributing, setContributing] = useState<SavingsGoal | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
          Nueva meta
        </Button>
      </div>
      {goals.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const saved = goalSaved(g)
            const ratio = saved / g.target
            const est = goalEstimate(g, t0)
            const monthsLeft = g.targetDate ? Math.max(1, Math.ceil(diffDays(g.targetDate, t0) / 30.4)) : null
            const perMonth = monthsLeft && saved < g.target ? Math.ceil((g.target - saved) / monthsLeft) : null
            const late = est && g.targetDate && est > g.targetDate
            return (
              <article key={g.id} className="rounded-panel border border-line bg-card p-5">
                <div className="flex items-start gap-4">
                  <ProgressRing value={ratio} size={72} stroke={8} color={ratio >= 1 ? 'var(--color-ok)' : 'var(--color-peach-ink)'} label={`${pct(ratio)} conseguido`}>
                    <span className="num text-sm font-semibold">{pct(Math.min(1, ratio))}</span>
                  </ProgressRing>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg">{g.name}</h3>
                    <p className="num text-sm text-ink-2">
                      <span className="font-semibold text-ink">{m(saved)}</span> de {m(g.target)}
                    </p>
                    {g.targetDate && <p className="text-[13px] text-mute">Objetivo: {fmt(g.targetDate, "d 'de' MMMM yyyy")}</p>}
                  </div>
                  <Menu
                    label={`Opciones de ${g.name}`}
                    items={[
                      { label: 'Editar', icon: <Pencil size={15} />, onSelect: () => setEditing(g) },
                      {
                        label: 'Eliminar',
                        icon: <Trash2 size={15} />,
                        danger: true,
                        onSelect: async () => {
                          const ok = await confirm({ title: `Eliminar «${g.name}»`, body: 'Se borran la meta y sus aportaciones. Tus movimientos no cambian.', confirmLabel: 'Eliminar', tone: 'danger' })
                          if (!ok) return
                          useStore.getState().deleteGoal(g.id)
                          toast('Meta eliminada')
                        },
                      },
                    ]}
                  />
                </div>
                <div className="mt-4 space-y-1 text-[13px] text-ink-2">
                  {ratio >= 1 ? (
                    <p className="font-medium text-ok">Meta conseguida.</p>
                  ) : (
                    <>
                      {perMonth && <p>Para llegar a tiempo: unos {m(perMonth)} al mes.</p>}
                      {est ? (
                        <p className={cx(late && 'text-warn')}>
                          A tu ritmo actual la alcanzarías en {fmt(est, 'MMMM yyyy')}
                          {late ? ', después de la fecha objetivo.' : '.'}
                        </p>
                      ) : (
                        <p className="text-mute">Con dos aportaciones separadas al menos dos semanas podremos estimar cuándo la alcanzarás.</p>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm" variant="primary" icon={<PiggyBank size={15} />} onClick={() => setContributing(g)}>
                    Añadir aportación
                  </Button>
                  <span className="text-[12.5px] text-mute">{g.contributions.length} aportaciones</span>
                </div>
                {g.contributions.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-mute hover:text-ink">Ver aportaciones</summary>
                    <ul className="mt-2 divide-y divide-line/60">
                      {[...g.contributions].reverse().map((c) => (
                        <li key={c.id} className="flex items-center justify-between py-1.5">
                          <span className="text-mute">{relativeDay(c.date, t0)}</span>
                          <span className="flex items-center gap-1">
                            <span className={cx('num', c.amount < 0 && 'text-danger')}>{m(c.amount)}</span>
                            <IconButton size="sm" label="Quitar aportación" onClick={() => useStore.getState().deleteContribution(g.id, c.id)}>
                              <Trash2 size={13} />
                            </IconButton>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<PiggyBank size={20} />}
          title="Sin metas de ahorro"
          body="Un fondo de emergencia, un viaje, un portátil nuevo… Ponle cifra y fecha y ve sumando aportaciones."
          action={
            <Button variant="primary" onClick={() => setEditing('new')}>
              Crear meta
            </Button>
          }
        />
      )}
      {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {contributing && <ContributionForm goal={contributing} onClose={() => setContributing(null)} />}
    </div>
  )
}

function GoalForm({ goal, onClose }: { goal?: SavingsGoal; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? centsToInput(goal.target) : '')
  const [date, setDate] = useState(goal?.targetDate ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    const c = parseMoney(target)
    if (!name.trim()) err.name = 'Ponle un nombre a la meta.'
    if (c === null) err.target = 'Indica un importe objetivo.'
    if (date && date <= today()) err.date = 'La fecha objetivo debe ser futura.'
    setErrors(err)
    if (Object.keys(err).length) return
    useStore.getState().saveGoal({ id: goal?.id, name: name.trim(), target: c!, targetDate: date || undefined })
    toast(goal ? 'Meta actualizada' : 'Meta creada')
    onClose()
  }
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={goal ? 'Editar meta' : 'Nueva meta de ahorro'}
      tone="peach"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="goal-form">
            Guardar
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Nombre" htmlFor="g-name" error={errors.name}>
          <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Fondo de emergencia" />
        </Field>
        <Field label="Importe objetivo" htmlFor="g-target" error={errors.target}>
          <MoneyInput id="g-target" value={target} onChange={setTarget} invalid={!!errors.target} />
        </Field>
        <Field label="Fecha objetivo (opcional)" htmlFor="g-date" error={errors.date}>
          <Input id="g-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

function ContributionForm({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [withdraw, setWithdraw] = useState<'in' | 'out'>('in')
  const [error, setError] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const c = parseMoney(amount)
    if (c === null) return setError('Indica un importe mayor que cero.')
    useStore.getState().addContribution(goal.id, withdraw === 'out' ? -c : c, date)
    toast(withdraw === 'out' ? 'Retirada anotada' : 'Aportación anotada')
    onClose()
  }
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={goal.name}
      description="Anota lo que apartas para esta meta. No crea movimientos en tus cuentas."
      tone="peach"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="contrib-form">
            Guardar
          </Button>
        </>
      }
    >
      <form id="contrib-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Segmented
          label="Tipo"
          value={withdraw}
          onChange={setWithdraw}
          options={[
            { value: 'in', label: 'Aportación' },
            { value: 'out', label: 'Retirada' },
          ]}
        />
        <Field label="Importe" htmlFor="c-amount" error={error}>
          <MoneyInput id="c-amount" value={amount} onChange={setAmount} invalid={!!error} />
        </Field>
        <Field label="Fecha" htmlFor="c-date">
          <Input id="c-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Recurring                                                           */
/* ------------------------------------------------------------------ */

export function RecurringView() {
  const rules = useStore((s) => s.recurring)
  const categories = useStore((s) => s.categories)
  const m = useMoney()
  const t0 = useToday()
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null)
  const next = useMemo(() => new Map(upcomingRecurring(rules, t0, 400).reverse().map((x) => [x.rule.id, x.date])), [rules, t0])
  const monthlyCost = rules
    .filter((r) => r.active && r.type === 'expense')
    .reduce((s, r) => s + (r.freq === 'monthly' ? r.amount : r.freq === 'weekly' ? Math.round((r.amount * 52) / 12) : Math.round(r.amount / 12)), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          Gastos fijos activos: unos <span className="num font-semibold text-ink">{m(monthlyCost)}</span> al mes.
        </p>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
          Nuevo recurrente
        </Button>
      </div>
      {rules.length ? (
        <ul className="divide-y divide-line rounded-panel border border-line bg-card">
          {rules.map((r) => {
            const cat = categories.find((c) => c.id === r.categoryId)
            const nd = next.get(r.id)
            return (
              <li key={r.id} className={cx('flex items-center gap-3 px-4 py-3', !r.active && 'opacity-55')}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-peach text-peach-ink">
                  <Repeat size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.description}</p>
                  <p className="text-[12.5px] text-mute">
                    {TX_FREQ_LABEL[r.freq]}, {cat?.name}
                    {r.active ? (nd ? `. Próximo: ${relativeDay(nd, t0).toLowerCase()}` : '. Sin próximas fechas') : '. En pausa'}
                  </p>
                </div>
                <span className={cx('num font-semibold', r.type === 'income' && 'text-ok')}>
                  {r.type === 'income' ? '+' : '−'}
                  {m(r.amount)}
                </span>
                <Menu
                  label={`Opciones de ${r.description}`}
                  items={[
                    { label: 'Editar', icon: <Pencil size={15} />, onSelect: () => setEditing(r) },
                    {
                      label: r.active ? 'Pausar' : 'Reanudar',
                      icon: r.active ? <Pause size={15} /> : <Play size={15} />,
                      onSelect: () => {
                        useStore.getState().setRecurringActive(r.id, !r.active)
                        toast(r.active ? 'Recurrente en pausa' : 'Recurrente reanudado')
                      },
                    },
                    {
                      label: 'Eliminar',
                      icon: <Trash2 size={15} />,
                      danger: true,
                      onSelect: async () => {
                        const res = await choose({
                          title: `Eliminar «${r.description}»`,
                          body: '¿Quieres conservar los movimientos que ya se anotaron con esta regla?',
                          confirmLabel: 'Borrar también los movimientos',
                          altLabel: 'Conservar movimientos',
                          tone: 'danger',
                        })
                        if (!res) return
                        useStore.getState().deleteRecurring(r.id, res === 'main')
                        toast('Recurrente eliminado')
                      },
                    },
                  ]}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<Repeat size={20} />}
          title="Sin movimientos recurrentes"
          body="Nómina, alquiler, suscripciones… Se anotan solos en su fecha, una sola vez cada uno."
          action={
            <Button variant="primary" onClick={() => setEditing('new')}>
              Crear recurrente
            </Button>
          }
        />
      )}
      {editing && <RecurringForm rule={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RecurringForm({ rule, onClose }: { rule?: RecurringRule; onClose: () => void }) {
  const categories = useStore((s) => s.categories)
  const accounts = useStore((s) => s.accounts)
  const [type, setType] = useState<TxType>(rule?.type ?? 'expense')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amount) : '')
  const [freq, setFreq] = useState<TxRecurrenceFreq>(rule?.freq ?? 'monthly')
  const [startDate, setStartDate] = useState(rule?.startDate ?? today())
  const [endDate, setEndDate] = useState(rule?.endDate ?? '')
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? categories.find((c) => c.type === type)?.id ?? '')
  const [accountId, setAccountId] = useState(rule?.accountId ?? accounts[0]?.id ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    const c = parseMoney(amount)
    if (!description.trim()) err.description = 'Añade una descripción.'
    if (c === null) err.amount = 'Indica un importe mayor que cero.'
    if (endDate && endDate < startDate) err.endDate = 'La fecha final debe ser posterior al inicio.'
    setErrors(err)
    if (Object.keys(err).length) return
    useStore.getState().saveRecurring({ id: rule?.id, type, description: description.trim(), amount: c!, freq, startDate, endDate: endDate || undefined, categoryId, accountId, active: rule?.active ?? true })
    toast(rule ? 'Recurrente actualizado. Los movimientos ya anotados no cambian.' : 'Recurrente creado')
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? 'Editar recurrente' : 'Nuevo movimiento recurrente'}
      description="Cada fecha se anota una sola vez, aunque abras la app varias veces."
      tone="peach"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="rec-form">
            Guardar
          </Button>
        </>
      }
    >
      <form id="rec-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Segmented
          label="Tipo"
          value={type}
          onChange={(t) => {
            setType(t)
            setCategoryId(categories.find((c) => c.type === t)?.id ?? '')
          }}
          options={[
            { value: 'expense', label: 'Gasto' },
            { value: 'income', label: 'Ingreso' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Descripción" htmlFor="r-desc" error={errors.description}>
            <Input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Alquiler" />
          </Field>
          <Field label="Importe" htmlFor="r-amount" error={errors.amount}>
            <MoneyInput id="r-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Frecuencia" htmlFor="r-freq">
            <Select id="r-freq" value={freq} onChange={(e) => setFreq(e.target.value as TxRecurrenceFreq)}>
              {(Object.keys(TX_FREQ_LABEL) as TxRecurrenceFreq[]).map((f) => (
                <option key={f} value={f}>
                  {TX_FREQ_LABEL[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Primera fecha" htmlFor="r-start">
            <Input id="r-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Hasta (opcional)" htmlFor="r-end" error={errors.endDate}>
            <Input id="r-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría" htmlFor="r-cat">
            <Select id="r-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories
                .filter((c) => c.type === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Cuenta" htmlFor="r-acc">
            <Select id="r-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {!rule && startDate < today() && <p className="rounded-ctl bg-warn-soft px-3 py-2 text-[13px] text-warn">La primera fecha es pasada: se anotarán también las fechas anteriores a hoy.</p>}
      </form>
    </Modal>
  )
}
