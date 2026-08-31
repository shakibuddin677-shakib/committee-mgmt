const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

/**
 * Thin wrapper around fetch for talking to the Committee Management API.
 * Pass a token to include it as a Bearer Authorization header.
 */
export async function apiRequest(path, { method = "GET", body, token } = {}) {
  const res = await fetch(API_BASE_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body — leave data as {}
  }

  if (!res.ok) {
    const message = data.message || `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

export { API_BASE_URL };
