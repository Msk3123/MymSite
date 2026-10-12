import { GARMENTS, type GarmentKind } from '../data/garments'

interface GarmentArtProps {
  kind: GarmentKind
  color: string
  /** Пунктирний шов поверх силуету */
  stitch?: boolean
  className?: string
  viewBox?: string
  label?: string
}

export function GarmentArt({ kind, color, stitch = true, className, viewBox = '0 0 100 125', label }: GarmentArtProps) {
  const g = GARMENTS[kind]
  return (
    <svg
      className={className}
      viewBox={viewBox}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={g.d} fill={color} />
      {stitch && (
        <path d={g.s} fill="none" stroke="#fbf7f0" strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round" />
      )}
    </svg>
  )
}
