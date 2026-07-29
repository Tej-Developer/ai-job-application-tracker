// Central API client. Every call attaches the saved auth token (if any) and
// throws a normalized Error on failure so callers can just try/catch.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const TOKEN_KEY = "trackr_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Called by AuthContext when a request comes back 401, so the whole app can
// react (clear state, redirect to /login) without every call site knowing about it.
let onUnauthorized = () => {};
export const registerUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const token = getToken();
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    onUnauthorized();
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Session expired — please log in again.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  postForm: (path, formData) => request(path, { method: "POST", body: formData, isForm: true }),
};

// CSV export needs the raw blob (with auth header) rather than JSON.
export async function downloadCsv() {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/api/export/csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "applications.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
