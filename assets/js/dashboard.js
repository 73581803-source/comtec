// ============================================================
// ComTec Dashboard — núcleo SPA
// Gestiona auth, navegación entre paneles y helpers comunes.
// ============================================================
(function () {
  const ComTec = window.ComTec;

  // -------- Definición de paneles (con permisos por rol) --------
  const PANELS = [
    { id: 'home',        label: 'Resumen',       icon: iconHome,     roles: ['admin','tecnico','vendedor'] },
    { id: 'ventas',      label: 'Ventas',        icon: iconCart,     roles: ['admin','vendedor'] },
    { id: 'inventario',  label: 'Inventario',    icon: iconBox,      roles: ['admin','vendedor'] },
    { id: 'componentes', label: 'Componentes',   icon: iconChip,     roles: ['admin'] },
    { id: 'personal',    label: 'Personal',      icon: iconUsers,    roles: ['admin'] },
    { id: 'tecnicos',    label: 'Técnicos',      icon: iconWrench,   roles: ['admin','tecnico'] },
    { id: 'chat',        label: 'Chat',          icon: iconChat,     roles: ['admin','tecnico','vendedor'] },
  ];

  ComTec.PANELS = PANELS;
  ComTec.activePanel = null;
  ComTec.panels = {}; // se registran desde panels/*.js

  // -------- Helpers UI --------
  ComTec.toast = function (msg, type = 'info', ms = 2500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
    t.hidden = false;
    clearTimeout(ComTec._toastTimer);
    ComTec._toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  };

  ComTec.confirm = function (mensaje) {
    return window.confirm(mensaje);
  };

  ComTec.modal = function ({ title, html, footer = '', onMount }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-overlay';
    wrap.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>${title}</h3>
          <button class="modal-close" type="button" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">${html}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('.modal-close').onclick = close;
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    if (typeof onMount === 'function') onMount(wrap, close);
    return { close, root: wrap };
  };

  ComTec.el = function (tag, props = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v);
    }
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  };

  // -------- Render sidebar según rol --------
  function renderSidebar(user) {
    const nav = document.getElementById('sb-nav');
    nav.innerHTML = '';
    const visibles = PANELS.filter(p => p.roles.includes(user.role));
    for (const p of visibles) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.panel = p.id;
      btn.innerHTML = p.icon() + '<span>' + p.label + '</span>';
      btn.onclick = () => ComTec.goto(p.id);
      nav.appendChild(btn);
    }
  }

  // -------- Navegación --------
  ComTec.goto = function (panelId) {
    const user = ComTec.Auth.user();
    const panel = PANELS.find(p => p.id === panelId);
    if (!panel || !panel.roles.includes(user.role)) {
      panelId = 'home';
    }
    ComTec.activePanel = panelId;
    document.querySelectorAll('#sb-nav button').forEach(b => b.classList.toggle('active', b.dataset.panel === panelId));
    document.getElementById('page-title').textContent = (PANELS.find(p => p.id === panelId) || {}).label || 'Panel';
    const handler = ComTec.panels[panelId];
    const root = document.getElementById('content');
    root.innerHTML = '';
    history.replaceState(null, '', '#' + panelId);
    if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
    if (handler && typeof handler.render === 'function') {
      try { handler.render(root, user); }
      catch (err) {
        console.error(err);
        root.innerHTML = `<div class="card empty">Error cargando panel: ${err.message}</div>`;
      }
    } else {
      root.innerHTML = `<div class="card empty">Panel "${panelId}" no implementado</div>`;
    }
  };

  // -------- Init --------
  ComTec.init = async function () {
    ComTec.Auth.requireLogin();
    const user = ComTec.Auth.user();

    // user chip
    document.getElementById('user-nombre').textContent = user.nombre;
    document.getElementById('user-role').textContent = user.role;
    document.getElementById('user-avatar').textContent = (user.nombre || 'U').slice(0, 2).toUpperCase();

    // Sidebar
    renderSidebar(user);

    // Toggle móvil
    document.getElementById('btn-toggle-sb').onclick = () => document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('btn-logout').onclick = () => ComTec.Auth.logout();

    // Verificar token con /api/auth/me (sesión real)
    try { await ComTec.API.get('/api/auth/me'); }
    catch (e) { return ComTec.Auth.logout(); }

    // Panel inicial (hash o home)
    const fromHash = (location.hash || '').replace('#', '');
    const inicial = fromHash || 'home';
    ComTec.goto(inicial);
  };

  // -------- Iconos (SVG inline) --------
  function svg(d, extra = '') { return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">${d}${extra}</svg>`; }
  function iconHome()   { return svg('<path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/>'); }
  function iconCart()   { return svg('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l3 12h12l2-8H6"/>'); }
  function iconBox()    { return svg('<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/>'); }
  function iconChip()   { return svg('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>'); }
  function iconUsers()  { return svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'); }
  function iconWrench() { return svg('<path d="M14.7 6.3a4 4 0 0 0 5 5l-4 4-5-5z"/><path d="M3 21l8-8"/>'); }
  function iconChat()   { return svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'); }

})();
