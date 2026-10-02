/* API client: the single place where the front end talks to the back end. */
const Api = (() => {
  const TOKEN_KEY = 'dsalog_token';

  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
  const setToken = t => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } };

  class ApiError extends Error {
    constructor(status, message, details) { super(message); this.status = status; this.details = details; }
  }

  async function request(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, 'Cannot reach the server. Check that it is running and try again.');
    }
    if (res.status === 204) return null;

    let data = null;
    try { data = await res.json(); } catch { /* non-JSON response */ }

    if (!res.ok) {
      const isAuthForm = path.startsWith('/auth/login') || path.startsWith('/auth/register');
      if (res.status === 401 && !isAuthForm) { // token missing, invalid or expired
        setToken(null);
        location.href = 'login.html?expired=1';
      }
      throw new ApiError(res.status, data?.error?.message || 'Something went wrong', data?.error?.details);
    }
    return data;
  }

  return {
    ApiError, getToken, setToken,
    isLoggedIn: () => !!getToken(),
    get: p => request('GET', p),
    post: (p, b) => request('POST', p, b),
    patch: (p, b) => request('PATCH', p, b),
    del: p => request('DELETE', p),
  };
})();
