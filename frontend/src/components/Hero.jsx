import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Globe, Shield, custodians } from './icons.jsx'
import './Hero.css'

function formatCurrency(val) {
  const num = parseFloat(val)
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

export default function Hero({ onGetStarted, totalCalled, totalFunded, totalRemaining }) {
  const videoRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const play = video.play()
    if (play?.catch) play.catch(() => {})

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause()
      setReady(true)
    }
  }, [])

  return (
    <section className="hero" id="hero">
      <div className="hero__media">
        <video
          ref={videoRef}
          className={`hero__video ${ready ? 'is-ready' : ''}`}
          src="/hero-loop.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onCanPlay={() => setReady(true)}
        />
        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__rules" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>

      <div className="hero__inner">
        <div className="hero__lead">
          <p className="hero__note">
            <Globe className="hero__note-icon" />
            <span>Automated Wire Matching &amp;<br />Capital Call Reconciliation</span>
          </p>

          <h1 className="hero__title">
            Private Capital<br />
            Reconciled in Seconds<br />
            Not <em>Spreadsheets</em>
          </h1>

          <p className="hero__sub">
            FundFlow ingests bank transaction statements, normalises investor entities,
            and resolves capital calls with row-level atomic locking and audit-ready precision.
          </p>

          <div className="hero__cta">
            <button
              type="button"
              className="btn btn--flame hero__go"
              onClick={onGetStarted}
            >
              Reconcile Statements
              <span className="hero__go-dot" aria-hidden="true"><ArrowRight /></span>
            </button>

            <div className="hero__proof">
              <div className="hero__faces" aria-hidden="true">
                <i style={{ '--a': '#ff7a3d', '--b': '#ffb27a' }} />
                <i style={{ '--a': '#6f4bd8', '--b': '#a98cff' }} />
                <i style={{ '--a': '#1f9ea8', '--b': '#63d6df' }} />
                <i style={{ '--a': '#10b981', '--b': '#34d399' }} />
              </div>
              <span className="hero__proof-text">
                <strong>Row-Level Locking</strong>
                Zero Double Funding
              </span>
            </div>
          </div>

          <ul className="hero__stats">
            <li className="stat">
              <span className="stat__mark" aria-hidden="true">*</span>
              <span className="stat__value">{formatCurrency(totalCalled)}</span>
              <span className="stat__label">Total Capital Called</span>
              <span className="stat__rule" aria-hidden="true" />
            </li>
            <li className="stat">
              <span className="stat__mark" aria-hidden="true">*</span>
              <span className="stat__value" style={{ color: '#34d399' }}>{formatCurrency(totalFunded)}</span>
              <span className="stat__label">Total Funded to Date</span>
              <span className="stat__rule" aria-hidden="true" />
            </li>
            <li className="stat">
              <span className="stat__mark" aria-hidden="true">*</span>
              <span className="stat__value" style={{ color: '#ff8a1f' }}>{formatCurrency(totalRemaining)}</span>
              <span className="stat__label">Target Remaining</span>
              <span className="stat__rule" aria-hidden="true" />
            </li>
          </ul>
        </div>

        <aside className="hero__ghost" aria-hidden="true">
          <div className="ghost__row">
            <div className="ghost__bars">
              <span style={{ height: '34%' }} />
              <span style={{ height: '52%' }} />
              <span style={{ height: '44%' }} />
              <span style={{ height: '70%' }} />
              <span style={{ height: '94%' }} />
            </div>
            <p className="ghost__kpi">
              <strong>100%</strong>
              Precision Match<br />Engine
            </p>
          </div>
          <h2 className="ghost__title">Audit-Ready Safety</h2>
          <p className="ghost__copy">
            Every incoming wire credit runs through deterministic two-tier matching:
            exact reference extraction first, falling back to corporate name entity normalisation.
          </p>
        </aside>
      </div>

      <div className="hero__foot">
        <span className="hero__watermark" aria-hidden="true">CAPITAL</span>
        <div className="hero__partners">
          <span className="hero__partners-label">Supported Custodians &amp; Networks</span>
          <ul>
            {custodians.map((c) => (
              <li key={c.name}>
                {c.mark}
                <span>{c.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
