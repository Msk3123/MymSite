// Контакти продавчині. Заміни плейсхолдери на справжні дані.
export const SHOP = {
  name: 'Мамина шафа',
  owner: 'Ларіса',
  city: 'Літин',
  phone: '+380966463930',
  viberUrl: 'viber://chat?number=%2B380000000000',
  telegramUrl: 'https://t.me/',
  bulkDiscount: { minItems: 3, percent: 10 },
}

export const productMessage = (name: string, brand: string, sku: string) =>
  `Доброго дня, цікавить ${name} ${brand}, арт. ${sku}`
