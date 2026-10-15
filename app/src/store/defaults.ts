import type { Account, Budget, Category, Exercise, PointEntry, RecurringRule, SavingsGoal, ScheduledWorkout, Settings, Task, TaskSeries, Transaction, UnlockedAchievement, WidgetId, WorkoutSeries, WorkoutSession, WorkoutTemplate } from '../types'
import { DEFAULT_SCORING } from '../features/gamification/scoring'
import { DEFAULT_TASK_CATEGORIES } from '../features/tasks/logic'

export const DATA_VERSION = 1

export interface AppData {
  version: number
  tasks: Task[]
  taskSeries: TaskSeries[]
  templates: WorkoutTemplate[]
  scheduled: ScheduledWorkout[]
  workoutSeries: WorkoutSeries[]
  sessions: WorkoutSession[]
  customExercises: Exercise[]
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  recurring: RecurringRule[]
  budget: Budget
  goals: SavingsGoal[]
  ledger: PointEntry[]
  achievements: UnlockedAchievement[]
  settings: Settings
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'housing', name: 'Vivienda', type: 'expense', color: '#6f8fb8' },
  { id: 'food', name: 'Comida y supermercado', type: 'expense', color: '#78a585' },
  { id: 'transport', name: 'Transporte', type: 'expense', color: '#c4945f' },
  { id: 'health', name: 'Salud y deporte', type: 'expense', color: '#9682c2' },
  { id: 'entertainment', name: 'Ocio', type: 'expense', color: '#cf8282' },
  { id: 'shopping', name: 'Compras', type: 'expense', color: '#bfa246' },
  { id: 'education', name: 'Educación', type: 'expense', color: '#559c9d' },
  { id: 'subscriptions', name: 'Suscripciones', type: 'expense', color: '#8e7f70' },
  { id: 'travel', name: 'Viajes', type: 'expense', color: '#68a3c8' },
  { id: 'personal', name: 'Gastos personales', type: 'expense', color: '#b585ad' },
  { id: 'other_expense', name: 'Otros gastos', type: 'expense', color: '#9aa0a5' },
  { id: 'salary', name: 'Nómina', type: 'income', color: '#4f8a63' },
  { id: 'freelance', name: 'Trabajos freelance', type: 'income', color: '#5c7fb0' },
  { id: 'scholarship', name: 'Becas', type: 'income', color: '#8c76b8' },
  { id: 'business', name: 'Negocio', type: 'income', color: '#b5864f' },
  { id: 'investments', name: 'Inversiones', type: 'income', color: '#4e9a9a' },
  { id: 'other_income', name: 'Otros ingresos', type: 'income', color: '#9aa0a5' },
]

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'main', name: 'Cuenta principal', kind: 'bank', initialBalance: 0 },
  { id: 'cash', name: 'Efectivo', kind: 'cash', initialBalance: 0 },
]

export const ALL_WIDGETS: WidgetId[] = ['focus', 'workout', 'weekTasks', 'weekFitness', 'points', 'streak', 'money', 'budget', 'goals', 'upcoming']

export const WIDGET_LABEL: Record<WidgetId, string> = {
  focus: 'Tu foco de hoy',
  workout: 'Entreno de hoy',
  money: 'Movimientos de hoy',
  weekTasks: 'Tareas de la semana',
  weekFitness: 'Constancia de entreno',
  budget: 'Gasto frente a presupuesto',
  points: 'Puntos y nivel',
  streak: 'Racha',
  goals: 'Metas de ahorro',
  upcoming: 'Próximos días',
}

export function defaultSettings(): Settings {
  return {
    name: '',
    currency: 'EUR',
    goals: { dailyTasks: 3, weeklyTasks: 15, weeklyWorkouts: 3, monthlyPoints: 600 },
    scoring: structuredClone(DEFAULT_SCORING),
    equipment: ['dumbbells', 'mat', 'bands'],
    taskCategories: [...DEFAULT_TASK_CATEGORIES],
    dashboard: { order: [...ALL_WIDGETS], hidden: [] },
    onboarded: false,
    hideAmounts: false,
  }
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    tasks: [],
    taskSeries: [],
    templates: [],
    scheduled: [],
    workoutSeries: [],
    sessions: [],
    customExercises: [],
    accounts: structuredClone(DEFAULT_ACCOUNTS),
    transactions: [],
    categories: structuredClone(DEFAULT_CATEGORIES),
    recurring: [],
    budget: { monthlyTotal: null, byCategory: {} },
    goals: [],
    ledger: [],
    achievements: [],
    settings: defaultSettings(),
  }
}
