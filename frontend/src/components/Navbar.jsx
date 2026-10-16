import { useState } from 'react'
import { Close, Logo, Menu, Building } from './icons.jsx'
import './Navbar.css'

const ORGANIZATIONS = [
  { slug: 'northwind', name: 'Northwind Ventures' },
  { slug: 'bluebird', name: 'Bluebird Capital' },
]

export default function Navbar({ selectedOrg, onSelectOrg, onImportClick }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="nav">
      <a className="nav__brand" href="#hero">
        <Logo className="nav__logo" />
        <span>FundFlow</span>
      </a>

      <div className="nav__pill" aria-label="Tenant switcher">
        <ul>
          {ORGANIZATIONS.map((org) => (
            <li key={org.slug}>
              <button
                type="button"
                id={`nav-org-${org.slug}`}
                className={selectedOrg === org.slug ? 'is-active' : ''}
                onClick={() => onSelectOrg(org.slug)}
              >
                <Building style={{ width: 14, height: 14 }} />
                <span>{org.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="nav__actions">
        <button
          type="button"
          className="btn btn--light nav__cta"
          onClick={onImportClick}
        >
          Import Statement
        </button>
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
          <div style={{ padding: '4px 10px 10px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>
            Select Active Fund
          </div>
          <ul>
            {ORGANIZATIONS.map((org) => (
              <li key={org.slug}>
                <button
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px',
                    borderRadius: '8px',
                    background: selectedOrg === org.slug ? 'rgba(255, 61, 0, 0.2)' : 'transparent',
                    color: selectedOrg === org.slug ? '#fff' : 'var(--ink-soft)'
                  }}
                  onClick={() => {
                    onSelectOrg(org.slug)
                    setOpen(false)
                  }}
                >
                  {org.name}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn--flame nav__sheet-cta"
            onClick={() => {
              setOpen(false)
              onImportClick()
            }}
          >
            Import Statement
          </button>
        </div>
      )}
    </header>
  )
}
