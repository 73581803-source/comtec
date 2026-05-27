// Panel: Técnicos — registro de trabajos / ingresos
(function () {
  const { API, fmt, toast, modal } = window.ComTec;
  let logs = [];
  let tecnicos = [];

  window.ComTec.panels.tecnicos = {
    async render(root, user) {
      const esAdmin = user.role === 'admin';
      root.innerHTML = `
        <div class="section-head">
          <div class="title"><h2>Trabajos de técnicos</h2><p>${esAdmin?'Registro completo de servicios técnicos':'Tus trabajos registrados'}</p></div>
          <div class="filters">
            ${esAdmin ? `<select id="t-tec" class="select" style="width:200px"><option value="">Todos los técnicos</option></select>` : ''}
            <input type="date" id="t-desde" class="input" style="width:160px"/>
            <input type="date" id="t-hasta" class="input" style="width:160px"/>
            <button class="btn btn-ghost" id="btn-filtrar">Filtrar</button>
            <button class="btn btn-primary" id="btn-add">+ Registrar trabajo</button>
          </div>
        </div>

        <div id="kpis-tec" class="kpi-grid" style="grid-template-columns:repeat(3,1fr)"></div>

        <div class="card" style="margin-bottom:18px">
          <div class="card-head"><div><h3>Ingresos — últimos 30 días</h3></div></div>
          <div class="chart-wrap"><canvas id="chart-tec-ing"></canvas></div>
        </div>

        <div class="card" style="padding:0">
          <div id="tabla-tec" style="overflow-x:auto"></div>
        </div>

        <div class="card" style="margin-top:18px;background:#fafbff;border-style:dashed">
          <div class="card-head"><div>
            <h3 style="color:#1e329c">🔌 Integración futura con tu programa</h3>
            <div class="sub">Los trabajos también podrán llegar automáticamente vía API desde el programa que cada técnico use.</div>
          </div></div>
          <div style="font-size:13.5px;color:#475569">
            Endpoint disponible: <code style="background:#fff;padding:2px 6px;border-radius:5px;border:1px solid #e3e7f1">POST /api/tech/logs</code>
            <br/>El registro creado tendrá <code>fuente="manual"</code>. Cuando lo conectes con tu programa, usa <code>fuente="api"</code> para distinguirlos.
          </div>
        </div>
      `;

      if (esAdmin) {
        try {
          tecnicos = await API.get('/api/users?role=tecnico');
          const sel = document.getElementById('t-tec');
          for (const t of tecnicos) sel.insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.nombre}</option>`);
        } catch (e) { /* skip */ }
      }
      document.getElementById('btn-filtrar').onclick = recargar;
      document.getElementById('btn-add').onclick = () => editar(null, user);
      recargar(user);
    }
  };

  async function recargar(user) {
    if (!user) user = window.ComTec.Auth.user();
    const sel = document.getElementById('t-tec');
    const tecId = sel ? sel.value : '';
    const desde = document.getElementById('t-desde').value;
    const hasta = document.getElementById('t-hasta').value;
    const params = new URLSearchParams();
    if (tecId) params.set('tecnicoId', tecId);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    try { logs = await API.get('/api/tech/logs' + (params.toString()?'?'+params:'')); render(user); }
    catch (e) { toast(e.message,'error'); }

    // KPIs + gráfico para usuario activo (técnico ve los suyos; admin agrega global)
    const targetId = user.role === 'tecnico' ? user.id : (tecId || null);
    if (targetId) {
      try {
        const r = await API.get('/api/tech/resumen/' + targetId);
        renderKpis(r);
        renderChart(r.porDia);
      } catch (e) { /* ignore */ }
    } else {
      renderKpisAgg();
      renderChartAgg();
    }
  }

  function renderKpis(r) {
    document.getElementById('kpis-tec').innerHTML = `
      <div class="kpi"><div class="icon brand">📋</div><div class="text"><small>Trabajos del mes</small><strong>${r.mes.trabajos}</strong></div></div>
      <div class="kpi"><div class="icon cyan">💰</div><div class="text"><small>Ingresos del mes</small><strong>${fmt.money(r.mes.ingresos)}</strong></div></div>
      <div class="kpi"><div class="icon success">📊</div><div class="text"><small>Ingresos histórico</small><strong>${fmt.money(r.total.ingresos)}</strong><div class="sub">${r.total.trabajos} trabajos</div></div></div>
    `;
  }

  function renderKpisAgg() {
    const totalMes = logs.filter(l => l.fecha.slice(0,7) === new Date().toISOString().slice(0,7));
    const ingresosMes = totalMes.reduce((s,l)=>s+l.monto,0);
    document.getElementById('kpis-tec').innerHTML = `
      <div class="kpi"><div class="icon brand">📋</div><div class="text"><small>Trabajos del mes</small><strong>${totalMes.length}</strong></div></div>
      <div class="kpi"><div class="icon cyan">💰</div><div class="text"><small>Ingresos del mes</small><strong>${fmt.money(ingresosMes)}</strong></div></div>
      <div class="kpi"><div class="icon success">📊</div><div class="text"><small>Histórico</small><strong>${logs.length}</strong><div class="sub">trabajos</div></div></div>
    `;
  }

  let chartInst;
  function renderChart(porDia) {
    if (chartInst) chartInst.destroy();
    const dias = ultimos(30);
    const map = Object.fromEntries(porDia.map(d=>[d.dia, d.ingresos]));
    chartInst = new Chart(document.getElementById('chart-tec-ing'), {
      type: 'bar',
      data: {
        labels: dias.map(d => new Date(d+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'})),
        datasets: [{ label:'Ingresos (S/)', data: dias.map(d=>map[d]||0), backgroundColor: 'rgba(30,50,156,.85)', borderRadius: 4 }]
      },
      options: { plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>'S/ '+v}}}, maintainAspectRatio:false }
    });
  }

  function renderChartAgg() {
    if (chartInst) chartInst.destroy();
    const dias = ultimos(30);
    const map = {};
    logs.forEach(l => { map[l.fecha] = (map[l.fecha]||0) + l.monto; });
    chartInst = new Chart(document.getElementById('chart-tec-ing'), {
      type: 'bar',
      data: {
        labels: dias.map(d => new Date(d+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'})),
        datasets: [{ label:'Ingresos (S/)', data: dias.map(d=>map[d]||0), backgroundColor: 'rgba(30,50,156,.85)', borderRadius: 4 }]
      },
      options: { plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>'S/ '+v}}}, maintainAspectRatio:false }
    });
  }

  function render(user) {
    const cont = document.getElementById('tabla-tec');
    if (!logs.length) { cont.innerHTML = '<div class="empty">Sin trabajos registrados</div>'; return; }
    const esAdmin = user.role === 'admin';
    cont.innerHTML = `
      <table class="table">
        <thead><tr><th>Fecha</th>${esAdmin?'<th>Técnico</th>':''}<th>Cliente</th><th>Equipo</th><th>Descripción</th><th class="num">Monto</th><th>Estado</th><th>Fuente</th><th></th></tr></thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td>${l.fecha}</td>
              ${esAdmin ? `<td>${l.tecnico_nombre}</td>` : ''}
              <td>${l.cliente||'—'}</td>
              <td>${l.equipo||'—'}</td>
              <td>${l.descripcion}</td>
              <td class="num"><strong>${fmt.money(l.monto)}</strong></td>
              <td><span class="pill ${l.estado==='cancelado'?'pill-danger':l.estado==='pendiente'?'pill-warn':'pill-success'}">${l.estado}</span></td>
              <td><span class="pill ${l.fuente==='api'?'pill-cyan':'pill-mute'}">${l.fuente}</span></td>
              <td>
                <button class="btn btn-ghost btn-icon" data-edit="${l.id}">Editar</button>
                ${esAdmin ? `<button class="btn btn-danger btn-icon" data-del="${l.id}">×</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    cont.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editar(b.dataset.edit, user));
    cont.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!window.ComTec.confirm('¿Eliminar este trabajo?')) return;
      try { await API.delete('/api/tech/logs/'+b.dataset.del); toast('Eliminado','success'); recargar(user); }
      catch (e) { toast(e.message,'error'); }
    });
  }

  function editar(id, user) {
    const cur = id ? logs.find(l => l.id == id) : {
      cliente:'', equipo:'', descripcion:'', monto:0, estado:'completado',
      fecha: new Date().toISOString().slice(0,10),
      tecnico_id: user.role==='tecnico' ? user.id : (tecnicos[0]?.id || user.id),
    };
    const opcionesTec = (tecnicos || []).map(t => `<option value="${t.id}" ${t.id===cur.tecnico_id?'selected':''}>${t.nombre}</option>`).join('');
    modal({
      title: id ? 'Editar trabajo' : 'Registrar trabajo',
      html: `
        <div class="form-grid">
          ${user.role === 'admin' && !id ? `<div><label class="field-lbl">Técnico</label><select id="t-id" class="select">${opcionesTec}</select></div>` : ''}
          <div class="form-row">
            <div><label class="field-lbl">Fecha</label><input id="t-fecha" class="input" type="date" value="${cur.fecha}"/></div>
            <div><label class="field-lbl">Estado</label>
              <select id="t-estado" class="select">
                <option value="completado" ${cur.estado==='completado'?'selected':''}>Completado</option>
                <option value="pendiente"  ${cur.estado==='pendiente'?'selected':''}>Pendiente</option>
                <option value="cancelado"  ${cur.estado==='cancelado'?'selected':''}>Cancelado</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div><label class="field-lbl">Cliente</label><input id="t-cli" class="input" value="${cur.cliente||''}"/></div>
            <div><label class="field-lbl">Equipo</label><input id="t-eq" class="input" value="${cur.equipo||''}"/></div>
          </div>
          <div><label class="field-lbl">Descripción del trabajo *</label><textarea id="t-desc" class="textarea" rows="3">${cur.descripcion||''}</textarea></div>
          <div><label class="field-lbl">Monto cobrado (S/)</label><input id="t-monto" class="input" type="number" step="0.01" value="${cur.monto||0}"/></div>
        </div>`,
      footer: `<button class="btn btn-ghost" id="btn-x">Cancelar</button><button class="btn btn-primary" id="btn-ok">Guardar</button>`,
      onMount: (wrap, close) => {
        wrap.querySelector('#btn-x').onclick = close;
        wrap.querySelector('#btn-ok').onclick = async () => {
          const data = {
            cliente: wrap.querySelector('#t-cli').value.trim() || null,
            equipo:  wrap.querySelector('#t-eq').value.trim() || null,
            descripcion: wrap.querySelector('#t-desc').value.trim(),
            monto: +wrap.querySelector('#t-monto').value || 0,
            estado: wrap.querySelector('#t-estado').value,
            fecha: wrap.querySelector('#t-fecha').value,
          };
          const tIdEl = wrap.querySelector('#t-id');
          if (tIdEl) data.tecnico_id = +tIdEl.value;
          if (!data.descripcion) return toast('La descripción es requerida','error');
          try {
            if (id) await API.put('/api/tech/logs/'+id, data);
            else    await API.post('/api/tech/logs', data);
            toast('Guardado','success'); close(); recargar(user);
          } catch (e) { toast(e.message,'error'); }
        };
      }
    });
  }

  function ultimos(n) {
    const out = []; const today = new Date();
    for (let i=n-1;i>=0;i--) { const d=new Date(today); d.setDate(today.getDate()-i); out.push(d.toISOString().slice(0,10)); }
    return out;
  }
})();
