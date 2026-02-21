/**
 * FleetCompute API client. All requests go to API_BASE.
 * Protected calls attach Bearer token from getToken().
 * On 401, onUnauth() is called (clear auth and redirect to home).
 */

const API_BASE = "http://localhost:5001";

let getToken = () => null;
let onUnauth = () => { };

export function setAuthHandlers(tokenGetter, unauthCallback) {
  getToken = tokenGetter;
  onUnauth = unauthCallback;
}

async function request(path, options = {}, useAuth = false) {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (useAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    onUnauth();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// --- Auth (no token) ---
export function login(username, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// --- Public ---
export function getErcotCurrent() {
  return request("/ercot/current");
}

export function getErcotHistory(minutes = 30) {
  return request(`/ercot/history?minutes=${minutes}`);
}

export function getFleetVehicles() {
  return request("/fleet/vehicles");
}

export function getEconomicsSummary() {
  return request("/economics/summary");
}

// --- Protected ---
export function getJobs() {
  return request("/jobs", {}, true);
}

export function createJob(body) {
  return request("/jobs", { method: "POST", body: JSON.stringify(body) }, true);
}

export function getJob(id) {
  return request(`/jobs/${id}`, {}, true);
}
