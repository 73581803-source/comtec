// Panel: Chat — tiempo real con Socket.io
(function () {
  const { API, Auth, fmt } = window.ComTec;
  let socket = null;
  let salaActual = 'general';
  let salas = [];
  let typingTimer = null;

  window.ComTec.panels.chat = {
    async render(root, user) {
      root.innerHTML = `
        <div class="chat-shell">
          <aside class="chat-rooms" id="chat-rooms"></aside>
          <section class="chat-panel">
            <header class="chat-head">
              <strong id="chat-room-title">#general</strong>
              <span class="conectado"><span class="dot-conectado" id="dot-conn"></span><span id="conn-state">Conectando…</span></span>
            </header>
            <div class="chat-list" id="chat-list"></div>
            <div class="chat-typing" id="chat-typing"></div>
            <form class="chat-form" id="chat-form">
              <input id="chat-input" type="text" placeholder="Escribe un mensaje…" autocomplete="off" maxlength="1000" required/>
              <button type="submit" aria-label="Enviar">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </form>
          </section>
        </div>
      `;

      try { salas = await API.get('/api/chat/salas'); }
      catch (e) { root.innerHTML = '<div class="card empty">No se pudo cargar el chat</div>'; return; }
      renderSalas();
      conectar(user);
      cargarHistorial(salaActual);
      document.getElementById('chat-form').onsubmit = onEnviar;
      document.getElementById('chat-input').oninput = onEscribiendo;
    },
  };

  function renderSalas() {
    const c = document.getElementById('chat-rooms');
    c.innerHTML = salas.map(s => `
      <button class="room-item ${s.id===salaActual?'active':''}" data-sala="${s.id}">
        <span class="icon">#</span><span>${s.nombre}</span>
      </button>
    `).join('');
    c.querySelectorAll('[data-sala]').forEach(b => b.onclick = () => cambiarSala(b.dataset.sala));
  }

  function cambiarSala(sala) {
    salaActual = sala;
    document.getElementById('chat-room-title').textContent = '#' + ((salas.find(s => s.id===sala) || {}).nombre || sala);
    renderSalas();
    cargarHistorial(sala);
  }

  async function cargarHistorial(sala) {
    const cont = document.getElementById('chat-list');
    cont.innerHTML = '<div class="chat-empty">Cargando…</div>';
    try {
      const msgs = await API.get('/api/chat/messages?sala=' + encodeURIComponent(sala));
      cont.innerHTML = '';
      if (!msgs.length) cont.innerHTML = '<div class="chat-empty">Sé el primero en enviar un mensaje</div>';
      msgs.forEach(addMensaje);
      scrollFinal();
    } catch (e) { cont.innerHTML = '<div class="chat-empty">Error al cargar mensajes</div>'; }
  }

  function conectar(user) {
    if (socket) try { socket.disconnect(); } catch(e){}
    socket = io({ auth: { token: Auth.token() } });
    socket.on('connect', () => setConn(true));
    socket.on('disconnect', () => setConn(false));
    socket.on('connect_error', () => setConn(false));
    socket.on('chat:mensaje', (m) => {
      if (m.sala !== salaActual) return; // si está en otra sala, ignoramos por ahora (podría haber badges)
      addMensaje(m);
      scrollFinal();
    });
    socket.on('chat:escribiendo', ({ nombre, user_id }) => {
      if (user_id === user.id) return;
      const el = document.getElementById('chat-typing');
      el.textContent = nombre + ' está escribiendo…';
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => { el.textContent = ''; }, 1800);
    });
  }

  function setConn(ok) {
    document.getElementById('dot-conn').classList.toggle('off', !ok);
    document.getElementById('conn-state').textContent = ok ? 'En línea' : 'Desconectado';
  }

  function onEnviar(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const texto = input.value.trim();
    if (!texto || !socket) return;
    socket.emit('chat:enviar', { sala: salaActual, mensaje: texto });
    input.value = '';
    input.focus();
  }

  function onEscribiendo() {
    if (!socket) return;
    socket.emit('chat:escribiendo', { sala: salaActual });
  }

  function addMensaje(m) {
    const me = Auth.user().id === m.user_id;
    const cont = document.getElementById('chat-list');
    const empty = cont.querySelector('.chat-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = 'chat-msg ' + (me ? 'me' : 'them');
    div.innerHTML = `
      ${!me ? `<div class="author">${escapeHtml(m.user_nombre)} <span style="font-weight:400;font-size:10px;opacity:.7">· ${m.user_role}</span></div>` : ''}
      <div>${escapeHtml(m.mensaje)}</div>
      <div class="time">${formateaHora(m.creado_en)}</div>
    `;
    cont.appendChild(div);
  }

  function scrollFinal() {
    const cont = document.getElementById('chat-list');
    cont.scrollTop = cont.scrollHeight;
  }

  function formateaHora(s) {
    const d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d)) return s;
    return d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
})();
