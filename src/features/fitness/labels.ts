import type { Equipment, ExerciseLevel, Intensity, MuscleGroup, Objective } from '../../types'

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  arms: 'Brazos',
  legs: 'Piernas',
  glutes: 'Glúteos',
  core: 'Core y abdomen',
  full_body: 'Cuerpo completo',
  cardio: 'Cardio',
  mobility: 'Movilidad y estiramientos',
}
export const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[]

export const LEVEL_LABEL: Record<ExerciseLevel, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  none: 'Sin material',
  dumbbells: 'Mancuernas',
  barbell: 'Barra',
  kettlebell: 'Kettlebell',
  bands: 'Bandas elásticas',
  machine: 'Máquina / polea',
  pullup_bar: 'Barra de dominadas',
  bench: 'Banco',
  mat: 'Esterilla',
  cardio_machine: 'Máquina de cardio',
}
export const EQUIPMENT = Object.keys(EQUIPMENT_LABEL) as Equipment[]

export const OBJECTIVE_LABEL: Record<Objective, string> = {
  strength: 'Fuerza',
  hypertrophy: 'Masa muscular',
  endurance: 'Resistencia',
  mobility: 'Movilidad',
  fat_loss: 'Quemar grasa',
  recovery: 'Recuperación',
}
export const OBJECTIVES = Object.keys(OBJECTIVE_LABEL) as Objective[]

export const INTENSITIES: Intensity[] = ['light', 'standard', 'challenging', 'advanced']
