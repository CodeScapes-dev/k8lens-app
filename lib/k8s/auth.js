export function buildAuthHeaders(creds) {
  const headers = { 'Content-Type': 'application/json' };

  if (creds.token) {
    headers['Authorization'] = `Bearer ${creds.token}`;
  }

  return headers;
}

export function buildTlsOptions(creds) {
  if (creds.insecure) {
    return { rejectUnauthorized: false };
  }
  return {};
}
