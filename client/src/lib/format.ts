const numberFormat = new Intl.NumberFormat('uk-UA')

export const formatNumber = (value: number) => numberFormat.format(value)

export const formatPrice = (value: number) => `${formatNumber(value)} грн`

/** plural(5, ['річ', 'речі', 'речей']) → «речей» */
export function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export const itemsCount = (n: number) => `${n} ${plural(n, ['річ', 'речі', 'речей'])}`

export const discountPercent = (price: number, oldPrice?: number) =>
  oldPrice ? Math.round((1 - price / oldPrice) * 100) : 0
