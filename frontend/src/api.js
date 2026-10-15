const BASE_URL = "/api";

export async function fetchTransactions(org) {
  const res = await fetch(`${BASE_URL}/transactions/`, {
    headers: { "X-Organization": org },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error fetching transactions: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchLineItems(org) {
  const res = await fetch(`${BASE_URL}/line-items/`, {
    headers: { "X-Organization": org },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error fetching line items: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadCSV(org, file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/transactions/import/`, {
    method: "POST",
    headers: { "X-Organization": org },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok && res.status !== 400) {
    throw new Error(data.detail || `Import failed with status ${res.status}`);
  }
  return { status: res.status, data };
}

export async function approveMatch(org, matchId) {
  const res = await fetch(`${BASE_URL}/matches/${matchId}/approve/`, {
    method: "POST",
    headers: { "X-Organization": org },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Approval failed with status ${res.status}`);
  }
  return data;
}

export async function rejectMatch(org, matchId) {
  const res = await fetch(`${BASE_URL}/matches/${matchId}/reject/`, {
    method: "POST",
    headers: { "X-Organization": org },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Rejection failed with status ${res.status}`);
  }
  return data;
}

export async function ignoreTransaction(org, txnId) {
  const res = await fetch(`${BASE_URL}/transactions/${txnId}/ignore/`, {
    method: "POST",
    headers: { "X-Organization": org },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Ignore failed with status ${res.status}`);
  }
  return data;
}
