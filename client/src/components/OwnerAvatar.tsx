import { useId } from 'react'

/**
 * Ілюстрований аватар продавчині замість фото (Лариса не хоче своє фото на сайті).
 * Пучок, кофтинка в кольорі сайту й сантиметрова стрічка на шиї — вона сама міряє кожну річ.
 */
export function OwnerAvatar({ className, label }: { className?: string; label: string }) {
  const clip = useId()
  return (
    <svg className={className} viewBox="0 0 96 96" role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <circle cx="48" cy="48" r="48" />
        </clipPath>
      </defs>
      <circle cx="48" cy="48" r="48" fill="#f5e3df" />
      <g clipPath={`url(#${clip})`}>
        {/* волосся ззаду й пучок */}
        <circle cx="48" cy="17" r="8.5" fill="#6b4a3a" />
        <path d="M27 47 C27 27 36 19 48 19 C60 19 69 27 69 47 C69 58 66 63 62 66 L34 66 C30 63 27 58 27 47 Z" fill="#6b4a3a" />
        {/* шия */}
        <rect x="42" y="54" width="12" height="14" rx="5" fill="#e6bba1" />
        {/* кофтинка */}
        <path d="M12 96 C14 75 29 66 48 66 C67 66 82 75 84 96 Z" fill="#8fa68a" />
        <path d="M39 66 L48 79 L57 66 Z" fill="#fbf7f0" />
        <path d="M48 79 L48 96" stroke="#7c9477" strokeWidth="1.5" />
        <circle cx="48" cy="85" r="1.4" fill="#fbf7f0" />
        <circle cx="48" cy="91" r="1.4" fill="#fbf7f0" />
        {/* сантиметрова стрічка */}
        <path d="M37 67 C36 76 34 84 33 96" stroke="#dcc29a" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M59 67 C60 74 62 80 64 88" stroke="#dcc29a" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M37 70 l2.5 0 M36.5 75 l2.5 0 M35.8 80 l2.5 0 M35 85 l2.5 0 M34.3 90 l2.5 0 M59.5 71 l2.5 0 M60.6 76 l2.5 0 M61.8 81 l2.5 0 M63 86 l2.2 0"
          stroke="#94867a" strokeWidth="0.9" />
        {/* обличчя */}
        <ellipse cx="48" cy="44" rx="14.5" ry="16.5" fill="#f1d3bd" />
        <path d="M33.5 41 C35 29 43 27 48 27.5 C54 27.5 61.5 31 62.5 41 C58 35 51 33.5 45 35.5 C40.5 37 36.5 38.5 33.5 41 Z" fill="#6b4a3a" />
        {/* усмішка й очі (лагідно примружені) */}
        <path d="M40.5 45 q2.5 -2.6 5 0 M50.5 45 q2.5 -2.6 5 0" stroke="#2e2620" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <circle cx="39.5" cy="50" r="2.6" fill="#e3a395" opacity="0.6" />
        <circle cx="56.5" cy="50" r="2.6" fill="#e3a395" opacity="0.6" />
        <path d="M44 52.5 q4 3.6 8 0" stroke="#9a4f4a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        {/* сережки */}
        <circle cx="33.6" cy="49" r="1.6" fill="#dcc29a" />
        <circle cx="62.4" cy="49" r="1.6" fill="#dcc29a" />
      </g>
    </svg>
  )
}
