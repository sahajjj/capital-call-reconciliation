import React, { useState, useEffect, useCallback } from "react";
import {
  fetchTransactions,
  fetchLineItems,
  uploadCSV,
  approveMatch,
  rejectMatch,
  ignoreTransaction,
} from "./api";
import {
  Building2,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

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

export default function App() {
  const [selectedOrg, setSelectedOrg] = useState("northwind");
  const [transactions, setTransactions] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState("");
  
  // CSV Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // In-flight action tracking (key: "approve-123", "reject-123", "ignore-456")
  const [activeActions, setActiveActions] = useState(new Set());

  const setActionRunning = (actionKey, isRunning) => {
    setActiveActions((prev) => {
      const next = new Set(prev);
      if (isRunning) next.add(actionKey);
      else next.delete(actionKey);
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorBanner("");
    try {
      const [txns, items] = await Promise.all([
        fetchTransactions(selectedOrg),
        fetchLineItems(selectedOrg),
      ]);
      setTransactions(txns);
      setLineItems(items);
    } catch (err) {
      setErrorBanner(err.message || "Failed to load organization data.");
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  useEffect(() => {
    setUploadResult(null);
    setSelectedFile(null);
    loadData();
  }, [loadData]);

  // Handle CSV Upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setErrorBanner("");
    try {
      const { data } = await uploadCSV(selectedOrg, selectedFile);
      setUploadResult(data);
      setSelectedFile(null);
      // Reset input element value
      const fileInput = document.getElementById("csv-file-input");
      if (fileInput) fileInput.value = "";
      // Refresh transaction and line item lists
      await loadData();
    } catch (err) {
      setErrorBanner(err.message || "CSV upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // Handle Match Approve
  const handleApprove = async (matchId) => {
    const key = `approve-${matchId}`;
    setActionRunning(key, true);
    setErrorBanner("");
    try {
      await approveMatch(selectedOrg, matchId);
      await loadData();
    } catch (err) {
      setErrorBanner(err.message || "Approval failed.");
    } finally {
      setActionRunning(key, false);
    }
  };

  // Handle Match Reject
  const handleReject = async (matchId) => {
    const key = `reject-${matchId}`;
    setActionRunning(key, true);
    setErrorBanner("");
    try {
      await rejectMatch(selectedOrg, matchId);
      await loadData();
    } catch (err) {
      setErrorBanner(err.message || "Rejection failed.");
    } finally {
      setActionRunning(key, false);
    }
  };

  // Handle Ignore Transaction
  const handleIgnore = async (txnId) => {
    const key = `ignore-${txnId}`;
    setActionRunning(key, true);
    setErrorBanner("");
    try {
      await ignoreTransaction(selectedOrg, txnId);
      await loadData();
    } catch (err) {
      setErrorBanner(err.message || "Ignore failed.");
    } finally {
      setActionRunning(key, false);
    }
  };

  // Metrics calculations
  const totalCalled = lineItems.reduce((acc, li) => acc + parseFloat(li.amount_called || 0), 0);
  const totalFunded = lineItems.reduce((acc, li) => acc + parseFloat(li.amount_funded || 0), 0);
  const totalRemaining = totalCalled - totalFunded;
  const fundedPercent = totalCalled > 0 ? Math.round((totalFunded / totalCalled) * 100) : 0;

  return (
    <div className="container">
      {/* App Header */}
      <header className="app-header">
        <div className="brand">
          <div className="logo-badge">FF</div>
          <div>
            <h1>FundFlow</h1>
            <p>Capital Call Reconciliation & Matching Engine</p>
          </div>
        </div>

        {/* Organization Switcher */}
        <div className="org-selector-group" id="org-switcher">
          {ORGANIZATIONS.map((org) => (
            <button
              key={org.slug}
              id={`org-btn-${org.slug}`}
              className={`org-pill-btn ${selectedOrg === org.slug ? "active" : ""}`}
              onClick={() => setSelectedOrg(org.slug)}
            >
              <Building2 size={16} />
              {org.name}
            </button>
          ))}
        </div>
      </header>

      {/* Global Error Banner */}
      {errorBanner && (
        <div className="error-banner" id="error-banner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner("")}>&times;</button>
        </div>
      )}

      {/* Metrics Summary Bar */}
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">
            <span>Total Called</span>
            <Layers size={16} color="#6366f1" />
          </div>
          <div className="metric-value">{formatCurrency(totalCalled)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">
            <span>Total Funded</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div className="metric-value" style={{ color: "#34d399" }}>
            {formatCurrency(totalFunded)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-title">
            <span>Remaining Target</span>
            <AlertTriangle size={16} color="#f59e0b" />
          </div>
          <div className="metric-value" style={{ color: "#fbbf24" }}>
            {formatCurrency(totalRemaining)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-title">
            <span>Funded Progress</span>
            <span style={{ fontFamily: "var(--font-mono)", color: "#a5b4fc" }}>
              {fundedPercent}%
            </span>
          </div>
          <div
            style={{
              height: 10,
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: 6,
              overflow: "hidden",
              marginTop: 12,
            }}
          >
            <div
              style={{
                width: `${fundedPercent}%`,
                height: "100%",
                background: "linear-gradient(90deg, #6366f1, #10b981)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      </section>

      {/* CSV Upload Section */}
      <section className="dashboard-card" id="csv-upload-section">
        <div className="card-header">
          <div className="card-title-group">
            <FileSpreadsheet size={20} color="#6366f1" />
            <h2 className="card-title">Import Bank Transactions</h2>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Accepts CSV: date, description, amount, type, reference
          </span>
        </div>

        <form onSubmit={handleUpload} className="upload-box">
          <div className="file-input-wrapper">
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                  setUploadResult(null);
                }
              }}
            />
            <div className="btn-file-select">
              <Upload size={16} />
              Choose CSV File
            </div>
          </div>

          <div className="selected-filename">
            {selectedFile ? selectedFile.name : "No file selected"}
          </div>

          <button
            id="csv-upload-submit-btn"
            type="submit"
            className="btn-primary"
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <RefreshCw size={16} className="spinner" style={{ width: 16, height: 16, margin: 0 }} />
                Importing...
              </>
            ) : (
              "Upload and Process"
            )}
          </button>
        </form>

        {/* CSV Upload Feedback / Error Display */}
        {uploadResult && (
          <div className="import-summary-banner" id="import-summary-banner">
            <div className="import-summary-stats">
              <span className="stat-item-success">
                ✓ Imported: {uploadResult.imported}
              </span>
              <span className="stat-item-warn">
                ⚠️ Duplicates Skipped: {uploadResult.duplicates}
              </span>
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <span className="stat-item-danger">
                  ✗ Errors: {uploadResult.errors.length}
                </span>
              )}
            </div>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <ul className="error-list" id="upload-error-list">
                {uploadResult.errors.map((err, idx) => (
                  <li key={idx}>
                    <strong>Line {err.line}:</strong> {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Line Items Overview Panel */}
      <section className="dashboard-card" id="line-items-panel">
        <div className="card-header">
          <div className="card-title-group">
            <Layers size={20} color="#6366f1" />
            <h2 className="card-title">Capital Call Line Items</h2>
            <span className="badge-count">{lineItems.length} items</span>
          </div>
        </div>

        {loading ? (
          <div className="state-container">
            <div className="spinner"></div>
            <p>Loading line items...</p>
          </div>
        ) : lineItems.length === 0 ? (
          <div className="state-container">
            <p>No line items found for this organization.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" id="line-items-table">
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
                    <td style={{ fontWeight: 600 }}>{item.investor}</td>
                    <td>
                      <span className="badge badge-open">Call #{item.capital_call_number}</span>
                    </td>
                    <td className="mono">{item.expected_wire_reference}</td>
                    <td className="mono">{formatCurrency(item.amount_called)}</td>
                    <td className="mono" style={{ color: "#34d399" }}>
                      {formatCurrency(item.amount_funded)}
                    </td>
                    <td className="mono" style={{ color: parseFloat(item.amount_remaining) > 0 ? "#fbbf24" : "var(--text-muted)" }}>
                      {formatCurrency(item.amount_remaining)}
                    </td>
                    <td>
                      <span className={`badge badge-${item.status}`}>
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Transactions Table Section */}
      <section className="dashboard-card" id="transactions-section">
        <div className="card-header">
          <div className="card-title-group">
            <FileSpreadsheet size={20} color="#6366f1" />
            <h2 className="card-title">Bank Transactions & Reconciliation</h2>
            <span className="badge-count">{transactions.length} records</span>
          </div>
          <button
            id="btn-refresh-transactions"
            className="btn-action btn-ignore"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="state-container">
            <div className="spinner"></div>
            <p>Loading bank transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="state-container">
            <p>No bank transactions imported yet. Use the upload panel above to import a CSV.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" id="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description & Bank Ref</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ minWidth: 320 }}>Suggested Match & Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const isCredit = txn.type === "credit";
                  const canIgnore = (txn.status === "suggested" || txn.status === "needs_review") && isCredit;
                  const isIgnoreRunning = activeActions.has(`ignore-${txn.id}`);

                  return (
                    <tr key={txn.id} id={`txn-row-${txn.id}`}>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>
                        {txn.date}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
                          {txn.description}
                        </div>
                        <div className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Ref: {txn.bank_reference}
                        </div>
                      </td>
                      <td>
                        <span className={isCredit ? "amount-credit" : "amount-debit"} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {isCredit ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                          {formatCurrency(txn.amount)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${txn.status}`}>
                          {txn.status.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        {/* If matches exist, list each proposed/approved match */}
                        {txn.matches && txn.matches.length > 0 ? (
                          txn.matches.map((match) => {
                            const isApproveRunning = activeActions.has(`approve-${match.id}`);
                            const isRejectRunning = activeActions.has(`reject-${match.id}`);
                            const isProposed = match.status === "proposed";

                            return (
                              <div key={match.id} className="match-item" id={`match-item-${match.id}`}>
                                <div className="match-meta">
                                  <span className="match-investor">{match.investor}</span>
                                  <span className="match-ref">Ref: {match.reference}</span>
                                </div>
                                <div className="match-reason">{match.reason}</div>
                                {isProposed && (
                                  <div className="action-group">
                                    <button
                                      id={`btn-approve-match-${match.id}`}
                                      className="btn-action btn-approve"
                                      disabled={isApproveRunning || isRejectRunning}
                                      onClick={() => handleApprove(match.id)}
                                    >
                                      <CheckCircle2 size={13} />
                                      {isApproveRunning ? "Approving..." : "Approve Match"}
                                    </button>
                                    <button
                                      id={`btn-reject-match-${match.id}`}
                                      className="btn-action btn-reject"
                                      disabled={isApproveRunning || isRejectRunning}
                                      onClick={() => handleReject(match.id)}
                                    >
                                      <XCircle size={13} />
                                      {isRejectRunning ? "Rejecting..." : "Reject"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : txn.review_reason ? (
                          <div className="review-reason-text">
                            <strong>Needs Review:</strong> {txn.review_reason}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                            {txn.status === "ignored" ? "Ignored record" : "No match proposed"}
                          </span>
                        )}
                      </td>
                      <td>
                        {canIgnore && (
                          <button
                            id={`btn-ignore-txn-${txn.id}`}
                            className="btn-action btn-ignore"
                            disabled={isIgnoreRunning}
                            onClick={() => handleIgnore(txn.id)}
                          >
                            <MinusCircle size={13} />
                            {isIgnoreRunning ? "Ignoring..." : "Ignore"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
