import type { Product } from '../data/catalog'
import type { GarmentKind } from '../data/garments'

// Поки в базі немає справжніх фото, малюємо силует речі з макета.
// Силует вгадуємо з категорії й назви, колір — стабільний для кожного артикулу.
// Коли з'являться фото (product.coverUrl / photos), цей файл можна буде видалити.

export interface Art {
  garment: GarmentKind
  color: string
  /** Для комплектів — друга річ на картці і фон */
  lot?: { garment: GarmentKind; color: string; bg: string }
}

const BY_NAME: [RegExp, GarmentKind][] = [
  [/комбінезон/i, 'overall'],
  [/жилет/i, 'vest'],
  [/шапк|панам/i, 'hat'],
  [/боді/i, 'bodysuit'],
  [/футболк|лонгслів|піжам/i, 'tee'],
  [/сукн|сарафан|спідниц/i, 'dress'],
  [/штан|шорт|легінс|джинс/i, 'pants'],
  [/черевик|кросівк|чобот|сандал|взутт/i, 'boots'],
  [/кофт|світшот|светр|худі/i, 'sweater'],
]

const BY_CATEGORY: Record<Product['category'], GarmentKind> = {
  outerwear: 'jacket',
  tops: 'sweater',
  pants: 'pants',
  dresses: 'dress',
  shoes: 'boots',
  hats: 'hat',
  sleepwear: 'bodysuit',
  lots: 'overall',
}

const PALETTE: Record<Product['gender'], string[]> = {
  boy: ['#8fa68a', '#7d93a8', '#dcc29a', '#94867a', '#b5532f'],
  girl: ['#d4a59b', '#dcc29a', '#8fa68a'],
  unisex: ['#8fa68a', '#dcc29a', '#d4a59b', '#b5532f'],
}

const LOT_BG: Record<Product['gender'], string> = { boy: '#e4ebdf', girl: '#f5e3df', unisex: '#e4ebdf' }

function hash(text: string) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

export function artFor(p: Pick<Product, 'sku' | 'name' | 'category' | 'gender' | 'lotContents'>): Art {
  const guess = (text: string) => BY_NAME.find(([re]) => re.test(text))?.[1]
  const palette = PALETTE[p.gender]
  const h = hash(p.sku)
  const color = palette[h % palette.length]

  if (p.category === 'lots') {
    // «Комбінезон, 2 шапки…» — перша річ зі складу на передньому плані, друга — позаду.
    const [first = '', second = ''] = (p.lotContents ?? '').split(/,|—/).map((s) => s.trim())
    const garment = guess(first) ?? 'overall'
    const other = guess(second)
    return {
      garment,
      color,
      lot: {
        garment: other && other !== garment ? other : garment === 'sweater' ? 'tee' : 'sweater',
        color: palette[(h + 1) % palette.length],
        bg: LOT_BG[p.gender],
      },
    }
  }

  return { garment: guess(p.name) ?? BY_CATEGORY[p.category], color }
}
