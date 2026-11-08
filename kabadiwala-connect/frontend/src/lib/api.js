// Single place where the browser talks to the FastAPI backend.
export const session = {
  getToken: async () => null, // set by AuthContext (Firebase ID token)
  devEmail: null,             // set by AuthContext in dev mode only
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function authorize(headers) {
  const token = await session.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (session.devEmail) headers['X-Dev-Email'] = session.devEmail;
  return headers;
}

function messageFrom(data, status) {
  if (!data) return `Something went wrong (${status}). Please try again.`;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => `${String(d.loc?.slice(-1)[0] ?? 'value')}: ${d.msg}`).join('; ');
  }
  return `Something went wrong (${status}). Please try again.`;
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = await authorize({});
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status);
  return data;
}

export async function download(path, filename) {
  const headers = await authorize({});
  const res = await fetch(`/api${path}`, { headers });
  if (!res.ok) throw new ApiError('Download failed. Please sign in again.', res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function uploadPhoto(file) {
  const form = new FormData();
  form.append('file', file);
  return api('/scrap/images', { method: 'POST', form });
}
