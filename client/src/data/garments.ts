// SVG-силуети речей з макета (viewBox 0 0 100 125). Поки немає справжніх фото — малюємо їх.
export type GarmentKind =
  | 'jacket'
  | 'overall'
  | 'hat'
  | 'boots'
  | 'sweater'
  | 'dress'
  | 'vest'
  | 'pants'
  | 'tee'
  | 'bodysuit'

export interface GarmentShape {
  d: string
  s: string
}

export const GARMENTS: Record<GarmentKind, GarmentShape> = {
  jacket: { d: 'M38 22 Q50 13 62 22 L66 28 L82 36 L90 80 L80 82 L74 54 L74 104 L26 104 L26 54 L20 82 L10 80 L18 36 L34 28 Z', s: 'M50 30 L50 102' },
  overall: { d: 'M40 14 Q50 6 60 14 L62 24 L78 32 L86 64 L77 66 L71 46 L72 70 L70 112 L54 112 L50 82 L46 112 L30 112 L28 70 L29 46 L23 66 L14 64 L22 32 L38 24 Z', s: 'M50 26 L50 78' },
  hat: { d: 'M24 86 Q24 44 50 42 Q76 44 76 86 Z M41 36 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 Z M21 84 L79 84 L79 98 Q79 100 77 100 L23 100 Q21 100 21 98 Z', s: 'M26 92 L74 92' },
  boots: { d: 'M16 46 L38 46 L38 80 L54 84 Q61 86 61 94 L61 100 L16 100 Z M44 34 L66 34 L66 68 L82 72 Q89 74 89 82 L89 88 L64 88 L61 84 L44 84 Z', s: 'M18 92 L59 92' },
  sweater: { d: 'M36 24 Q50 33 64 24 L84 34 L92 78 L82 80 L76 54 L76 104 L24 104 L24 54 L18 80 L8 78 L16 34 Z', s: 'M26 96 L74 96' },
  dress: { d: 'M40 22 L60 22 L62 30 L71 34 L66 54 L84 106 L16 106 L34 54 L29 34 L38 30 Z', s: 'M34 54 L66 54' },
  vest: { d: 'M36 22 Q50 30 64 22 L72 30 L74 104 L26 104 L28 30 Z', s: 'M50 30 L50 102 M28 52 L72 52 M27 76 L73 76' },
  pants: { d: 'M28 20 L72 20 L77 108 L57 108 L50 52 L43 108 L23 108 Z', s: 'M28 28 L72 28' },
  tee: { d: 'M37 28 Q50 36 63 28 L82 36 L89 52 L77 56 L75 50 L75 100 L25 100 L25 50 L23 56 L11 52 L18 36 Z', s: 'M25 92 L75 92' },
  bodysuit: { d: 'M37 24 Q50 32 63 24 L80 32 L86 48 L74 52 L72 46 L72 84 Q62 98 56 104 L44 104 Q38 98 28 84 L28 46 L26 52 L14 48 L20 32 Z', s: 'M44 102 L56 102' },
}
