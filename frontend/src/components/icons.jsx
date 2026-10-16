export const Logo = (props) => (
  <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" {...props}>
    <path d="M14 1.6 20.3 8 14 14.4 7.7 8 14 1.6Z" fill="#FF6A00" />
    <path d="M6.4 9.3 12.7 15.7 6.4 22.1 0.1 15.7 6.4 9.3Z" fill="#FF3D00" />
    <path d="M21.6 9.3 27.9 15.7 21.6 22.1 15.3 15.7 21.6 9.3Z" fill="#FF9A2E" />
  </svg>
)

export const Globe = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.7 5.7 3.7 9S14.5 18.4 12 21c-2.5-2.6-3.7-5.7-3.7-9S9.5 5.6 12 3Z" />
  </svg>
)

export const Chevron = (props) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="m3 4.5 3 3 3-3" />
  </svg>
)

export const ArrowRight = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
)

export const Menu = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="M4 8h16M4 16h16" />
  </svg>
)

export const Close = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

export const Building = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
  </svg>
)

export const Upload = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
)

export const Check = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export const Shield = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

export const custodians = [
  {
    name: 'Fedwire Network',
    mark: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <circle cx="10" cy="10" r="7" />
        <path d="M7 10h6M10 7v6" />
      </svg>
    ),
  },
  {
    name: 'J.P. Morgan',
    mark: (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M3 4h14v2H3V4zm2 4h10v2H5V8zm2 4h6v2H7v-2z" />
      </svg>
    ),
  },
  {
    name: 'BNY Mellon',
    mark: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M10 2.5 17 10l-7 7.5L3 10l7-7.5Z" />
      </svg>
    ),
  },
  {
    name: 'State Street',
    mark: (
      <svg viewBox="0 0 22 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 16V6l4.5 6L11 6l4.5 6L20 6v10" />
      </svg>
    ),
  },
  {
    name: 'Northern Trust',
    mark: (
      <svg viewBox="0 0 22 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 5l3.5 11L9 8l3.5 8L16 5" />
        <circle cx="19" cy="7" r="1.6" />
      </svg>
    ),
  },
]
