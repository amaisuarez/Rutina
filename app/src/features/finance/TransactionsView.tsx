import { useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Download, FileUp, Pencil, Repeat, Search, Trash2 } from 'lucide-react'
import type { Transaction } from '../../types'
import { useStore } from '../../store'
import { confirm, openComposer, toast } from '../../store/ui'
import { useMoney } from '../../hooks/useMoney'
import { Button } from '../../components/ui/Button'
import { Badge, EmptyState, Menu } from '../../components/ui/Misc'
import { Input, Select } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { cx } from '../../components/ui/cx'
import { transactionsToRows } from './calc'
import { download, parseCSV, toCSV } from '../../utils/csv'
import { capitalize, fmt, isISODate, relativeDay, today } from '../../utils/dates'
import { parseMoney } from '../../utils/format'

export function TxRow({ tx }: { tx: Transaction }) {
  const m = useMoney()
  const cat = useStore((s) => s.categories.find((c) => c.id === tx.categoryId))
  const acc = useStore((s) => s.accounts.find((a) => a.id === tx.accountId))
  const income = tx.type === 'income'
  return (
    <li className="flex items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-sunken/60">
      <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: `${cat?.color ?? '#9aa0a5'}26`, color: cat?.color }}>
        {income ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
      </span>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openComposer({ kind: 'transaction', tx })} aria-label={`Editar ${tx.description}`}>
        <p className="truncate text-[14.5px] font-medium">{tx.description}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-mute">
          <span>{cat?.name ?? 'Sin categoría'}</span>
          <span>{acc?.name}</span>
          {tx.source === 'recurring' && (
            <span className="inline-flex items-center gap-1">
              <Repeat size={11} /> Recurrente
            </span>
          )}
          {tx.notes && <span className="truncate italic">{tx.notes}</span>}
        </p>
      </button>
      {tx.source === 'imported' && <Badge title="Importado desde un archivo CSV">Importado</Badge>}
      <span className={cx('num shrink-0 text-[15px] font-semibold', income && 'text-ok')}>
        {income ? '+' : '−'}
        {m(tx.amount)}
      </span>
      <Menu
        label={`Opciones de ${tx.description}`}
        items={[
          { label: 'Editar', icon: <Pencil size={15} />, onSelect: () => openComposer({ kind: 'transaction', tx }) },
          {
            label: 'Eliminar',
            icon: <Trash2 size={15} />,
            danger: true,
            onSelect: async () => {
              const ok = await confirm({ title: `Eliminar «${tx.description}»`, confirmLabel: 'Eliminar', tone: 'danger' })
              if (!ok) return
              useStore.getState().deleteTransaction(tx.id)
              toast('Movimiento eliminado')
            },
          },
        ]}
      />
    </li>
  )
}

export function exportTransactionsCSV(txs: Transaction[]) {
  const { categories, accounts } = useStore.getState()
  download(`rutina-movimientos-${today()}.csv`, '﻿' + toCSV(transactionsToRows(txs, categories, accounts)), 'text/csv;charset=utf-8')
}

export function TransactionsView() {
  const txs = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const accounts = useStore((s) => s.accounts)
  const m = useMoney()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [cat, setCat] = useState('')
  const [acc, setAcc] = useState('')
  const [month, setMonth] = useState(today().slice(0, 7))
  const [source, setSource] = useState('')
  const [importing, setImporting] = useState<Omit<Transaction, 'id' | 'createdAt'>[] | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const file = useRef<HTMLInputElement>(null)

  const months = useMemo(() => [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort().reverse(), [txs])
  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return txs
      .filter(
        (t) =>
          (!n || `${t.description} ${t.notes ?? ''}`.toLowerCase().includes(n)) &&
          (!type || t.type === type) &&
          (!cat || t.categoryId === cat) &&
          (!acc || t.accountId === acc) &&
          (!source || t.source === source) &&
          (!month || t.date.startsWith(month)),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [txs, q, type, cat, acc, month, source])

  const groups = useMemo(() => {
    const g = new Map<string, Transaction[]>()
    for (const t of list.slice(0, 300)) g.set(t.date, [...(g.get(t.date) ?? []), t])
    return [...g]
  }, [list])
  const sumIn = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const sumOut = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const onFile = async (f: File) => {
    const text = await f.text()
    const rows = parseCSV(text)
    if (rows.length < 2) {
      toast('El archivo está vacío o no tiene filas.', { tone: 'error' })
      return
    }
    const head = rows[0].map((h) => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h))
    const ci = { date: col('fecha', 'date'), type: col('tipo', 'type'), desc: col('descripcion', 'concepto', 'description'), amount: col('importe', 'cantidad', 'amount'), cat: col('categoria', 'category'), acc: col('cuenta', 'account'), notes: col('notas', 'notes') }
    if (ci.date < 0 || ci.amount < 0) {
      toast('El CSV necesita al menos las columnas «fecha» e «importe».', { tone: 'error' })
      return
    }
    const st = useStore.getState()
    const out: Omit<Transaction, 'id' | 'createdAt'>[] = []
    const errors: string[] = []
    rows.slice(1).forEach((r, i) => {
      const line = i + 2
      let date = r[ci.date]?.trim() ?? ''
      const dm = date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
      if (dm) date = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`
      if (!isISODate(date)) return void errors.push(`Fila ${line}: fecha no válida (${r[ci.date]}).`)
      const raw = (r[ci.amount] ?? '').trim()
      const negative = raw.startsWith('-') || raw.startsWith('−')
      const cents = parseMoney(raw.replace(/^[-−+]/, ''))
      if (cents === null) return void errors.push(`Fila ${line}: importe no válido (${raw}).`)
      const tRaw = ci.type >= 0 ? (r[ci.type] ?? '').toLowerCase() : ''
      const txType = tRaw.startsWith('ing') || tRaw === 'income' ? 'income' : tRaw ? 'expense' : negative ? 'expense' : 'income'
      const catName = ci.cat >= 0 ? (r[ci.cat] ?? '').trim().toLowerCase() : ''
      const category = st.categories.find((c) => c.type === txType && c.name.toLowerCase() === catName)
      const accName = ci.acc >= 0 ? (r[ci.acc] ?? '').trim().toLowerCase() : ''
      const account = st.accounts.find((a) => a.name.toLowerCase() === accName) ?? st.accounts[0]
      out.push({
        type: txType,
        amount: cents,
        date,
        description: (ci.desc >= 0 ? r[ci.desc]?.trim() : '') || 'Movimiento importado',
        categoryId: category?.id ?? (txType === 'income' ? 'other_income' : 'other_expense'),
        accountId: account.id,
        notes: ci.notes >= 0 ? r[ci.notes]?.trim() || undefined : undefined,
        source: 'imported',
      })
    })
    setImportErrors(errors)
    setImporting(out)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(5,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar movimientos" aria-label="Buscar movimientos" className="pl-9" />
        </div>
        <Select aria-label="Mes" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Todos los meses</option>
          {[...new Set([today().slice(0, 7), ...months])].map((mo) => (
            <option key={mo} value={mo}>
              {capitalize(fmt(`${mo}-01`, 'MMMM yyyy'))}
            </option>
          ))}
        </Select>
        <Select aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Gastos e ingresos</option>
          <option value="expense">Solo gastos</option>
          <option value="income">Solo ingresos</option>
        </Select>
        <Select aria-label="Categoría" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Cuenta" value={acc} onChange={(e) => setAcc(e.target.value)}>
          <option value="">Cuenta</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Origen" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Cualquier origen</option>
          <option value="manual">Introducidos a mano</option>
          <option value="recurring">Recurrentes</option>
          <option value="imported">Importados</option>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-mute" aria-live="polite">
          {list.length} movimientos. Entradas <span className="num font-medium text-ok">{m(sumIn)}</span>, salidas <span className="num font-medium text-ink">{m(sumOut)}</span>
        </p>
        <div className="flex gap-2">
          <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0]).finally(() => (e.target.value = ''))} />
          <Button size="sm" icon={<FileUp size={15} />} onClick={() => file.current?.click()}>
            Importar CSV
          </Button>
          <Button size="sm" icon={<Download size={15} />} disabled={!list.length} onClick={() => exportTransactionsCSV(list)}>
            Exportar CSV
          </Button>
        </div>
      </div>

      {groups.length ? (
        <div className="space-y-4">
          {groups.map(([date, items]) => (
            <section key={date}>
              <h3 className="mb-1 px-2 text-[13px] font-medium text-mute">{relativeDay(date)}</h3>
              <ul className="rounded-panel border border-line bg-card p-1">
                {items.map((t) => (
                  <TxRow key={t.id} tx={t} />
                ))}
              </ul>
            </section>
          ))}
          {list.length > 300 && <p className="text-center text-[13px] text-mute">Se muestran los 300 más recientes. Filtra por mes para ver el resto.</p>}
        </div>
      ) : (
        <EmptyState
          title="No hay movimientos con estos filtros"
          body="Cambia el mes o quita filtros. También puedes importar un CSV con columnas fecha, tipo, descripcion, importe, categoria y cuenta."
          action={
            <Button variant="primary" onClick={() => openComposer({ kind: 'transaction', type: 'expense' })}>
              Registrar gasto
            </Button>
          }
        />
      )}

      {importing && (
        <Modal
          open
          onClose={() => setImporting(null)}
          title="Importar movimientos"
          description="Los movimientos importados quedan marcados como «Importado» para distinguirlos de los introducidos a mano."
          tone="peach"
          footer={
            <>
              <Button variant="ghost" onClick={() => setImporting(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={!importing.length}
                onClick={() => {
                  const n = useStore.getState().importTransactions(importing)
                  toast(`${n} movimientos importados`)
                  setImporting(null)
                  setMonth('')
                }}
              >
                Importar {importing.length}
              </Button>
            </>
          }
        >
          <p className="mb-3 text-sm">
            {importing.length} filas válidas. Total gastos {m(importing.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}, ingresos{' '}
            {m(importing.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0))}.
          </p>
          {importErrors.length > 0 && (
            <div className="mb-3 rounded-ctl bg-warn-soft p-3 text-[13px] text-warn">
              <p className="font-medium">{importErrors.length} filas se omitirán:</p>
              <ul className="mt-1 list-disc pl-4">
                {importErrors.slice(0, 6).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <ul className="divide-y divide-line rounded-ctl border border-line text-sm">
            {importing.slice(0, 8).map((t, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2">
                <span className="truncate">
                  {t.date} {t.description}
                </span>
                <span className="num shrink-0">
                  {t.type === 'income' ? '+' : '−'}
                  {m(t.amount)}
                </span>
              </li>
            ))}
            {importing.length > 8 && <li className="px-3 py-2 text-mute">y {importing.length - 8} más</li>}
          </ul>
        </Modal>
      )}
    </div>
  )
}
