import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchTransactions, fetchLineItems, uploadCSV, approveMatch, rejectMatch, ignoreTransaction } from './api'
import './index.css'

/* ═══════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════ */
function formatCurrency(val) {
  const num = parseFloat(val)
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num)
}

function getStatusBadge(status) {
  const map = {
    reconciled: 'success',
    funded: 'success',
    approved: 'success',
    needs_review: 'warning',
    partially_funded: 'warning',
    suggested: 'info',
    proposed: 'info',
    open: 'neutral',
    ignored: 'neutral',
    rejected: 'danger',
  }
  return map[status] || 'neutral'
}

function formatStatus(status) {
  return status.replace(/_/g, ' ')
}

/* ═══════════════════════════════════════════
   ANIMATED COUNTER HOOK
   ═══════════════════════════════════════════ */
function useAnimatedNumber(target, duration = 1200) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef(null)

  useEffect(() => {
    const start = display
    const diff = target - start
    if (Math.abs(diff) < 0.01) { setDisplay(target); return }

    const startTime = performance.now()

    function animate(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out-expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplay(start + diff * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return display
}

/* ═══════════════════════════════════════════
   PARTICLE BACKGROUND
   ═══════════════════════════════════════════ */
function Particles({ count = 30 }) {
  const particles = Array.from({ length: count }, (_, i) => {
    const left = Math.random() * 100
    const delay = Math.random() * 15
    const dur = 12 + Math.random() * 18
    const size = 1 + Math.random() * 2
    return (
      <div
        key={i}
        className="particle"
        style={{
          left: `${left}%`,
          width: `${size}px`,
          height: `${size}px`,
          animationDelay: `${delay}s`,
          animationDuration: `${dur}s`,
          opacity: 0.3 + Math.random() * 0.4,
        }}
      />
    )
  })
  return <div className="particles">{particles}</div>
}

/* ═══════════════════════════════════════════
   STAT CARD COMPONENT
   ═══════════════════════════════════════════ */
function StatCard({ icon, label, value, color, delta }) {
  const animatedVal = useAnimatedNumber(parseFloat(value) || 0)

  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text-primary)' }}>
        {formatCurrency(animatedVal)}
      </div>
      {delta && (
        <div className={`stat-delta ${delta.type}`}>
          {delta.icon} {delta.text}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */
export default function App() {
  const [selectedOrg, setSelectedOrg] = useState('northwind')
  const [transactions, setTransactions] = useState([])
  const [lineItems, setLineItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [actionInProgress, setActionInProgress] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [txns, items] = await Promise.all([
        fetchTransactions(selectedOrg),
        fetchLineItems(selectedOrg),
      ])
      setTransactions(txns)
      setLineItems(items)
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [selectedOrg])

  useEffect(() => {
    setUploadResult(null)
    setSelectedFile(null)
    loadData()
  }, [loadData])

  const handleUpload = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedFile) return

    setUploading(true)
    setError('')
    try {
      const { data } = await uploadCSV(selectedOrg, selectedFile)
      setUploadResult(data)
      setSelectedFile(null)
      await loadData()
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleApprove = async (matchId) => {
    setActionInProgress(`approve-${matchId}`)
    try {
      await approveMatch(selectedOrg, matchId)
      await loadData()
    } catch (err) {
      setError(err.message || 'Approval failed')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleReject = async (matchId) => {
    setActionInProgress(`reject-${matchId}`)
    try {
      await rejectMatch(selectedOrg, matchId)
      await loadData()
    } catch (err) {
      setError(err.message || 'Rejection failed')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleIgnore = async (txnId) => {
    setActionInProgress(`ignore-${txnId}`)
    try {
      await ignoreTransaction(selectedOrg, txnId)
      await loadData()
    } catch (err) {
      setError(err.message || 'Ignore failed')
    } finally {
      setActionInProgress(null)
    }
  }

  // Computed stats
  const totalCalled = lineItems.reduce((acc, li) => acc + parseFloat(li.amount_called || 0), 0)
  const totalFunded = lineItems.reduce((acc, li) => acc + parseFloat(li.amount_funded || 0), 0)
  const totalRemaining = totalCalled - totalFunded
  const fundedPct = totalCalled > 0 ? ((totalFunded / totalCalled) * 100).toFixed(1) : 0
  const reconciledCount = transactions.filter(t => t.status === 'reconciled').length
  const pendingCount = transactions.filter(t => t.status === 'suggested' || t.status === 'needs_review').length

  const orgName = selectedOrg === 'northwind' ? 'Northwind Ventures' : 'Bluebird Capital'

  return (
    <>
      {/* Background effects */}
      <div className="bg-grid" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <Particles count={25} />

      <div className="app-container">
        {/* ─── NAVBAR ─── */}
        <nav className="navbar">
          <div className="container">
            <div className="logo">
              <div className="logo-icon">F</div>
              <span className="logo-text">FundFlow</span>
              <span className="logo-badge">v1.0</span>
            </div>
            <div className="org-switcher">
              <button
                className={`org-btn ${selectedOrg === 'northwind' ? 'active' : ''}`}
                onClick={() => setSelectedOrg('northwind')}
              >
                ◆ Northwind Ventures
              </button>
              <button
                className={`org-btn ${selectedOrg === 'bluebird' ? 'active' : ''}`}
                onClick={() => setSelectedOrg('bluebird')}
              >
                ◆ Bluebird Capital
              </button>
            </div>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section className="hero">
          <div className="hero-glow" />
          <div className="container">
            <div className="hero-eyebrow">
              <span className="pulse-dot" />
              AI-Powered Reconciliation Engine
            </div>
            <h1>
              Capital calls<br />
              <span className="gradient-text">reconciled in seconds.</span>
            </h1>
            <p className="hero-subtitle">
              Intelligent wire matching against investor commitments with
              idempotent approval workflows and real-time audit trails.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary"
                onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                ↗ Start Reconciling
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => document.getElementById('line-items-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View Dashboard
              </button>
            </div>
          </div>
        </section>

        <div className="container">
          {/* ─── ERROR BANNER ─── */}
          {error && (
            <div className="error-banner">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* ─── STATS ─── */}
          <section className="stats-section">
            <div className="stats-grid">
              <StatCard
                icon="💰"
                label="Total Capital Called"
                value={totalCalled}
                color="var(--text-primary)"
                delta={lineItems.length > 0 ? { type: 'neutral', icon: '📊', text: `${lineItems.length} line items` } : null}
              />
              <StatCard
                icon="✓"
                label="Total Funded"
                value={totalFunded}
                color="var(--success)"
                delta={totalCalled > 0 ? { type: 'positive', icon: '↗', text: `${fundedPct}% funded` } : null}
              />
              <StatCard
                icon="⏳"
                label="Remaining Balance"
                value={totalRemaining}
                color="var(--info)"
              />
              <StatCard
                icon="⚡"
                label="Reconciled"
                value={reconciledCount}
                color={reconciledCount > 0 ? 'var(--success)' : 'var(--text-muted)'}
                delta={pendingCount > 0 ? { type: 'neutral', icon: '◉', text: `${pendingCount} pending` } : null}
              />
            </div>
          </section>

          {/* ─── UPLOAD SECTION ─── */}
          <div className="section-card" id="upload-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="icon">📤</span>
                Import Bank Statement
              </h2>
              <span className="section-count">{orgName}</span>
            </div>

            <div
              className={`upload-zone ${selectedFile ? 'has-file' : ''}`}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0])
                    setUploadResult(null)
                  }
                }}
              />
              {!selectedFile ? (
                <>
                  <div className="upload-icon">📄</div>
                  <div className="upload-label">Drop your CSV file here or click to browse</div>
                  <div className="upload-hint">Supports bank statement CSVs with date, description, amount, type, and reference columns</div>
                </>
              ) : (
                <>
                  <div className="upload-icon">✓</div>
                  <div className="upload-label">File selected</div>
                  <div className="upload-filename">{selectedFile.name}</div>
                </>
              )}
            </div>

            {selectedFile && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                <button
                  className="btn btn-primary"
                  disabled={uploading}
                  onClick={handleUpload}
                >
                  {uploading ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Processing…
                    </>
                  ) : (
                    '⚡ Upload & Reconcile'
                  )}
                </button>
              </div>
            )}

            {uploadResult && (
              <div className="upload-summary-box">
                <div className="upload-result">
                  <div className="upload-result-item success">
                    ✓ Imported: {uploadResult.imported}
                  </div>
                  <div className="upload-result-item warn">
                    ⟳ Duplicates: {uploadResult.duplicates}
                  </div>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="upload-result-item error">
                      ✗ Errors: {uploadResult.errors.length}
                    </div>
                  )}
                </div>

                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="upload-errors-panel">
                    <div className="upload-errors-heading">
                      Row Validation Errors & Skipped Rows ({uploadResult.errors.length})
                    </div>
                    <div className="upload-errors-table">
                      {uploadResult.errors.map((err, idx) => (
                        <div key={idx} className="upload-error-row">
                          <span className="upload-error-badge">Line {err.line}</span>
                          <span className="upload-error-msg">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── LINE ITEMS ─── */}
          <div className="section-card" id="line-items-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="icon">📋</span>
                Capital Call Line Items
              </h2>
              <span className="section-count">{lineItems.length} items</span>
            </div>

            {loading ? (
              <div className="loading-container">
                <div className="spinner" />
                <div className="loading-text">Loading line items…</div>
              </div>
            ) : lineItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <div className="empty-text">No line items found for {orgName}</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Investor</th>
                      <th>Call #</th>
                      <th>Wire Reference</th>
                      <th>Called</th>
                      <th>Funded</th>
                      <th>Remaining</th>
                      <th>Progress</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => {
                      const called = parseFloat(item.amount_called) || 0
                      const funded = parseFloat(item.amount_funded) || 0
                      const pct = called > 0 ? (funded / called) * 100 : 0

                      return (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {item.investor}
                          </td>
                          <td>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                              #{item.capital_call_number}
                            </span>
                          </td>
                          <td>
                            <span className="match-reference">{item.expected_wire_reference}</span>
                          </td>
                          <td>
                            <span className="amount">{formatCurrency(item.amount_called)}</span>
                          </td>
                          <td>
                            <span className="amount credit">{formatCurrency(item.amount_funded)}</span>
                          </td>
                          <td>
                            <span className={`amount ${parseFloat(item.amount_remaining) > 0 ? 'remaining' : 'muted'}`}>
                              {formatCurrency(item.amount_remaining)}
                            </span>
                          </td>
                          <td style={{ minWidth: 100 }}>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                              {pct.toFixed(0)}%
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-${getStatusBadge(item.status)}`}>
                              {formatStatus(item.status)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── TRANSACTIONS ─── */}
          <div className="section-card" id="transactions-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="icon">🏦</span>
                Bank Transactions & Matches
              </h2>
              <span className="section-count">{transactions.length} transactions</span>
            </div>

            {loading ? (
              <div className="loading-container">
                <div className="spinner" />
                <div className="loading-text">Loading transactions…</div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <div className="empty-text">No transactions yet. Upload a bank statement CSV to get started.</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Reference</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Matched To</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => {
                      const isCredit = txn.type === 'credit'
                      const canIgnore = (txn.status === 'suggested' || txn.status === 'needs_review') && isCredit

                      return (
                        <tr key={txn.id}>
                          <td style={{ whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                            {txn.date}
                          </td>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 220 }}>
                            {txn.description}
                          </td>
                          <td>
                            <span className="match-reference">{txn.bank_reference}</span>
                          </td>
                          <td>
                            <span className={`amount ${isCredit ? 'credit' : 'debit'}`}>
                              {isCredit ? '+' : '−'}{formatCurrency(txn.amount)}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-${getStatusBadge(txn.status)}`}>
                              {formatStatus(txn.status)}
                            </span>
                            {txn.review_reason && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, maxWidth: 160 }}>
                                {txn.review_reason}
                              </div>
                            )}
                          </td>
                          <td style={{ minWidth: 220 }}>
                            {txn.matches && txn.matches.length > 0 ? (
                              txn.matches.map((match) => (
                                <div key={match.id} className="match-card">
                                  <div className="match-investor">{match.investor}</div>
                                  <div className="match-reference">{match.reference}</div>
                                  <div className="match-reason">{match.reason}</div>
                                  <div style={{ marginTop: 6 }}>
                                    <span className={`badge badge-${getStatusBadge(match.status)}`} style={{ fontSize: 10 }}>
                                      {match.status}
                                    </span>
                                  </div>
                                  {match.status === 'proposed' && (
                                    <div className="match-actions">
                                      <button
                                        className="btn btn-approve btn-sm"
                                        onClick={() => handleApprove(match.id)}
                                        disabled={actionInProgress === `approve-${match.id}`}
                                      >
                                        {actionInProgress === `approve-${match.id}` ? '…' : '✓ Approve'}
                                      </button>
                                      <button
                                        className="btn btn-reject btn-sm"
                                        onClick={() => handleReject(match.id)}
                                        disabled={actionInProgress === `reject-${match.id}`}
                                      >
                                        {actionInProgress === `reject-${match.id}` ? '…' : '✗ Reject'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            {canIgnore && (
                              <button
                                className="btn btn-ignore btn-sm"
                                onClick={() => handleIgnore(txn.id)}
                                disabled={actionInProgress === `ignore-${txn.id}`}
                              >
                                {actionInProgress === `ignore-${txn.id}` ? '…' : '⊘ Ignore'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── FOOTER ─── */}
          <footer className="footer">
            <div className="footer-content">
              <div className="footer-brand">
                <span className="footer-logo">FundFlow</span>
                <span className="footer-tagline">Capital Call Reconciliation Engine</span>
              </div>
              <div className="footer-credits">
                Made with <span className="footer-heart">♥</span> by <span className="footer-author">Sahaj Sharma</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
