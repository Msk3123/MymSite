/**
 * Фото з телефона важать 3–8 МБ і мають 4000+ px. Стискаємо ще в браузері:
 * для сайту — до 1600 px по довшій стороні, JPEG 85% (200–500 КБ);
 * для ШІ — ще менше (див. shrinkForAi), бо OpenAI рахує фото «плитками» по 512 px і кожна коштує токенів.
 * createImageBitmap з imageOrientation враховує поворот з EXIF (фото не ляже «на бік»).
 */
interface ResizeOptions {
  /** Довша сторона не більше */
  maxSide?: number
  /** Коротша сторона не більше (для бірки: текст лишається читабельним, а плиток менше) */
  maxShortSide?: number
  quality?: number
}

export async function resizeImage(file: Blob, { maxSide = 1600, maxShortSide, quality = 0.85 }: ResizeOptions = {}): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Формат, який браузер не вміє розкрити (наприклад, HEIC у Chrome), — хай сервер вирішує.
    return file
  }

  const long = Math.max(bitmap.width, bitmap.height)
  const short = Math.min(bitmap.width, bitmap.height)
  const scale = Math.min(1, maxSide / long, maxShortSide ? maxShortSide / short : 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  // Прозорий PNG без фону став би чорним у JPEG — підкладаємо білий.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  return blob ?? file
}

/**
 * Копія фото для «Заповнити з фото».
 * Бірку модель розглядає крупно: 512 px по короткій стороні — це 2 плитки замість 4 (~14 тис. токенів замість ~25),
 * а великий текст на бірці лишається читабельним. Решту фото модель дивиться «з першого погляду» — 512 px досить.
 */
export const shrinkForAi = (photo: Blob, isTag: boolean) =>
  resizeImage(photo, isTag ? { maxShortSide: 512, maxSide: 1024 } : { maxSide: 512, quality: 0.8 })
