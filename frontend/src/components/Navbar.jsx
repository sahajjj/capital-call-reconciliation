import { useEffect, useState } from 'react'
import { Chevron, Close, Logo, Menu } from './icons.jsx'
import './Navbar.css'

const links = [
  { label: 'Reconciliation', hasMenu: false, href: '#portal' },
  { label: 'Features', hasMenu: true },
  { label: 'How It Works' },
  { label: 'About' },
  { label: 'Blogs' },
]

export default function Navbar({ onGetStarted }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleCta = (e) => {
    if (onGetStarted) {
      e.preventDefault()
      onGetStarted()
    }
  }

  return (
    <header className="nav">
      <a className="nav__brand" href="#main">
        <Logo className="nav__logo" />
        <span>Fluxora</span>
      </a>

      <nav className="nav__pill" aria-label="Primary">
        <ul>
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href || '#main'}
                onClick={link.href === '#portal' ? handleCta : undefined}
              >
                {link.label}
                {link.hasMenu && <Chevron className="nav__chev" />}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="nav__actions">
        <a className="btn btn--light nav__cta" href="#portal" onClick={handleCta}>
          Get Started
        </a>
        <button
          className="nav__burger"
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <Close /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="nav__sheet">
          <ul>
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href || '#main'}
                  onClick={(e) => {
                    setOpen(false)
                    if (link.href === '#portal') handleCta(e)
                  }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            className="btn btn--flame nav__sheet-cta"
            href="#portal"
            onClick={(e) => {
              setOpen(false)
              handleCta(e)
            }}
          >
            Get Started
          </a>
        </div>
      )}
    </header>
  )
}
