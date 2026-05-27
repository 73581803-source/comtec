// Cliente HTTP unificado para la API del backend ComTec
(function () {
  const TOKEN_KEY = 'comtec_token';
  const USER_KEY = 'comtec_user';

  const Auth = {
    setSession(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    token()  { return localStorage.getItem(TOKEN_KEY); },
    user()   {
      const raw = localStorage.getItem(USER_KEY);
      try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    },
    isLogged() { return !!Auth.token(); },
    requireLogin() {
      if (!Auth.isLogged()) { window.location.href = 'login.html'; throw new Error('No autenticado'); }
    },
    logout() { Auth.clear(); window.location.href = 'login.html'; },
  };

  async function request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.token();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const err = (data && data.error) || ('HTTP ' + res.status);
      if (res.status === 401 && url !== '/api/auth/login') {
        Auth.clear();
        if (!location.pathname.endsWith('login.html')) location.href = 'login.html';
      }
      throw new Error(err);
    }
    return data;
  }

  const API = {
    get:    (url)        => request('GET',    url),
    post:   (url, body)  => request('POST',   url, body || {}),
    put:    (url, body)  => request('PUT',    url, body || {}),
    delete: (url)        => request('DELETE', url),
  };

  // Helpers globales
  window.ComTec = window.ComTec || {};
  window.ComTec.Auth = Auth;
  window.ComTec.API  = API;
  window.ComTec.fmt = {
    money: (n) => 'S/ ' + (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    int:   (n) => (Number(n) || 0).toLocaleString('es-PE'),
    date:  (s) => {
      if (!s) return '—';
      const d = new Date(s.replace(' ', 'T'));
      if (isNaN(d)) return s;
      return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    dateShort: (s) => {
      if (!s) return '—';
      const d = new Date(s.replace ? s.replace(' ', 'T') : s);
      if (isNaN(d)) return s;
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    },
  };
})();
