import { useState, type FormEvent } from 'react'
import { Repeat } from 'lucide-react'
import type { Transaction, TxRecurrenceFreq, TxType } from '../../types'
import { useStore } from '../../store'
import { closeComposer, toast } from '../../store/ui'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Segmented, Select, Textarea } from '../../components/ui/Form'
import { centsToInput, parseMoney } from '../../utils/format'
import { today } from '../../utils/dates'

export const TX_FREQ_LABEL: Record<TxRecurrenceFreq, string> = { weekly: 'Cada semana', monthly: 'Cada mes', yearly: 'Cada año' }

export function MoneyInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const currency = useStore((s) => s.settings.currency)
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        placeholder="0,00"
        aria-invalid={invalid}
        className="num pr-12 text-lg font-medium"
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-mute">{currency}</span>
    </div>
  )
}

export function TransactionForm({ tx, type: initialType }: { tx?: Transaction; type?: TxType }) {
  const categories = useStore((s) => s.categories)
  const accounts = useStore((s) => s.accounts)
  const [type, setType] = useState<TxType>(tx?.type ?? initialType ?? 'expense')
  const [amount, setAmount] = useState(tx ? centsToInput(tx.amount) : '')
  const [description, setDescription] = useState(tx?.description ?? '')
  const [date, setDate] = useState(tx?.date ?? today())
  const cats = categories.filter((c) => c.type === type)
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? cats[0]?.id ?? '')
  const [accountId, setAccountId] = useState(tx?.accountId ?? accounts[0]?.id ?? '')
  const [notes, setNotes] = useState(tx?.notes ?? '')
  const [repeat, setRepeat] = useState<TxRecurrenceFreq | ''>('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const switchType = (t: TxType) => {
    setType(t)
    const first = categories.find((c) => c.type === t)
    if (!categories.some((c) => c.id === categoryId && c.type === t)) setCategoryId(first?.id ?? '')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const cents = parseMoney(amount)
    const err: Record<string, string> = {}
    if (cents === null) err.amount = 'Escribe un importe mayor que cero, por ejemplo 12,50.'
    else if (cents > 100_000_000_00) err.amount = 'El importe es demasiado alto.'
    if (!description.trim()) err.description = 'Añade una descripción breve.'
    if (!date) err.date = 'Indica la fecha.'
    if (!categoryId) err.category = 'Elige una categoría.'
    if (!accountId) err.account = 'Elige una cuenta.'
    setErrors(err)
    if (Object.keys(err).length) return
    const s = useStore.getState()
    const base = { type, amount: cents!, description: description.trim(), date, categoryId, accountId, notes: notes.trim() || undefined }
    if (tx) {
      s.saveTransaction({ ...base, id: tx.id, recurringId: tx.recurringId })
      toast('Movimiento actualizado')
    } else if (repeat) {
      // The rule books today's occurrence (and any past ones since `date`) itself — no duplicate manual entry.
      s.saveRecurring({ ...base, freq: repeat, startDate: date, active: true })
      toast(`${type === 'expense' ? 'Gasto' : 'Ingreso'} recurrente creado`)
    } else {
      s.saveTransaction(base)
      toast(type === 'expense' ? 'Gasto registrado' : 'Ingreso registrado')
    }
    closeComposer()
  }

  return (
    <Modal
      open
      onClose={closeComposer}
      title={tx ? 'Editar movimiento' : type === 'expense' ? 'Registrar gasto' : 'Registrar ingreso'}
      tone="peach"
      footer={
        <>
          <Button variant="ghost" onClick={closeComposer}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="tx-form">
            {tx ? 'Guardar cambios' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={submit} className="grid gap-4" noValidate>
        {!tx && (
          <Segmented
            label="Tipo de movimiento"
            value={type}
            onChange={switchType}
            options={[
              { value: 'expense', label: 'Gasto' },
              { value: 'income', label: 'Ingreso' },
            ]}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Importe" htmlFor="tx-amount" error={errors.amount}>
            <MoneyInput id="tx-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
          </Field>
          <Field label="Fecha" htmlFor="tx-date" error={errors.date}>
            <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Descripción" htmlFor="tx-desc" error={errors.description}>
          <Input id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === 'expense' ? 'Ej. Supermercado' : 'Ej. Nómina de octubre'} aria-invalid={!!errors.description} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría" htmlFor="tx-cat" error={errors.category}>
            <Select id="tx-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cuenta o medio de pago" htmlFor="tx-acc" error={errors.account}>
            <Select id="tx-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notas (opcional)" htmlFor="tx-notes">
          <Textarea id="tx-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {!tx ? (
          <Field label="Repetir" htmlFor="tx-repeat" hint={repeat ? 'Se anotará solo en cada fecha. Puedes pararlo en «Recurrentes».' : undefined}>
            <Select id="tx-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as TxRecurrenceFreq | '')}>
              <option value="">No se repite</option>
              {(Object.keys(TX_FREQ_LABEL) as TxRecurrenceFreq[]).map((f) => (
                <option key={f} value={f}>
                  {TX_FREQ_LABEL[f]}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          tx.recurringId && (
            <p className="flex items-center gap-2 text-[13px] text-mute">
              <Repeat size={14} /> Generado por un movimiento recurrente. Los cambios afectan solo a este.
            </p>
          )
        )}
      </form>
    </Modal>
  )
}
