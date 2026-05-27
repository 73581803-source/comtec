// Panel: Personal (admin) — gestionar usuarios y ver resumen de ventas/trabajos
(function () {
  const { API, fmt, toast, modal } = window.ComTec;
  let users = [];

  window.ComTec.panels.personal = {
    async render(root, user) {
      root.innerHTML = `
        <div class="section-head">
          <div class="title"><h2>Personal</h2><p>Administradores, vendedores y técnicos</p></div>
          <div class="filters">
            <select id="p-role" class="select" style="width:170px">
              <option value="">Todos los roles</option>
              <option value="admin">Admin</option>
              <option value="vendedor">Vendedores</option>
              <option value="tecnico">Técnicos</option>
            </select>
            <button class="btn btn-primary" id="btn-nuevo">+ Nuevo usuario</button>
          </div>
        </div>
        <div class="card" style="padding:0">
          <div id="tabla-personal" style="overflow-x:auto"></div>
        </div>
      `;
      document.getElementById('p-role').onchange = recargar;
      document.getElementById('btn-nuevo').onclick = () => editar(null);
      recargar();
    }
  };

  async function recargar() {
    const role = document.getElementById('p-role').value;
    try { users = await API.get('/api/users' + (role ? '?role='+role : '')); render(); }
    catch (e) { toast(e.message,'error'); }
  }

  function render() {
    const cont = document.getElementById('tabla-personal');
    if (!users.length) { cont.innerHTML = '<div class="empty">Sin usuarios</div>'; return; }
    cont.innerHTML = `
      <table class="table">
        <thead><tr><th>Usuario</th><th>Rol</th><th>Email</th><th>Teléfono</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><div class="avatar" style="display:inline-flex;margin-right:10px;vertical-align:middle">${(u.nombre||'U').slice(0,2).toUpperCase()}</div><strong>${u.nombre}</strong></td>
              <td>${rolePill(u.role)}</td>
              <td>${u.email}</td>
              <td>${u.telefono||'—'}</td>
              <td><span class="pill ${u.activo?'pill-success':'pill-danger'}">${u.activo?'Activo':'Inactivo'}</span></td>
              <td>
                <button class="btn btn-ghost btn-icon" data-edit="${u.id}">Editar</button>
                ${u.role==='vendedor' ? `<button class="btn btn-ghost btn-icon" data-vendres="${u.id}" data-nom="${u.nombre}">Ver ventas</button>` : ''}
                ${u.role==='tecnico'  ? `<button class="btn btn-ghost btn-icon" data-tecres="${u.id}" data-nom="${u.nombre}">Ver trabajos</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    cont.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editar(b.dataset.edit));
    cont.querySelectorAll('[data-vendres]').forEach(b => b.onclick = () => verResumenVendedor(b.dataset.vendres, b.dataset.nom));
    cont.querySelectorAll('[data-tecres]').forEach(b => b.onclick = () => verResumenTecnico(b.dataset.tecres, b.dataset.nom));
  }

  function rolePill(r) {
    const map = { admin:['pill-brand','Admin'], vendedor:['pill-cyan','Vendedor'], tecnico:['pill-warn','Técnico'] };
    const [c,t] = map[r] || ['pill-mute', r];
    return `<span class="pill ${c}">${t}</span>`;
  }

  function editar(id) {
    const cur = id ? users.find(u => u.id == id) : { nombre:'', email:'', telefono:'', role:'vendedor', activo:1 };
    modal({
      title: id ? 'Editar usuario' : 'Nuevo usuario',
      html: `
        <div class="form-grid">
          <div><label class="field-lbl">Nombre *</label><input id="u-nom" class="input" value="${cur.nombre||''}"/></div>
          <div class="form-row">
            <div><label class="field-lbl">Email *</label><input id="u-em" class="input" type="email" value="${cur.email||''}" ${id?'readonly':''}/></div>
            <div><label class="field-lbl">Teléfono</label><input id="u-tel" class="input" value="${cur.telefono||''}"/></div>
          </div>
          <div class="form-row">
            <div><label class="field-lbl">Rol *</label>
              <select id="u-rol" class="select">
                <option value="admin"    ${cur.role==='admin'?'selected':''}>Administrador</option>
                <option value="vendedor" ${cur.role==='vendedor'?'selected':''}>Vendedor</option>
                <option value="tecnico"  ${cur.role==='tecnico'?'selected':''}>Técnico</option>
              </select>
            </div>
            <div><label class="field-lbl">Estado</label>
              <select id="u-ac" class="select"><option value="1" ${cur.activo?'selected':''}>Activo</option><option value="0" ${!cur.activo?'selected':''}>Inactivo</option></select>
            </div>
          </div>
          <div><label class="field-lbl">${id?'Nueva contraseña (opcional)':'Contraseña *'}</label><input id="u-pw" class="input" type="password" minlength="6"/></div>
        </div>`,
      footer: `<button class="btn btn-ghost" id="btn-x">Cancelar</button><button class="btn btn-primary" id="btn-ok">Guardar</button>`,
      onMount: (wrap, close) => {
        wrap.querySelector('#btn-x').onclick = close;
        wrap.querySelector('#btn-ok').onclick = async () => {
          const data = {
            nombre: wrap.querySelector('#u-nom').value.trim(),
            email:  wrap.querySelector('#u-em').value.trim(),
            telefono: wrap.querySelector('#u-tel').value.trim() || null,
            role:   wrap.querySelector('#u-rol').value,
            activo: +wrap.querySelector('#u-ac').value,
            password: wrap.querySelector('#u-pw').value || undefined,
          };
          if (!data.nombre || !data.email) return toast('Nombre y email requeridos','error');
          if (!id && !data.password) return toast('La contraseña es requerida','error');
          try {
            if (id) await API.put('/api/users/'+id, data);
            else    await API.post('/api/users', data);
            toast('Guardado','success'); close(); recargar();
          } catch (e) { toast(e.message,'error'); }
        };
      }
    });
  }

  async function verResumenVendedor(id, nombre) {
    let r;
    try { r = await API.get('/api/users/'+id+'/ventas-resumen'); } catch (e) { return toast(e.message,'error'); }
    modal({
      title: 'Ventas de ' + nombre,
      html: `
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
          <div class="kpi"><div class="icon brand">💰</div><div class="text"><small>Total histórico</small><strong>${fmt.money(r.total.monto)}</strong><div class="sub">${r.total.ventas} ventas</div></div></div>
          <div class="kpi"><div class="icon cyan">📅</div><div class="text"><small>Mes actual</small><strong>${fmt.money(r.mes.monto)}</strong><div class="sub">${r.mes.ventas} ventas</div></div></div>
        </div>
        <div class="chart-wrap"><canvas id="chart-vend"></canvas></div>`,
      footer: `<button class="btn btn-primary" id="btn-x">Cerrar</button>`,
      onMount: (wrap, close) => {
        wrap.querySelector('#btn-x').onclick = close;
        const dias = ultimos(30);
        const map = Object.fromEntries(r.porDia.map(d => [d.dia, d.monto]));
        new Chart(wrap.querySelector('#chart-vend'), {
          type: 'bar',
          data: {
            labels: dias.map(d => new Date(d+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'})),
            datasets: [{ label: 'Ventas (S/)', data: dias.map(d=>map[d]||0), backgroundColor: '#008dde', borderRadius: 4 }]
          },
          options: { plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true}}, maintainAspectRatio:false }
        });
      }
    });
  }

  async function verResumenTecnico(id, nombre) {
    let r;
    try { r = await API.get('/api/tech/resumen/'+id); } catch (e) { return toast(e.message,'error'); }
    modal({
      title: 'Trabajos de ' + nombre,
      html: `
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
          <div class="kpi"><div class="icon warn">🛠</div><div class="text"><small>Histórico</small><strong>${fmt.money(r.total.ingresos)}</strong><div class="sub">${r.total.trabajos} trabajos</div></div></div>
          <div class="kpi"><div class="icon cyan">📅</div><div class="text"><small>Mes actual</small><strong>${fmt.money(r.mes.ingresos)}</strong><div class="sub">${r.mes.trabajos} trabajos</div></div></div>
        </div>
        <div class="chart-wrap"><canvas id="chart-tec"></canvas></div>`,
      footer: `<button class="btn btn-primary" id="btn-x">Cerrar</button>`,
      onMount: (wrap, close) => {
        wrap.querySelector('#btn-x').onclick = close;
        const dias = ultimos(30);
        const map = Object.fromEntries(r.porDia.map(d => [d.dia, d.ingresos]));
        new Chart(wrap.querySelector('#chart-tec'), {
          type: 'bar',
          data: {
            labels: dias.map(d => new Date(d+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'})),
            datasets: [{ label:'Ingresos (S/)', data: dias.map(d=>map[d]||0), backgroundColor: '#1e329c', borderRadius: 4 }]
          },
          options: { plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true}}, maintainAspectRatio:false }
        });
      }
    });
  }

  function ultimos(n) {
    const out = []; const today = new Date();
    for (let i=n-1;i>=0;i--) { const d=new Date(today); d.setDate(today.getDate()-i); out.push(d.toISOString().slice(0,10)); }
    return out;
  }
})();
