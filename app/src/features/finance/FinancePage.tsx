import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Eye, EyeOff, Landmark, Pencil, Plus, Repeat, Trash2, Wallet } from 'lucide-react'
import type { Account } from '../../types'
import { useStore } from '../../store'
import { confirm, openComposer, toast } from '../../store/ui'
import { useParamState } from '../../hooks/useParamState'
import { useToday } from '../../hooks/useToday'
import { useMoney } from '../../hooks/useMoney'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, EmptyState, Menu, PageHeader, Panel, PanelTitle, Tabs } from '../../components/ui/Misc'
import { Field, Input, Segmented, Select } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { ProgressBar } from '../../components/ui/Progress'
import { cx } from '../../components/ui/cx'
import { balance, budgetLines, periodFor, shiftPeriod, totals, upcomingRecurring, type PeriodKind } from './calc'
import { MoneyInput, TX_FREQ_LABEL } from './TransactionForm'
import { TransactionsView, TxRow } from './TransactionsView'
import { BudgetView, GoalsView, RecurringView } from './PlanningViews'
import { ReportsView } from './ReportsView'
import { capitalize, fmt, relativeDay } from '../../utils/dates'
import { centsToInput, parseMoney, pct } from '../../utils/format'

const VIEWS = ['resumen', 'movimientos', 'presupuesto', 'metas', 'recurrentes', 'informes'] as const
type View = (typeof VIEWS)[number]

export default function FinancePage() {
  const [view, setView] = useParamState<View>('v', 'resumen', VIEWS)
  const hide = useStore((s) => s.settings.hideAmounts)
  const updateSettings = useStore((s) => s.updateSettings)
  return (
    <>
      <PageHeader
        title="Finanzas"
        sub="Tus datos financieros se quedan aquí: nunca se usan en logros ni puntos."
        actions={
          <>
            <IconButton label={hide ? 'Mostrar importes' : 'Ocultar importes'} onClick={() => updateSettings({ hideAmounts: !hide })}>
              {hide ? <Eye size={18} /> : <EyeOff size={18} />}
            </IconButton>
            <Button icon={<ArrowDownLeft size={17} />} onClick={() => openComposer({ kind: 'transaction', type: 'income' })}>
              Ingreso
            </Button>
            <Button variant="primary" icon={<ArrowUpRight size={17} />} onClick={() => openComposer({ kind: 'transaction', type: 'expense' })}>
              Gasto
            </Button>
          </>
        }
      >
        <Tabs
          label="Secciones de finanzas"
          value={view}
          onChange={setView}
          tabs={[
            { value: 'resumen', label: 'Resumen' },
            { value: 'movimientos', label: 'Movimientos' },
            { value: 'presupuesto', label: 'Presupuesto' },
            { value: 'metas', label: 'Ahorro' },
            { value: 'recurrentes', label: 'Recurrentes' },
            { value: 'informes', label: 'Informes' },
          ]}
        />
      </PageHeader>
      {view === 'resumen' && <Overview />}
      {view === 'movimientos' && <TransactionsView />}
      {view === 'presupuesto' && <BudgetView />}
      {view === 'metas' && <GoalsView />}
      {view === 'recurrentes' && <RecurringView />}
      {view === 'informes' && <ReportsView />}
    </>
  )
}

export function PeriodPicker({ kind, onKind, anchor, onAnchor }: { kind: PeriodKind; onKind: (k: PeriodKind) => void; anchor: string; onAnchor: (a: string) => void }) {
  const p = periodFor(kind, anchor)
  const label =
    kind === 'month' ? capitalize(fmt(p.start, 'MMMM yyyy')) : kind === 'quarter' ? `${Math.floor(Number(p.start.slice(5, 7)) / 3) + 1}.º trimestre ${p.start.slice(0, 4)}` : p.start.slice(0, 4)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented
        label="Periodo"
        size="sm"
        value={kind}
        onChange={onKind}
        options={[
          { value: 'month', label: 'Mes' },
          { value: 'quarter', label: 'Trimestre' },
          { value: 'year', label: 'Año' },
        ]}
      />
      <div className="flex items-center">
        <IconButton label="Periodo anterior" size="sm" onClick={() => onAnchor(shiftPeriod(p, -1).start)}>
          <ChevronLeft size={17} />
        </IconButton>
        <span className="min-w-36 text-center font-display text-[17px] font-semibold" aria-live="polite">
          {label}
        </span>
        <IconButton label="Periodo siguiente" size="sm" onClick={() => onAnchor(shiftPeriod(p, 1).start)}>
          <ChevronRight size={17} />
        </IconButton>
      </div>
    </div>
  )
}

function Delta({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  if (!before) return <span className="text-mute">sin datos del periodo anterior</span>
  const d = (now - before) / Math.abs(before)
  const good = invert ? d <= 0 : d >= 0
  return (
    <span className={good ? 'text-ok' : 'text-danger'}>
      {d >= 0 ? '▲' : '▼'} {pct(Math.abs(d))} <span className="text-mute">frente al anterior</span>
    </span>
  )
}

function Overview() {
  const t0 = useToday()
  const m = useMoney()
  const [kind, setKind] = useState<PeriodKind>('month')
  const [anchor, setAnchor] = useState(t0)
  const txs = useStore((s) => s.transactions)
  const accounts = useStore((s) => s.accounts)
  const budget = useStore((s) => s.budget)
  const recurring = useStore((s) => s.recurring)
  const categories = useStore((s) => s.categories)
  const [editingAcc, setEditingAcc] = useState<Account | 'new' | null>(null)

  const p = periodFor(kind, anchor)
  const prev = shiftPeriod(p, -1)
  const cur = totals(txs, p.start, p.end)
  const before = totals(txs, prev.start, prev.end)
  const months = kind === 'month' ? 1 : kind === 'quarter' ? 3 : 12
  const budgetTotal = budget.monthlyTotal ? budget.monthlyTotal * months : null
  const available = balance(accounts, txs, t0)
  const upcoming = upcomingRecurring(recurring, t0 < p.start ? p.start : t0, 30).slice(0, 6)
  const recent = useMemo(() => [...txs].filter((t) => t.date <= t0).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [txs, t0])
  const lines = kind === 'month' ? budgetLines(budget, txs, p.start).filter((l) => l.state !== 'ok') : []
  const catName = new Map(categories.map((c) => [c.id, c.name]))

  return (
    <div className="space-y-5">
      <PeriodPicker kind={kind} onKind={setKind} anchor={anchor} onAnchor={setAnchor} />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <Panel tone="peach" className="flex flex-col justify-between">
          <div>
            <p className="text-sm text-peach-ink">Saldo disponible hoy</p>
            <p className={cx('display-num mt-1 text-[44px] leading-none font-semibold', available < 0 && 'text-danger')}>{m(available)}</p>
          </div>
          <p className="mt-4 text-[13px] text-ink-2">Suma de tus {accounts.length} cuentas con todos los movimientos hasta hoy.</p>
        </Panel>
        <Panel>
          <p className="text-sm text-mute">Ingresos</p>
          <p className="display-num mt-1 text-[30px] leading-tight font-semibold">{m(cur.income)}</p>
          <p className="mt-1 text-[13px]">
            <Delta now={cur.income} before={before.income} />
          </p>
          <p className="mt-4 text-sm text-mute">Gastos</p>
          <p className="display-num mt-1 text-[30px] leading-tight font-semibold">{m(cur.expense)}</p>
          <p className="mt-1 text-[13px]">
            <Delta now={cur.expense} before={before.expense} invert />
          </p>
        </Panel>
        <Panel>
          <p className="text-sm text-mute">Ahorro del periodo</p>
          <p className={cx('display-num mt-1 text-[30px] leading-tight font-semibold', cur.net < 0 && 'text-danger')}>{m(cur.net, { sign: true })}</p>
          <p className="mt-1 text-[13px] text-mute">Tasa de ahorro: {cur.income ? pct(cur.savingsRate) : '—'}</p>
          {budgetTotal ? (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-mute">Presupuesto usado</span>
                <span className="num font-medium">{pct(cur.expense / budgetTotal)}</span>
              </div>
              <ProgressBar
                value={cur.expense / budgetTotal}
                color={cur.expense > budgetTotal ? 'var(--color-danger)' : 'var(--color-peach-ink)'}
                label="Presupuesto usado"
              />
              <p className="mt-1.5 text-[13px] text-mute">
                {cur.expense > budgetTotal ? `Te has pasado ${m(cur.expense - budgetTotal)}` : `Quedan ${m(budgetTotal - cur.expense)} de ${m(budgetTotal)}`}
              </p>
            </div>
          ) : (
            <button type="button" onClick={() => (location.hash = '#/finanzas?v=presupuesto')} className="mt-4 text-sm text-peach-ink underline-offset-4 hover:underline">
              Define un presupuesto mensual
            </button>
          )}
        </Panel>
      </div>

      {lines.length > 0 && (
        <div className="flex flex-col gap-2">
          {lines.map((l) => (
            <p key={l.categoryId} className={cx('rounded-ctl px-4 py-2.5 text-sm', l.state === 'over' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn')}>
              {l.state === 'over'
                ? `${catName.get(l.categoryId)}: has superado el límite en ${m(-l.remaining)}.`
                : `${catName.get(l.categoryId)}: llevas el ${pct(l.ratio)} del límite. Quedan ${m(l.remaining)}.`}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel>
          <PanelTitle
            action={
              <Button size="sm" variant="ghost" onClick={() => (location.hash = '#/finanzas?v=movimientos')}>
                Ver todos
              </Button>
            }
          >
            Últimos movimientos
          </PanelTitle>
          {recent.length ? (
            <ul className="-mx-2 divide-y divide-line/70">
              {recent.map((t) => (
                <TxRow key={t.id} tx={t} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Wallet size={20} />}
              title="Sin movimientos todavía"
              body="Registra tus gastos e ingresos a mano o importa un CSV. Nada se conecta con tu banco."
              action={
                <Button variant="primary" onClick={() => openComposer({ kind: 'transaction', type: 'expense' })}>
                  Registrar un gasto
                </Button>
              }
            />
          )}
        </Panel>
        <div className="space-y-5">
          <Panel>
            <PanelTitle sub="Próximos 30 días">Pagos y cobros recurrentes</PanelTitle>
            {upcoming.length ? (
              <ul className="space-y-2.5">
                {upcoming.map(({ rule, date }) => (
                  <li key={`${rule.id}-${date}`} className="flex items-center gap-3 text-sm">
                    <Repeat size={15} className="shrink-0 text-mute" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{rule.description}</p>
                      <p className="text-[12.5px] text-mute">
                        {relativeDay(date, t0)}, {TX_FREQ_LABEL[rule.freq].toLowerCase()}
                      </p>
                    </div>
                    <span className={cx('num font-medium', rule.type === 'income' && 'text-ok')}>
                      {rule.type === 'income' ? '+' : '−'}
                      {m(rule.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">No hay movimientos recurrentes en los próximos 30 días.</p>
            )}
          </Panel>
          <Panel>
            <PanelTitle
              action={
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditingAcc('new')}>
                  Cuenta
                </Button>
              }
            >
              Cuentas
            </PanelTitle>
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 text-sm">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-peach text-peach-ink">
                    <Landmark size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="num font-medium">{m(balance(accounts, txs, t0, a.id))}</span>
                  <Menu
                    label={`Opciones de ${a.name}`}
                    items={[
                      { label: 'Editar', icon: <Pencil size={15} />, onSelect: () => setEditingAcc(a) },
                      {
                        label: 'Eliminar',
                        icon: <Trash2 size={15} />,
                        danger: true,
                        onSelect: async () => {
                          const ok = await confirm({ title: `Eliminar «${a.name}»`, confirmLabel: 'Eliminar', tone: 'danger' })
                          if (!ok) return
                          if (useStore.getState().deleteAccount(a.id)) toast('Cuenta eliminada')
                          else toast('No se puede eliminar: tiene movimientos o es tu única cuenta.', { tone: 'error' })
                        },
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      {editingAcc && <AccountForm account={editingAcc === 'new' ? undefined : editingAcc} onClose={() => setEditingAcc(null)} />}
    </div>
  )
}

function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<Account['kind']>(account?.kind ?? 'bank')
  const [initial, setInitial] = useState(account ? centsToInput(Math.abs(account.initialBalance)) : '')
  const [negative, setNegative] = useState((account?.initialBalance ?? 0) < 0)
  const [error, setError] = useState<Record<string, string>>({})
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (!name.trim()) err.name = 'Ponle un nombre a la cuenta.'
    const cents = initial.trim() ? parseMoney(initial) : 0
    if (cents === null && initial.trim() !== '0') err.initial = 'Importe no válido.'
    setError(err)
    if (Object.keys(err).length) return
    useStore.getState().saveAccount({ id: account?.id, name: name.trim(), kind, initialBalance: (cents ?? 0) * (negative ? -1 : 1) })
    toast(account ? 'Cuenta actualizada' : 'Cuenta creada')
    onClose()
  }
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
      tone="peach"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="acc-form">
            Guardar
          </Button>
        </>
      }
    >
      <form id="acc-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Nombre" htmlFor="acc-name" error={error.name}>
          <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Cuenta nómina" />
        </Field>
        <Field label="Tipo" htmlFor="acc-kind">
          <Select id="acc-kind" value={kind} onChange={(e) => setKind(e.target.value as Account['kind'])}>
            <option value="bank">Cuenta bancaria</option>
            <option value="card">Tarjeta</option>
            <option value="cash">Efectivo</option>
            <option value="savings">Ahorro</option>
            <option value="other">Otra</option>
          </Select>
        </Field>
        <Field label="Saldo inicial" htmlFor="acc-init" error={error.initial} hint="El saldo que tenía la cuenta antes del primer movimiento que registres.">
          <MoneyInput id="acc-init" value={initial} onChange={setInitial} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} className="size-4" /> Saldo inicial negativo (deuda)
        </label>
        <Badge tone="neutral" className="justify-self-start">
          Introducido a mano. No se conecta con ningún banco.
        </Badge>
      </form>
    </Modal>
  )
}
