import type { MuscleGroup } from '../../types'
import { MUSCLE_LABEL } from './labels'

type Region =
  | 'delts'
  | 'chest'
  | 'biceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'calvesF'
  | 'traps'
  | 'lats'
  | 'lowerBack'
  | 'deltsB'
  | 'triceps'
  | 'glutes'
  | 'hams'
  | 'calvesB'

const GROUP_REGIONS: Record<MuscleGroup, Region[]> = {
  chest: ['chest'],
  back: ['traps', 'lats', 'lowerBack'],
  shoulders: ['delts', 'deltsB'],
  arms: ['biceps', 'forearms', 'triceps'],
  legs: ['quads', 'calvesF', 'hams', 'calvesB'],
  glutes: ['glutes'],
  core: ['abs', 'obliques', 'lowerBack'],
  full_body: ['delts', 'chest', 'abs', 'quads', 'lats', 'glutes', 'hams', 'traps'],
  cardio: ['quads', 'calvesF', 'hams', 'calvesB', 'glutes'],
  mobility: ['lowerBack', 'hams', 'traps', 'quads'],
}

// Simplified, symmetrical anatomy in a 100×210 box per view.
const FRONT: [Region | null, string][] = [
  [null, 'M50 4a11 12 0 1 1 0 24a11 12 0 1 1 0-24z'],
  ['delts', 'M28 38c-6 1-9 6-9 12l7 2c1-6 4-9 9-10z M72 38c6 1 9 6 9 12l-7 2c-1-6-4-9-9-10z'],
  ['chest', 'M36 38h13v20c-6 1-11 0-15-3c-2-6-1-12 2-17z M64 38h-13v20c6 1 11 0 15-3c2-6 1-12-2-17z'],
  ['biceps', 'M20 54l7 2c0 8-1 15-3 20l-6-2c0-7 0-14 2-20z M80 54l-7 2c0 8 1 15 3 20l6-2c0-7 0-14-2-20z'],
  ['forearms', 'M18 77l6 2c-1 9-3 17-5 23l-5-1c0-9 2-17 4-24z M82 77l-6 2c1 9 3 17 5 23l5-1c0-9-2-17-4-24z'],
  ['abs', 'M42 60h16v38c-5 3-11 3-16 0z'],
  ['obliques', 'M36 60l5 1v36l-6-4c-1-11-1-22 1-33z M64 60l-5 1v36l6-4c1-11 1-22-1-33z'],
  ['quads', 'M36 104l12 4c0 17-1 32-3 44h-8c-3-15-3-32-1-48z M64 104l-12 4c0 17 1 32 3 44h8c3-15 3-32 1-48z'],
  ['calvesF', 'M37 158h8c1 13 0 26-2 38h-5c-2-12-2-25-1-38z M63 158h-8c-1 13 0 26 2 38h5c2-12 2-25 1-38z'],
]
const BACK: [Region | null, string][] = [
  [null, 'M50 4a11 12 0 1 1 0 24a11 12 0 1 1 0-24z'],
  ['traps', 'M50 30l-14 8c4 6 9 10 14 12c5-2 10-6 14-12z'],
  ['deltsB', 'M28 38c-6 1-9 6-9 12l7 2c1-6 4-9 9-10z M72 38c6 1 9 6 9 12l-7 2c-1-6-4-9-9-10z'],
  ['lats', 'M36 42c4 6 9 10 13 11v24c-6-2-10-6-13-12c-1-8-1-16 0-23z M64 42c-4 6-9 10-13 11v24c6-2 10-6 13-12c1-8 1-16 0-23z'],
  ['triceps', 'M20 54l7 2c0 8-1 15-3 20l-6-2c0-7 0-14 2-20z M80 54l-7 2c0 8 1 15 3 20l6-2c0-7 0-14-2-20z'],
  [null, 'M18 77l6 2c-1 9-3 17-5 23l-5-1c0-9 2-17 4-24z M82 77l-6 2c1 9 3 17 5 23l5-1c0-9-2-17-4-24z'],
  ['lowerBack', 'M38 80h24v16c-8 3-16 3-24 0z'],
  ['glutes', 'M36 99c4-2 9-2 13 0v16c-5 3-10 2-14-1c-1-5-1-10 1-15z M64 99c-4-2-9-2-13 0v16c5 3 10 2 14-1c1-5 1-10-1-15z'],
  ['hams', 'M36 118l12 2c0 12-1 23-3 32h-8c-2-11-2-23-1-34z M64 118l-12 2c0 12 1 23 3 32h8c2-11 2-23 1-34z'],
  ['calvesB', 'M37 156h8c2 13 1 27-2 40h-5c-2-13-2-27-1-40z M63 156h-8c-2 13-1 27 2 40h5c2-13 2-27 1-40z'],
]

export function MuscleMap({ primary, secondary = [], size = 150 }: { primary: MuscleGroup; secondary?: MuscleGroup[]; size?: number }) {
  const hot = new Set(GROUP_REGIONS[primary])
  const warm = new Set(secondary.flatMap((g) => GROUP_REGIONS[g]).filter((r) => !hot.has(r)))
  const fill = (r: Region | null) => (r && hot.has(r) ? 'var(--color-sage-ink)' : r && warm.has(r) ? 'var(--color-sage-mid)' : '#e4e1d8')
  const label = `Músculo principal: ${MUSCLE_LABEL[primary]}${secondary.length ? `. Secundarios: ${secondary.map((g) => MUSCLE_LABEL[g]).join(', ')}` : ''}.`
  return (
    <figure className="m-0 flex flex-col items-center gap-2">
      <svg viewBox="0 0 210 210" width={size} height={size} role="img" aria-label={label}>
        <g>
          {FRONT.map(([r, d], i) => (
            <path key={`f${i}`} d={d} fill={fill(r)} stroke="white" strokeWidth={1} />
          ))}
        </g>
        <g transform="translate(110 0)">
          {BACK.map(([r, d], i) => (
            <path key={`b${i}`} d={d} fill={fill(r)} stroke="white" strokeWidth={1} />
          ))}
        </g>
        <text x="50" y="208" textAnchor="middle" fontSize="9" fill="var(--color-mute)">
          Frente
        </text>
        <text x="160" y="208" textAnchor="middle" fontSize="9" fill="var(--color-mute)">
          Espalda
        </text>
      </svg>
      <figcaption className="flex items-center gap-3 text-[12px] text-mute">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-sage-ink" /> Principal
        </span>
        {secondary.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-sage-mid" /> Secundario
          </span>
        )}
      </figcaption>
    </figure>
  )
}
