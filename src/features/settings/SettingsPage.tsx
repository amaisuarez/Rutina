import { useRef, useState } from 'react'
import { Database, Download, FileJson, HardDrive, Plus, RotateCcw, Sparkles, Trash2, Upload, X } from 'lucide-react'
import type { Difficulty, Intensity, ScoringConfig, TxType } from '../../types'
import { selectData, useStore } from '../../store'
import { confirm, toast } from '../../store/ui'
import { Button } from '../../components/ui/Button'
import { Badge, PageHeader, Panel, PanelTitle } from '../../components/ui/Misc'
import { Field, Input, Segmented, Select, Switch } from '../../components/ui/Form'
import { GoalStepper } from '../tasks/TasksPage'
import { DEFAULT_SCORING, DIFFICULTY_LABEL, INTENSITY_LABEL } from '../gamification/scoring'
import { makeBackup, BackupError } from '../../services/storage'
import { resetAll, restoreBackup } from '../../services/persistence'
import { hasDemo, loadDemo } from '../../services/demo'
import { exportTransactionsCSV } from '../finance/TransactionsView'
import { ALL_WIDGETS } from '../../store/defaults'
import { download } from '../../utils/csv'
import { today } from '../../utils/dates'

const CURRENCIES = [
  ['EUR', 'Euro (€)'],
  ['USD', 'Dólar estadounidense ($)'],
  ['GBP', 'Libra esterlina (£)'],
  ['MXN', 'Peso mexicano'],
  ['ARS', 'Peso argentino'],
  ['COP', 'Peso colombiano'],
  ['CLP', 'Peso chileno'],
  ['CHF', 'Franco suizo'],
]

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard', 'very_hard']
const INTENS: Intensity[] = ['light', 'standard', 'challenging', 'advanced']

function NumField({ label, value, onChange, min = 0, max = 500, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)))
          }}
          className="num h-9 w-20 rounded-lg border border-line bg-card px-2 text-right"
        />
        {suffix && <span className="w-8 text-[12.5px] text-mute">{suffix}</span>}
      </span>
    </label>
  )
}

export default function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const categories = useStore((s) => s.categories)
  const fileRef = useRef<HTMLInputElement>(null)
  const [newTaskCat, setNewTaskCat] = useState('')
  const [newCat, setNewCat] = useState({ name: '', type: 'expense' as TxType, color: '#7f8fa6' })
  const demo = hasDemo()
  const sc = settings.scoring
  const setScoring = (patch: Partial<ScoringConfig>) => updateSettings({ scoring: { ...sc, ...patch } })

  const exportJSON = () => {
    download(`rutina-copia-${today()}.json`, makeBackup(selectData(useStore.getState())), 'application/json')
    toast('Copia de seguridad descargada')
  }

  const importJSON = async (file: File) => {
    const ok = await confirm({
      title: 'Restaurar copia de seguridad',
      body: 'Los datos actuales de este navegador se sustituirán por los de la copia. Si quieres conservarlos, exporta antes una copia.',
      confirmLabel: 'Restaurar',
      tone: 'danger',
    })
    if (!ok) return
    try {
      restoreBackup(await file.text())
      toast('Copia restaurada')
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'No se pudo leer el archivo.', { tone: 'error' })
    }
  }

  const storageSize = (() => {
    try {
      return new Blob([localStorage.getItem('rutina:data') ?? '']).size
    } catch {
      return 0
    }
  })()

  return (
    <>
      <PageHeader title="Ajustes" sub="Perfil, objetivos, reglas de puntos y tus datos." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelTitle>Perfil</PanelTitle>
          <div className="grid gap-4">
            <Field label="Tu nombre" htmlFor="set-name" hint="Solo se usa para saludarte.">
              <Input id="set-name" value={settings.name} onChange={(e) => updateSettings({ name: e.target.value.slice(0, 40) })} placeholder="Cómo quieres que te llamemos" />
            </Field>
            <Field label="Moneda" htmlFor="set-cur" hint="Los importes se muestran con formato español: 1.234,56.">
              <Select id="set-cur" value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
                {CURRENCIES.map(([c, l]) => (
                  <option key={c} value={c}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Switch checked={settings.hideAmounts} onChange={(v) => updateSettings({ hideAmounts: v })} label="Ocultar importes" description="Útil si usas la app en público. Se puede alternar desde Finanzas." />
          </div>
        </Panel>

        <Panel>
          <PanelTitle sub="Se usan en el panel, en las estadísticas y en los logros">Objetivos</PanelTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <GoalStepper label="Tareas al día" value={settings.goals.dailyTasks} onChange={(v) => updateSettings({ goals: { ...settings.goals, dailyTasks: v } })} max={30} />
            <GoalStepper label="Tareas a la semana" value={settings.goals.weeklyTasks} onChange={(v) => updateSettings({ goals: { ...settings.goals, weeklyTasks: v } })} max={150} />
            <GoalStepper label="Entrenos a la semana" value={settings.goals.weeklyWorkouts} onChange={(v) => updateSettings({ goals: { ...settings.goals, weeklyWorkouts: v } })} max={14} />
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-2">Puntos al mes</p>
              <Input
                inputMode="numeric"
                aria-label="Objetivo de puntos al mes"
                value={settings.goals.monthlyPoints}
                onChange={(e) => updateSettings({ goals: { ...settings.goals, monthlyPoints: Math.max(10, parseInt(e.target.value, 10) || 10) } })}
              />
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelTitle
            sub="Los puntos solo se ganan al completar. Cambiar estas reglas no altera los puntos ya ganados."
            action={
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw size={14} />}
                onClick={() => {
                  updateSettings({ scoring: structuredClone(DEFAULT_SCORING) })
                  toast('Reglas de puntos restablecidas')
                }}
              >
                Valores por defecto
              </Button>
            }
          >
            Reglas de puntos
          </PanelTitle>
          <div className="grid gap-x-10 gap-y-4 md:grid-cols-3">
            <div>
              <p className="mb-1 text-[13px] font-semibold text-sky-ink">Tareas, según dificultad</p>
              <div className="divide-y divide-line/70">
                {DIFFS.map((d) => (
                  <NumField key={d} label={DIFFICULTY_LABEL[d]} value={sc.task[d]} onChange={(v) => setScoring({ task: { ...sc.task, [d]: v } })} suffix="pts" />
                ))}
              </div>
              <div className="mt-3">
                <Switch
                  checked={sc.taskDuration.enabled}
                  onChange={(v) => setScoring({ taskDuration: { ...sc.taskDuration, enabled: v } })}
                  label="Extra por tareas largas"
                  description={`+${sc.taskDuration.perHour} por cada hora más allá de la primera, máximo +${sc.taskDuration.max}`}
                />
                {sc.taskDuration.enabled && (
                  <div className="divide-y divide-line/70">
                    <NumField label="Por hora extra" value={sc.taskDuration.perHour} onChange={(v) => setScoring({ taskDuration: { ...sc.taskDuration, perHour: v } })} max={50} suffix="pts" />
                    <NumField label="Máximo" value={sc.taskDuration.max} onChange={(v) => setScoring({ taskDuration: { ...sc.taskDuration, max: v } })} max={100} suffix="pts" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[13px] font-semibold text-sage-ink">Entrenos, según intensidad</p>
              <div className="divide-y divide-line/70">
                {INTENS.map((i) => (
                  <NumField key={i} label={INTENSITY_LABEL[i]} value={sc.workout[i]} onChange={(v) => setScoring({ workout: { ...sc.workout, [i]: v } })} suffix="pts" />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[13px] font-semibold text-ink-2">Duración y límites</p>
              <div className="divide-y divide-line/70">
                <NumField label="Duración de referencia" value={sc.workoutDuration.baselineMin} onChange={(v) => setScoring({ workoutDuration: { ...sc.workoutDuration, baselineMin: v } })} min={10} max={180} suffix="min" />
                <NumField label="Extra por cada 15 min más" value={sc.workoutDuration.per15} onChange={(v) => setScoring({ workoutDuration: { ...sc.workoutDuration, per15: v } })} max={20} suffix="pts" />
                <NumField label="Extra máximo por duración" value={sc.workoutDuration.max} onChange={(v) => setScoring({ workoutDuration: { ...sc.workoutDuration, max: v } })} max={50} suffix="pts" />
                <NumField label="Máximo por sesión" value={sc.sessionCap} onChange={(v) => setScoring({ sessionCap: v })} min={1} max={200} suffix="pts" />
                <NumField label="Series mínimas para puntos completos" value={Math.round(sc.minCompletion * 100)} onChange={(v) => setScoring({ minCompletion: v / 100 })} max={100} step={5} suffix="%" />
              </div>
            </div>
          </div>
          <details className="mt-5 rounded-ctl bg-sunken px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium">Cómo se evita contar puntos dos veces</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              <li>Cada tarea o entreno da puntos una sola vez, al completarse. Pulsar varias veces no suma más.</li>
              <li>Editar algo ya completado no cambia sus puntos.</li>
              <li>Si reabres una tarea o desmarcas un entreno, sus puntos se retiran. Si lo vuelves a completar, se otorgan otra vez con las reglas vigentes. Nunca acumula más de una recompensa.</li>
              <li>Eliminar algo completado retira sus puntos. Descansar o tener un día flojo nunca resta puntos.</li>
              <li>Todo queda anotado en el registro de puntos de Logros.</li>
            </ul>
          </details>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="max-w-xl text-[13px] text-mute">Si has cambiado las reglas y quieres aplicarlas también a lo que ya habías completado, recalcula. Quedará anotado como «Recálculo».</p>
            <Button
              onClick={async () => {
                const ok = await confirm({ title: 'Recalcular puntos', body: 'Se ajustarán los puntos de todo lo completado según las reglas actuales.', confirmLabel: 'Recalcular' })
                if (!ok) return
                const n = useStore.getState().recalculatePoints()
                toast(n ? `${n} actividades recalculadas` : 'Nada que recalcular: ya coinciden con las reglas actuales')
              }}
            >
              Recalcular puntos históricos
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelTitle>Categorías de tareas</PanelTitle>
          <div className="flex flex-wrap gap-1.5">
            {settings.taskCategories.map((c) => (
              <span key={c} className="inline-flex h-8 items-center gap-1 rounded-full bg-sky pr-1 pl-3 text-[13px] text-sky-ink">
                {c}
                <button
                  type="button"
                  aria-label={`Quitar categoría ${c}`}
                  disabled={settings.taskCategories.length <= 1}
                  onClick={() => updateSettings({ taskCategories: settings.taskCategories.filter((x) => x !== c) })}
                  className="grid size-6 place-items-center rounded-full hover:bg-white/60 disabled:opacity-30"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const v = newTaskCat.trim()
              if (!v || settings.taskCategories.includes(v)) return
              updateSettings({ taskCategories: [...settings.taskCategories, v] })
              setNewTaskCat('')
            }}
          >
            <Input value={newTaskCat} onChange={(e) => setNewTaskCat(e.target.value.slice(0, 30))} placeholder="Nueva categoría" aria-label="Nueva categoría de tareas" />
            <Button type="submit" icon={<Plus size={15} />} disabled={!newTaskCat.trim()}>
              Añadir
            </Button>
          </form>
          <p className="mt-2 text-[12.5px] text-mute">Quitar una categoría no cambia las tareas que ya la usan.</p>
        </Panel>

        <Panel>
          <PanelTitle sub="Las predeterminadas no se pueden borrar">Categorías de finanzas</PanelTitle>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <span key={c.id} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-card pr-1 pl-2.5 text-[13px]">
                <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                {c.name}
                <span className="text-[11px] text-mute">{c.type === 'income' ? 'ingreso' : 'gasto'}</span>
                {c.custom ? (
                  <button
                    type="button"
                    aria-label={`Eliminar categoría ${c.name}`}
                    onClick={async () => {
                      const ok = await confirm({ title: `Eliminar «${c.name}»`, body: 'Sus movimientos pasarán a «Otros».', confirmLabel: 'Eliminar', tone: 'danger' })
                      if (ok) useStore.getState().deleteCategory(c.id)
                    }}
                    className="grid size-6 place-items-center rounded-full hover:bg-sunken"
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <span className="w-1" />
                )}
              </span>
            ))}
          </div>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newCat.name.trim()) return
              useStore.getState().saveCategory({ name: newCat.name.trim(), type: newCat.type, color: newCat.color })
              toast('Categoría creada')
              setNewCat({ ...newCat, name: '' })
            }}
          >
            <Input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value.slice(0, 40) })} placeholder="Nueva categoría" aria-label="Nombre de la nueva categoría" />
            <Segmented label="Tipo de categoría" size="sm" value={newCat.type} onChange={(type) => setNewCat({ ...newCat, type })} options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]} />
            <input type="color" aria-label="Color" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} className="h-11 w-12 cursor-pointer rounded-ctl border border-line bg-card p-1" />
            <Button type="submit" icon={<Plus size={15} />} disabled={!newCat.name.trim()}>
              Añadir
            </Button>
          </form>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelTitle sub="Todo se guarda automáticamente en este navegador">Tus datos</PanelTitle>
          <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
            <div className="rounded-ctl bg-sunken p-4 text-sm text-ink-2">
              <p className="mb-2 flex items-center gap-2 font-medium text-ink">
                <HardDrive size={16} /> Dónde están tus datos
              </p>
              <p>
                Rutina guarda la información solo en este navegador y en este dispositivo ({(storageSize / 1024).toLocaleString('es-ES', { maximumFractionDigits: 0 })} KB). No hay servidor ni cuenta, así que nadie más
                puede verlos, pero tampoco se sincronizan con tu móvil u otros ordenadores.
              </p>
              <p className="mt-2">Para pasar los datos a otro dispositivo, exporta una copia aquí e impórtala allí. Si borras los datos del navegador, se pierden: haz copias de vez en cuando.</p>
              <p className="mt-2">La sincronización entre dispositivos necesitaría un servicio externo con inicio de sesión. La app está preparada para añadirlo, pero ahora no existe.</p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button icon={<Download size={16} />} onClick={exportJSON}>
                  Exportar copia (JSON)
                </Button>
                <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
                  Importar copia
                </Button>
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0]).finally(() => (e.target.value = ''))} />
                <Button icon={<FileJson size={16} />} onClick={() => exportTransactionsCSV(useStore.getState().transactions)}>
                  Movimientos en CSV
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {demo ? (
                  <>
                    <Badge tone="lilac">Datos de ejemplo cargados</Badge>
                    <Button
                      size="sm"
                      icon={<Trash2 size={14} />}
                      onClick={async () => {
                        const ok = await confirm({ title: 'Borrar datos de ejemplo', body: 'Se eliminan solo los datos de ejemplo. Lo que hayas creado tú se conserva.', confirmLabel: 'Borrar ejemplo', tone: 'danger' })
                        if (!ok) return
                        useStore.getState().clearDemo()
                        toast('Datos de ejemplo eliminados')
                      }}
                    >
                      Borrar datos de ejemplo
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    icon={<Sparkles size={14} />}
                    onClick={() => {
                      loadDemo()
                      toast('Datos de ejemplo cargados. Puedes borrarlos cuando quieras.')
                    }}
                  >
                    Cargar datos de ejemplo
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    updateSettings({ dashboard: { order: [...ALL_WIDGETS], hidden: [] } })
                    toast('Panel restablecido')
                  }}
                >
                  Restablecer panel
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-ctl border border-danger/30 p-3">
                <p className="flex items-center gap-2 text-sm text-danger">
                  <Database size={15} /> Borrar todo y empezar de cero
                </p>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Borrar todos los datos',
                      body: 'Se eliminarán tareas, entrenos, finanzas, puntos y ajustes de este navegador. No se puede deshacer. Exporta una copia antes si quieres conservarlos.',
                      confirmLabel: 'Sí, borrar todo',
                      tone: 'danger',
                    })
                    if (!ok) return
                    const again = await confirm({ title: '¿Seguro?', body: 'Última confirmación: todos tus datos se borrarán ahora.', confirmLabel: 'Borrar definitivamente', tone: 'danger' })
                    if (!again) return
                    resetAll()
                    toast('Datos borrados')
                  }}
                >
                  Borrar todo
                </Button>
              </div>
            </div>
          </div>
        </Panel>
        <p className="text-[12.5px] text-mute lg:col-span-2">
          Las animaciones se reducen automáticamente si tu sistema tiene activada la opción de reducir movimiento.
        </p>
      </div>
    </>
  )
}
