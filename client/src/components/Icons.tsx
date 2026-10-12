import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const stroke = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
})

export const SearchIcon = ({ size = 24, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><circle cx="11" cy="11" r="6.5" /><path d="M16 16 L20 20" /></svg>
)

export const BagIcon = ({ size = 24, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M5 8 H19 L18 20 H6 Z" /><path d="M9 8 V7 a3 3 0 0 1 6 0 V8" /></svg>
)

export const MenuIcon = ({ size = 24, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M4 7 H20 M4 12 H20 M4 17 H20" /></svg>
)

export const ArrowRightIcon = ({ size = 20, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M5 12 H19 M13 6 L19 12 L13 18" /></svg>
)

export const ArrowLeftIcon = ({ size = 24, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M19 12 H5 M11 6 L5 12 L11 18" /></svg>
)

export const CloseIcon = ({ size = 24, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
)

export const SmallCloseIcon = ({ size = 16, ...p }: IconProps) => (
  <svg {...stroke(size, { strokeWidth: 2, ...p })}><path d="M7 7 L17 17 M17 7 L7 17" /></svg>
)

export const ChatIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...stroke(size, p)}>
    <path d="M5 5 H19 a1 1 0 0 1 1 1 V15 a1 1 0 0 1 -1 1 H10 L6 19.5 V16 H5 a1 1 0 0 1 -1 -1 V6 a1 1 0 0 1 1 -1 Z" />
  </svg>
)

export const FilterIcon = ({ size = 20, ...p }: IconProps) => (
  <svg {...stroke(size, p)}>
    <path d="M4 7 H14 M18 7 H20 M4 17 H6 M10 17 H20" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" />
  </svg>
)

export const ChevronDownIcon = ({ size = 18, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M6 9 L12 15 L18 9" /></svg>
)

export const DropIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M12 4 C12 4 6 11 6 15 a6 6 0 0 0 12 0 C18 11 12 4 12 4 Z" /></svg>
)

export const SunIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...stroke(size, p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6" />
  </svg>
)

export const CameraIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M4 8 H8 L9.5 6 H14.5 L16 8 H20 V18 H4 Z" /><circle cx="12" cy="13" r="3.2" /></svg>
)

export const TruckIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...stroke(size, p)}>
    <path d="M3 7 H14 V16 H3 Z M14 10 H18 L21 13 V16 H14" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" />
  </svg>
)

export const CheckIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M5 12.5 L10 17 L19 7" /></svg>
)

export const LogoMark = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
    <rect x="4" y="3" width="22" height="24" rx="5" fill="#dcc29a" />
    <path d="M15 6 V24" stroke="#fbf7f0" strokeWidth="1.6" strokeDasharray="2 2.4" strokeLinecap="round" />
    <circle cx="12" cy="15" r="1.5" fill="#2e2620" />
    <circle cx="18" cy="15" r="1.5" fill="#2e2620" />
  </svg>
)

// Адмінка
export const HomeIcon = ({ size = 24, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M4 11 L12 4 L20 11 V20 H14.5 V14.5 H9.5 V20 H4 Z" /></svg>
)

export const ReceiptIcon = ({ size = 24, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M6 3 H18 V21 L15 19 L12 21 L9 19 L6 21 Z" /><path d="M9 8 H15 M9 12 H15 M9 16 H13" /></svg>
)

export const HangerIcon = ({ size = 24, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M12 8 V7 a2.2 2.2 0 1 1 2.2 -2.2" /><path d="M12 8 L3 15 Q2 17 4 17 H20 Q22 17 21 15 Z" /></svg>
)

export const SparkleIcon = ({ size = 24, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z" /><path d="M19 3 V6 M17.5 4.5 H20.5" /></svg>
)

export const PlusIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M12 5 V19 M5 12 H19" /></svg>
)

export const MicIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11 a6.5 6.5 0 0 0 13 0 M12 17.5 V21" /></svg>
)

export const ExpandIcon = ({ size = 20, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M14 4 H20 V10 M20 4 L13 11 M10 20 H4 V14 M4 20 L11 13" /></svg>
)

export const MinusIcon = ({ size = 20, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M5 12 H19" /></svg>
)

export const EyeIcon = ({ size = 16, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M2 12 S6 5 12 5 S22 12 22 12 S18 19 12 19 S2 12 2 12 Z" /><circle cx="12" cy="12" r="3" /></svg>
)

export const PhoneIcon = ({ size = 20, ...p }: IconProps) => (
  <svg {...stroke(size, p)}><path d="M5 4 H9 L11 9 L8.5 10.5 A11 11 0 0 0 13.5 15.5 L15 13 L20 15 V19 A2 2 0 0 1 18 21 A16 16 0 0 1 3 6 A2 2 0 0 1 5 4 Z" /></svg>
)
