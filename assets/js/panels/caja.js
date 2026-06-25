// Panel: Cierre de caja — entrega diaria por tienda (efectivo, yape, tarjeta,
// transferencia) menos pagos a proveedor.
(function () {
  const { API, fmt, toast, modal } = window.ComTec;
  let cierres = [];
  let tiendas = [];

  window.ComTec.panels.caja = {
    async render(root, user) {
      const esAdmin = user.role === 'admin';
      root.innerHTML = `
        <div class="section-head">
          <div class="title"><h2>Cierre de caja</h2><p>${esAdmin ? 'Entregas diarias de todas las tiendas' : 'Registra la entrega del día de tu tienda'}</p></div>
          <div class="filters">
            <select id="c-tienda" class="select" style="width:180px"><option value="">Todas las tiendas</option></select>
            <input type="date" id="c-desde" class="input" style="width:150px"/>
            <input type="date" id="c-hasta" class="input" style="width:150px"/>
            <button class="btn btn-ghost" id="btn-filtrar">Filtrar</button>
            <button class="btn btn-primary" id="btn-add">+ Registrar cierre</button>
          </div>
        </div>

        <div id="kpis-caja" class="kpi-grid" style="grid-template-columns:repeat(4,1fr)"></div>
        <div class="card" style="margin-bottom:18px">
          <div class="card-head"><div><h3>Entregas de hoy por tienda</h3><div class="sub">Quién ya entregó y cuánto</div></div></div>
          <div id="caja-hoy" style="display:flex;flex-wrap:wrap;gap:10px;padding:4px 2px"></div>
        </div>

        <div class="card" style="padding:0">
          <div id="tabla-caja" style="overflow-x:auto"></div>
        </div>
      `;

      try {
        tiendas = await API.get('/api/tiendas');
        const sel = document.getElementById('c-tienda');
        for (const t of tiendas) sel.insertAdjacentHTML('beforeend', `<option value="${t.id}">${esc(t.nombre)}</option>`);
      } catch (e) { /* sin red */ }

      document.getElementById('btn-filtrar').onclick = () => recargar(user);
      document.getElementById('btn-add').onclick = () => editar(null, user);
      recargar(user);
    }
  };

  async function recargar(user) {
    const tiendaId = document.getElementById('c-tienda').value;
    const desde = document.getElementById('c-desde').value;
    const hasta = document.getElementById('c-hasta').value;
    const params = new URLSearchParams();
    if (tiendaId) params.set('tiendaId', tiendaId);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    try {
      cierres = await API.get('/api/caja' + (params.toString() ? '?'+params : ''));
      render(user);
    } catch (e) { toast(e.message, 'error'); }
    try { renderResumen(await API.get('/api/caja/resumen')); } catch (e) { /* ignore */ }
  }

  function renderResumen(r) {
    document.getElementById('kpis-caja').innerHTML = `
      <div class="kpi"><div class="icon success">💵</div><div class="text"><small>Entregado hoy</small><strong>${fmt.money(r.hoy.entregado)}</strong><div class="sub">${r.hoy.cierres} cierre(s)</div></div></div>
      <div class="kpi"><div class="icon brand">📥</div><div class="text"><small>Ingresos hoy</small><strong>${fmt.money(r.hoy.ingresos)}</strong></div></div>
      <div class="kpi"><div class="icon warn">📤</div><div class="text"><small>Pagos a proveedor hoy</small><strong>${fmt.money(r.hoy.egresos)}</strong></div></div>
      <div class="kpi"><div class="icon cyan">📊</div><div class="text"><small>Ingresos del mes</small><strong>${fmt.money(r.mesIngresos)}</strong></div></div>
    `;
    const cont = document.getElementById('caja-hoy');
    if (!r.porTiendaHoy.length) { cont.innerHTML = '<div class="empty">No hay tiendas activas</div>'; return; }
    cont.innerHTML = r.porTiendaHoy.map(t => {
      const entregado = t.cierre_id ? (t.ingresos - t.egresos) : 0;
      const ok = !!t.cierre_id;
      return `
        <div style="flex:1;min-width:180px;border:1px solid ${ok?'#bbf7d0':'#e3e7f1'};background:${ok?'#f0fdf4':'#fafbff'};border-radius:12px;padding:12px 14px">
          <div style="font-weight:700;color:#1e293b">${esc(t.tienda_nombre)}</div>
          ${ok
            ? `<div style="color:#16a34a;font-size:13px;margin-top:2px">✔ Entregó <strong>${fmt.money(entregado)}</strong></div>`
            : `<div style="color:#94a3b8;font-size:13px;margin-top:2px">⏳ Pendiente de entrega</div>`}
        </div>`;
    }).join('');
  }

  function render(user) {
    const esAdmin = user.role === 'admin';
    const cont = document.getElementById('tabla-caja');
    if (!cierres.length) { cont.innerHTML = '<div class="empty">Sin cierres registrados en este filtro</div>'; return; }
    cont.innerHTML = `
      <table class="table">
        <thead><tr>
          <th>Fecha</th><th>Tienda</th><th>Responsable</th>
          <th class="num">Efectivo</th><th class="num">Yape</th><th class="num">Tarjeta</th><th class="num">Transf.</th>
          <th class="num">Pago prov.</th><th class="num">A entregar</th><th></th>
        </tr></thead>
        <tbody>
          ${cierres.map(c => `
            <tr>
              <td>${c.fecha}</td>
              <td><strong>${esc(c.tienda_nombre)}</strong></td>
              <td>${esc(c.usuario_nombre)}</td>
              <td class="num">${fmt.money(c.efectivo)}</td>
              <td class="num">${fmt.money(c.yape)}</td>
              <td class="num">${fmt.money(c.tarjeta)}</td>
              <td class="num">${fmt.money(c.transferencia)}</td>
              <td class="num" style="color:#dc2626">${c.total_egresos ? '− '+fmt.money(c.total_egresos) : '—'}</td>
              <td class="num"><strong>${fmt.money(c.total_entregar)}</strong></td>
              <td>
                <button class="btn btn-ghost btn-icon" data-edit="${c.id}">Ver</button>
                ${esAdmin ? `<button class="btn btn-danger btn-icon" data-del="${c.id}">×</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    cont.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editar(b.dataset.edit, user));
    cont.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!window.ComTec.confirm('¿Eliminar este cierre de caja?')) return;
      try { await API.delete('/api/caja/'+b.dataset.del); toast('Eliminado','success'); recargar(user); }
      catch (e) { toast(e.message,'error'); }
    });
  }

  async function editar(id, user) {
    let cur = {
      tienda_id: tiendas[0] ? tiendas[0].id : '',
      fecha: new Date().toISOString().slice(0,10),
      efectivo:0, yape:0, tarjeta:0, transferencia:0,
      observaciones:'', estado:'entregado', egresos:[],
    };
    if (id) {
      try { cur = await API.get('/api/caja/'+id); }
      catch (e) { return toast(e.message,'error'); }
    }
    const opcTiendas = tiendas.map(t => `<option value="${t.id}" ${t.id==cur.tienda_id?'selected':''}>${esc(t.nombre)}</option>`).join('');

    modal({
      title: id ? 'Cierre de caja' : 'Registrar cierre de caja',
      html: `
        <div class="form-grid">
          <div class="form-row">
            <div><label class="field-lbl">Tienda *</label><select id="k-tienda" class="select">${opcTiendas}</select></div>
            <div><label class="field-lbl">Fecha</label><input id="k-fecha" class="input" type="date" value="${cur.fecha}"/></div>
          </div>
          <div class="form-row">
            <div><label class="field-lbl">Efectivo (S/)</label><input id="k-efe" class="input money-in" type="number" step="0.01" value="${cur.efectivo}"/></div>
            <div><label class="field-lbl">Yape (S/)</label><input id="k-yape" class="input money-in" type="number" step="0.01" value="${cur.yape}"/></div>
          </div>
          <div class="form-row">
            <div><label class="field-lbl">Tarjeta (S/)</label><input id="k-tar" class="input money-in" type="number" step="0.01" value="${cur.tarjeta}"/></div>
            <div><label class="field-lbl">Transferencia (S/)</label><input id="k-tra" class="input money-in" type="number" step="0.01" value="${cur.transferencia}"/></div>
          </div>

          <div style="border-top:1px dashed #e3e7f1;margin-top:6px;padding-top:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <label class="field-lbl" style="margin:0">Pagos a proveedor (se descuentan)</label>
              <button type="button" class="btn btn-ghost btn-icon" id="k-add-eg">+ Agregar pago</button>
            </div>
            <div id="k-egresos"></div>
          </div>

          <div><label class="field-lbl">Observaciones</label><textarea id="k-obs" class="textarea" rows="2">${esc(cur.observaciones)}</textarea></div>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600;color:#166534">Total a entregar</span>
            <strong id="k-total" style="font-size:20px;color:#166534">S/ 0.00</strong>
          </div>
        </div>`,
      footer: `<button class="btn btn-ghost" id="btn-x">Cancelar</button><button class="btn btn-primary" id="btn-ok">Guardar</button>`,
      onMount: (wrap, close) => {
        const egCont = wrap.querySelector('#k-egresos');

        function addEgreso(eg = {}) {
          const row = document.createElement('div');
          row.className = 'eg-row';
          row.style.cssText = 'display:grid;grid-template-columns:1.3fr 1.3fr 90px 32px;gap:8px;margin-bottom:8px;align-items:center';
          row.innerHTML = `
            <input class="input eg-concepto" placeholder="Concepto" value="${esc(eg.concepto)}"/>
            <input class="input eg-proveedor" placeholder="Proveedor" value="${esc(eg.proveedor)}"/>
            <input class="input eg-monto money-in" type="number" step="0.01" placeholder="0.00" value="${eg.monto != null ? eg.monto : ''}" style="text-align:right"/>
            <button type="button" class="btn btn-danger btn-icon eg-del" style="padding:6px 9px">×</button>`;
          egCont.appendChild(row);
          row.querySelector('.eg-del').onclick = () => { row.remove(); recalc(); };
          row.querySelector('.eg-monto').addEventListener('input', recalc);
          recalc();
        }

        function recalc() {
          const num = sel => +wrap.querySelector(sel).value || 0;
          const ingresos = num('#k-efe') + num('#k-yape') + num('#k-tar') + num('#k-tra');
          let egresos = 0;
          wrap.querySelectorAll('.eg-monto').forEach(i => egresos += +i.value || 0);
          wrap.querySelector('#k-total').textContent = fmt.money(ingresos - egresos);
        }

        wrap.querySelectorAll('#k-efe,#k-yape,#k-tar,#k-tra').forEach(i => i.addEventListener('input', recalc));
        wrap.querySelector('#k-add-eg').onclick = () => addEgreso();
        (cur.egresos || []).forEach(addEgreso);
        recalc();

        wrap.querySelector('#btn-x').onclick = close;
        wrap.querySelector('#btn-ok').onclick = async () => {
          const egresos = [];
          wrap.querySelectorAll('.eg-row').forEach(row => {
            const concepto = row.querySelector('.eg-concepto').value.trim();
            const monto = +row.querySelector('.eg-monto').value || 0;
            if (concepto && monto > 0) egresos.push({
              concepto, monto,
              proveedor: row.querySelector('.eg-proveedor').value.trim() || null,
            });
          });
          const data = {
            tienda_id: +wrap.querySelector('#k-tienda').value,
            fecha: wrap.querySelector('#k-fecha').value,
            efectivo: +wrap.querySelector('#k-efe').value || 0,
            yape: +wrap.querySelector('#k-yape').value || 0,
            tarjeta: +wrap.querySelector('#k-tar').value || 0,
            transferencia: +wrap.querySelector('#k-tra').value || 0,
            observaciones: wrap.querySelector('#k-obs').value.trim() || null,
            estado: cur.estado || 'entregado',
            egresos,
          };
          if (!data.tienda_id) return toast('Selecciona una tienda','error');
          try {
            if (id) await API.put('/api/caja/'+id, data);
            else    await API.post('/api/caja', data);
            toast('Cierre guardado','success'); close(); recargar(user);
          } catch (e) { toast(e.message,'error'); }
        };
      }
    });
  }

  function esc(s) { return s == null ? '' : String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
})();
