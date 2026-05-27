// Panel: Ventas — lista + nueva venta + detalle
(function () {
  const { API, fmt, toast, modal } = window.ComTec;
  let ventas = [];

  window.ComTec.panels.ventas = {
    async render(root, user) {
      root.innerHTML = `
        <div class="section-head">
          <div class="title"><h2>Ventas</h2><p>${user.role === 'vendedor' ? 'Tus ventas registradas' : 'Todas las ventas'}</p></div>
          <div class="filters">
            <input id="ventas-q" class="input" placeholder="Buscar cliente o boleta…" style="width:240px"/>
            <input type="date" id="ventas-desde" class="input" style="width:160px"/>
            <input type="date" id="ventas-hasta" class="input" style="width:160px"/>
            <button class="btn btn-ghost" id="btn-filtrar">Filtrar</button>
            <button class="btn btn-primary" id="btn-nueva">+ Nueva venta</button>
          </div>
        </div>
        <div class="card" style="padding:0">
          <div id="tabla-ventas" style="overflow-x:auto"></div>
        </div>
      `;

      document.getElementById('btn-nueva').onclick = () => abrirNuevaVenta(user, () => recargar());
      document.getElementById('btn-filtrar').onclick = recargar;
      document.getElementById('ventas-q').addEventListener('input', filtrar);
      recargar();
    },
  };

  async function recargar() {
    const desde = document.getElementById('ventas-desde').value;
    const hasta = document.getElementById('ventas-hasta').value;
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    try {
      ventas = await API.get('/api/sales' + (params.toString() ? '?' + params : ''));
      filtrar();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  }

  function filtrar() {
    const q = (document.getElementById('ventas-q').value || '').toLowerCase();
    const filtradas = !q ? ventas : ventas.filter(v =>
      (v.cliente_nombre || '').toLowerCase().includes(q) ||
      (v.boleta_numero || '').toLowerCase().includes(q));
    render(filtradas);
  }

  function render(rows) {
    const cont = document.getElementById('tabla-ventas');
    if (!rows.length) { cont.innerHTML = '<div class="empty">No hay ventas que mostrar</div>'; return; }
    cont.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Boleta</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th>Método</th>
            <th class="num">Total</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(v => `
            <tr>
              <td><strong>${v.boleta_numero}</strong></td>
              <td>${fmt.date(v.fecha)}</td>
              <td>${v.cliente_nombre}${v.cliente_dni ? ' <span style="color:#94a3b8">· '+v.cliente_dni+'</span>' : ''}</td>
              <td>${v.vendedor_nombre}</td>
              <td><span class="pill pill-mute">${v.metodo_pago}</span></td>
              <td class="num"><strong>${fmt.money(v.total)}</strong></td>
              <td><span class="pill ${v.estado==='anulada'?'pill-danger':'pill-success'}">${v.estado}</span></td>
              <td><button class="btn btn-ghost btn-icon" data-detalle="${v.id}">Ver</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    cont.querySelectorAll('[data-detalle]').forEach(b => b.onclick = () => abrirDetalle(b.dataset.detalle));
  }

  async function abrirDetalle(id) {
    let sale;
    try { sale = await API.get('/api/sales/' + id); }
    catch (e) { toast(e.message, 'error'); return; }
    const items = sale.items.map(i => `
      <tr><td>${i.descripcion}</td><td class="num">${i.cantidad}</td><td class="num">${fmt.money(i.precio_unit)}</td><td class="num">${fmt.money(i.subtotal)}</td></tr>
    `).join('');
    const user = window.ComTec.Auth.user();
    const puedeAnular = user.role === 'admin' && sale.estado !== 'anulada';
    modal({
      title: `Boleta ${sale.boleta_numero}`,
      html: `
        <div class="form-grid">
          <div><strong>Cliente:</strong> ${sale.cliente_nombre} ${sale.cliente_dni ? '· '+sale.cliente_dni : ''}</div>
          <div><strong>Fecha:</strong> ${fmt.date(sale.fecha)}</div>
          <div><strong>Vendedor:</strong> ${sale.vendedor_nombre}</div>
          <div><strong>Método:</strong> ${sale.metodo_pago}</div>
          <hr style="border:none;border-top:1px solid #e3e7f1"/>
          <table class="table"><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">P.U.</th><th class="num">Subt.</th></tr></thead><tbody>${items}</tbody></table>
          <div class="items-total"><span>Subtotal</span><span>${fmt.money(sale.subtotal)}</span></div>
          <div class="items-total"><span>IGV (18%)</span><span>${fmt.money(sale.igv)}</span></div>
          <div class="items-total total"><span>Total</span><span>${fmt.money(sale.total)}</span></div>
        </div>`,
      footer: puedeAnular
        ? `<button class="btn btn-danger" id="btn-anular">Anular venta</button><button class="btn btn-primary" id="btn-cerrar">Cerrar</button>`
        : `<button class="btn btn-primary" id="btn-cerrar">Cerrar</button>`,
      onMount: (wrap, close) => {
        wrap.querySelector('#btn-cerrar').onclick = close;
        const btnA = wrap.querySelector('#btn-anular');
        if (btnA) btnA.onclick = async () => {
          if (!window.ComTec.confirm('¿Anular esta venta? Se devolverá el stock.')) return;
          try { await API.post('/api/sales/' + id + '/anular'); toast('Venta anulada', 'success'); close(); recargar(); }
          catch (e) { toast(e.message, 'error'); }
        };
      }
    });
  }

  async function abrirNuevaVenta(user, onSaved) {
    let inventario = [];
    try { inventario = await API.get('/api/inventory'); }
    catch (e) { toast(e.message, 'error'); return; }

    let items = [{ inventory_id: '', descripcion: '', cantidad: 1, precio_unit: 0 }];

    const html = `
      <div class="form-grid">
        <div class="form-row">
          <div><label class="field-lbl">Cliente *</label><input id="f-cli" class="input" required/></div>
          <div><label class="field-lbl">DNI / RUC</label><input id="f-dni" class="input"/></div>
        </div>
        <div class="form-row">
          <div><label class="field-lbl">Teléfono</label><input id="f-tel" class="input"/></div>
          <div><label class="field-lbl">Método de pago</label>
            <select id="f-met" class="select">
              <option value="efectivo">Efectivo</option><option value="yape">Yape</option><option value="plin">Plin</option>
              <option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
            </select>
          </div>
        </div>
        <div>
          <label class="field-lbl">Productos</label>
          <div id="items-list" class="items-builder"></div>
          <button class="btn btn-ghost" type="button" id="btn-add-item" style="margin-top:8px">+ Agregar producto</button>
        </div>
        <div>
          <div class="items-total"><span>Subtotal</span><span id="t-sub">S/ 0.00</span></div>
          <div class="items-total"><span>IGV (18%)</span><span id="t-igv">S/ 0.00</span></div>
          <div class="items-total total"><span>Total</span><span id="t-total">S/ 0.00</span></div>
        </div>
        <div><label class="field-lbl">Notas</label><textarea id="f-notas" class="textarea" rows="2"></textarea></div>
      </div>`;

    const opcionesInv = inventario
      .map(i => `<option value="${i.id}" data-precio="${i.precio_venta}" data-stock="${i.stock}">${i.nombre} — S/ ${i.precio_venta} (stock: ${i.stock})</option>`)
      .join('');

    modal({
      title: 'Nueva venta',
      html,
      footer: `<button class="btn btn-ghost" id="btn-cancelar">Cancelar</button><button class="btn btn-primary" id="btn-guardar">Registrar venta</button>`,
      onMount: (wrap, close) => {
        function dibujarItems() {
          const c = wrap.querySelector('#items-list');
          c.innerHTML = items.map((it, idx) => `
            <div class="item-row">
              <select class="select" data-idx="${idx}" data-k="inventory_id">
                <option value="">— Producto / servicio libre —</option>
                ${opcionesInv}
              </select>
              <input class="input" type="number" min="1" value="${it.cantidad}" data-idx="${idx}" data-k="cantidad"/>
              <input class="input" type="number" min="0" step="0.01" value="${it.precio_unit}" data-idx="${idx}" data-k="precio_unit" placeholder="P.U."/>
              <div class="num-cell">${fmt.money((it.precio_unit||0)*(it.cantidad||0))}</div>
              <button class="btn-x" data-rm="${idx}" title="Quitar">×</button>
            </div>
          `).join('');
          // Aplicar valores actuales seleccionados
          c.querySelectorAll('select[data-k="inventory_id"]').forEach((s) => {
            const idx = +s.dataset.idx;
            s.value = items[idx].inventory_id || '';
          });
          c.querySelectorAll('input,select').forEach(inp => inp.addEventListener('input', e => onItemChange(e)));
          c.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { items.splice(+b.dataset.rm, 1); if (!items.length) items.push({}); dibujarItems(); recalcTotal(); });
          recalcTotal();
        }
        function onItemChange(e) {
          const idx = +e.target.dataset.idx;
          const k = e.target.dataset.k;
          let v = e.target.value;
          if (k === 'inventory_id') {
            items[idx].inventory_id = v ? +v : null;
            const opt = e.target.selectedOptions[0];
            const precio = opt ? +opt.dataset.precio || 0 : 0;
            if (v) {
              items[idx].precio_unit = precio;
              items[idx].descripcion = opt.textContent.split(' — ')[0];
            }
            dibujarItems();
            return;
          }
          if (k === 'cantidad') items[idx].cantidad = Math.max(1, +v || 1);
          if (k === 'precio_unit') items[idx].precio_unit = Math.max(0, +v || 0);
          recalcTotal();
        }
        function recalcTotal() {
          let sub = 0;
          items.forEach(it => { sub += (+it.precio_unit || 0) * (+it.cantidad || 0); });
          const igv = sub * 0.18;
          const total = sub + igv;
          wrap.querySelector('#t-sub').textContent = fmt.money(sub);
          wrap.querySelector('#t-igv').textContent = fmt.money(igv);
          wrap.querySelector('#t-total').textContent = fmt.money(total);
          // refrescar subtotales de cada item
          wrap.querySelectorAll('.item-row').forEach((row, idx) => {
            row.querySelector('.num-cell').textContent = fmt.money((items[idx].precio_unit||0)*(items[idx].cantidad||0));
          });
        }

        dibujarItems();
        wrap.querySelector('#btn-add-item').onclick = () => { items.push({ inventory_id:'', descripcion:'', cantidad:1, precio_unit:0 }); dibujarItems(); };
        wrap.querySelector('#btn-cancelar').onclick = close;
        wrap.querySelector('#btn-guardar').onclick = async () => {
          const cliente_nombre = wrap.querySelector('#f-cli').value.trim();
          if (!cliente_nombre) return toast('Falta nombre del cliente', 'error');
          const itemsOk = items.filter(it => (+it.cantidad > 0) && (+it.precio_unit > 0));
          if (!itemsOk.length) return toast('Agrega al menos un producto con precio', 'error');
          try {
            const res = await API.post('/api/sales', {
              cliente_nombre,
              cliente_dni: wrap.querySelector('#f-dni').value.trim() || null,
              cliente_tel: wrap.querySelector('#f-tel').value.trim() || null,
              metodo_pago: wrap.querySelector('#f-met').value,
              notas: wrap.querySelector('#f-notas').value.trim() || null,
              items: itemsOk,
            });
            toast('Venta registrada: ' + res.boleta, 'success');
            close();
            onSaved && onSaved();
          } catch (e) { toast(e.message, 'error'); }
        };
      }
    });
  }
})();
