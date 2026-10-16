import React from "react";
import "./ReconciliationPortal.css";

const ORGANIZATIONS = [
  { slug: "northwind", name: "Northwind Ventures" },
  { slug: "bluebird", name: "Bluebird Capital" },
];

function formatCurrency(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export default function ReconciliationPortal({
  selectedOrg,
  onSelectOrg,
  transactions,
  lineItems,
  loading,
  errorBanner,
  setErrorBanner,
  selectedFile,
  setSelectedFile,
  uploading,
  uploadResult,
  setUploadResult,
  activeActions,
  handleUpload,
  handleApprove,
  handleReject,
  handleIgnore,
  loadData,
  totalCalled,
  totalFunded,
  totalRemaining,
}) {
  const fundedPercent = totalCalled > 0 ? Math.round((totalFunded / totalCalled) * 100) : 0;

  return (
    <section id="portal" className="recon-section">
      <div className="recon-container">
        <div className="recon-header">
          <div>
            <div className="recon-badge">Operations Portal</div>
            <h2 className="recon-title">Capital Call Reconciliation</h2>
            <p className="recon-sub">
              Automated wire matching against investor capital calls with idempotent approval workflows.
            </p>
          </div>

          <div className="org-pill-group" id="org-switcher">
            {ORGANIZATIONS.map((org) => (
              <button
                key={org.slug}
                id={`org-btn-${org.slug}`}
                className={`org-tab-btn ${selectedOrg === org.slug ? "active" : ""}`}
                onClick={() => onSelectOrg(org.slug)}
              >
                {org.name}
              </button>
            ))}
          </div>
        </div>

        {errorBanner && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            color: "#fca5a5",
            padding: "14px 20px",
            borderRadius: "12px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>{errorBanner}</span>
            <button onClick={() => setErrorBanner("")} style={{ color: "#fca5a5", fontWeight: 700 }}>&times;</button>
          </div>
        )}

        <div className="stat-pills">
          <div className="stat-pill">
            <div className="stat-pill-label">Total Capital Called</div>
            <div className="stat-pill-num">{formatCurrency(totalCalled)}</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-label">Total Funded to Date</div>
            <div className="stat-pill-num" style={{ color: "#34d399" }}>{formatCurrency(totalFunded)}</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-label">Remaining Target Balance</div>
            <div className="stat-pill-num" style={{ color: "#ff8a1f" }}>{formatCurrency(totalRemaining)}</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-label">Funded Progress</div>
            <div className="stat-pill-num" style={{ color: "#a5b4fc" }}>{fundedPercent}%</div>
            <div style={{
              height: 6,
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: 3,
              overflow: "hidden",
              marginTop: 10
            }}>
              <div style={{
                width: `${fundedPercent}%`,
                height: "100%",
                background: "linear-gradient(90deg, #ff3d00, #10b981)",
                transition: "width 0.4s ease"
              }} />
            </div>
          </div>
        </div>

        <div className="recon-card" id="csv-upload-section">
          <div className="recon-card-header">
            <h3 className="recon-card-title">Statement CSV Upload</h3>
            <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
              Headers: date, description, amount, type, reference
            </span>
          </div>

          <form onSubmit={handleUpload} className="upload-strip">
            <div style={{ position: "relative" }}>
              <input
                id="portal-csv-file-input"
                type="file"
                accept=".csv,text/csv"
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                  width: "100%"
                }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                    setUploadResult(null);
                  }
                }}
              />
              <div className="btn btn--light" style={{ fontSize: "13px", padding: "8px 18px", cursor: "pointer" }}>
                Choose CSV File
              </div>
            </div>

            <div style={{ fontSize: "13px", color: "var(--flame-lit)", fontFamily: "var(--font-mono)" }}>
              {selectedFile ? selectedFile.name : "No file chosen"}
            </div>

            <button
              id="csv-upload-submit-btn"
              type="submit"
              className="btn btn--flame"
              style={{ fontSize: "13px", marginLeft: "auto", cursor: "pointer" }}
              disabled={!selectedFile || uploading}
            >
              {uploading ? "Processing..." : "Upload & Reconcile"}
            </button>
          </form>

          {uploadResult && (
            <div style={{
              marginTop: "16px",
              padding: "14px 18px",
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid var(--hair-soft)",
              borderRadius: "10px"
            }}>
              <div style={{ display: "flex", gap: "20px", fontSize: "13px", fontWeight: 600 }}>
                <span style={{ color: "#34d399" }}>✓ Imported: {uploadResult.imported}</span>
                <span style={{ color: "#ff8a1f" }}>⚠️ Duplicates: {uploadResult.duplicates}</span>
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <span style={{ color: "#f87171" }}>✗ Errors: {uploadResult.errors.length}</span>
                )}
              </div>

              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <ul style={{ listStyle: "none", marginTop: "10px", display: "grid", gap: "6px" }}>
                  {uploadResult.errors.map((err, idx) => (
                    <li key={idx} style={{
                      fontSize: "12px",
                      color: "#fca5a5",
                      background: "rgba(239, 68, 68, 0.08)",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontFamily: "var(--font-mono)"
                    }}>
                      Line {err.line}: {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="recon-card" id="line-items-panel">
          <div className="recon-card-header">
            <h3 className="recon-card-title">Capital Call Line Items</h3>
            <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
              {lineItems.length} records
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "36px", textAlign: "center", color: "var(--ink-faint)" }}>
              Loading line items...
            </div>
          ) : lineItems.length === 0 ? (
            <div style={{ padding: "36px", textAlign: "center", color: "var(--ink-faint)" }}>
              No line items found for this fund.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="recon-table">
                <thead>
                  <tr>
                    <th>Investor Entity</th>
                    <th>Call #</th>
                    <th>Expected Wire Ref</th>
                    <th>Called</th>
                    <th>Funded</th>
                    <th>Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id} id={`line-item-row-${item.id}`}>
                      <td style={{ fontWeight: 600, color: "#fff" }}>{item.investor}</td>
                      <td><span className="badge-status badge-open">Call #{item.capital_call_number}</span></td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}>{item.expected_wire_reference}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(item.amount_called)}</td>
                      <td style={{ fontFamily: "var(--font-mono)", color: "#34d399" }}>{formatCurrency(item.amount_funded)}</td>
                      <td style={{ fontFamily: "var(--font-mono)", color: parseFloat(item.amount_remaining) > 0 ? "var(--flame-lit)" : "var(--ink-faint)" }}>
                        {formatCurrency(item.amount_remaining)}
                      </td>
                      <td><span className={`badge-status badge-${item.status}`}>{item.status.replace("_", " ")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="recon-card" id="transactions-section">
          <div className="recon-card-header">
            <h3 className="recon-card-title">Bank Transactions & Match Feed</h3>
            <button className="btn-mini-ignore" onClick={loadData} disabled={loading}>
              Refresh Feed
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="recon-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description & Ref</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ minWidth: "300px" }}>Proposed Match & Reasoning</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "36px", color: "var(--ink-faint)" }}>
                      No bank transactions recorded. Upload a CSV statement above.
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => {
                    const isCredit = txn.type === "credit";
                    const canIgnore = (txn.status === "suggested" || txn.status === "needs_review") && isCredit;
                    const isIgnoreRunning = activeActions.has(`ignore-${txn.id}`);

                    return (
                      <tr key={txn.id} id={`txn-row-${txn.id}`}>
                        <td style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{txn.date}</td>
                        <td>
                          <div style={{ fontWeight: 550, color: "#fff" }}>{txn.description}</div>
                          <div style={{ fontSize: "11px", color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>
                            Ref: {txn.bank_reference}
                          </div>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: isCredit ? "#34d399" : "#f87171" }}>
                          {formatCurrency(txn.amount)}
                        </td>
                        <td><span className={`badge-status badge-${txn.status}`}>{txn.status.replace("_", " ")}</span></td>
                        <td>
                          {txn.matches && txn.matches.length > 0 ? (
                            txn.matches.map((match) => {
                              const isApproveRunning = activeActions.has(`approve-${match.id}`);
                              const isRejectRunning = activeActions.has(`reject-${match.id}`);
                              const isProposed = match.status === "proposed";

                              return (
                                <div key={match.id} className="match-box" id={`match-item-${match.id}`}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                                    <strong style={{ color: "#fff" }}>{match.investor}</strong>
                                    <span style={{ color: "var(--flame-lit)", fontFamily: "var(--font-mono)" }}>{match.reference}</span>
                                  </div>
                                  <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginBottom: "8px" }}>
                                    {match.reason}
                                  </div>
                                  {isProposed && (
                                    <div style={{ display: "flex", gap: "8px" }}>
                                      <button
                                        id={`btn-approve-match-${match.id}`}
                                        className="btn-mini-approve"
                                        disabled={isApproveRunning || isRejectRunning}
                                        onClick={() => handleApprove(match.id)}
                                      >
                                        {isApproveRunning ? "Approving..." : "Approve"}
                                      </button>
                                      <button
                                        id={`btn-reject-match-${match.id}`}
                                        className="btn-mini-reject"
                                        disabled={isApproveRunning || isRejectRunning}
                                        onClick={() => handleReject(match.id)}
                                      >
                                        {isRejectRunning ? "Rejecting..." : "Reject"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : txn.review_reason ? (
                            <div style={{
                              fontSize: "12px",
                              color: "#fbbf24",
                              background: "rgba(245, 158, 11, 0.08)",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              borderLeft: "2px solid #fbbf24"
                            }}>
                              {txn.review_reason}
                            </div>
                          ) : (
                            <span style={{ color: "var(--ink-faint)", fontSize: "12px" }}>
                              {txn.status === "ignored" ? "Ignored record" : "No match"}
                            </span>
                          )}
                        </td>
                        <td>
                          {canIgnore && (
                            <button
                              id={`btn-ignore-txn-${txn.id}`}
                              className="btn-mini-ignore"
                              disabled={isIgnoreRunning}
                              onClick={() => handleIgnore(txn.id)}
                            >
                              {isIgnoreRunning ? "Ignoring..." : "Ignore"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
