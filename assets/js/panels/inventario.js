// Panel: Inventario
(function () {
  const { API, fmt, toast, modal } = window.ComTec;
  let items = [];
  let tiendas = [];
  let categoriaSel = '';
  let tiendaSel = '';
  let qFiltro = '';

  window.ComTec.panels.inventario = {
    async render(root, user) {
      const esAdmin = user.role === 'admin';
      root.innerHTML = `
        <div class="section-head">
          <div class="title"><h2>Inventario</h2><p>Productos disponibles en tienda</p></div>
          <div class="filters">
            <input id="inv-q" class="input" placeholder="Buscar por nombre, SKU o marca…" style="width:260px"/>
            <select id="inv-cat" class="select" style="width:160px"><option value="">Todas categorías</option></select>
            ${esAdmin ? '<select id="inv-tienda" class="select" style="width:160px"><option value="">Todas las tiendas</option><option value="sin">Sin asignar</option></select>' : ''}
            ${esAdmin ? '<button class="btn btn-primary" id="btn-nuevo">+ Nuevo producto</button>' : ''}
          </div>
        </div>
        <div class="card" style="padding:0">
          <div id="tabla-inv" style="overflow-x:auto"></div>
        </div>
      `;
      try {
        const cats = await API.get('/api/inventory/categorias');
        const sel = document.getElementById('inv-cat');
        for (const c of cats) sel.insertAdjacentHTML('beforeend', `<option value="${c.categoria}">${capit(c.categoria)} (${c.total})</option>`);
        sel.onchange = () => { categoriaSel = sel.value; recargar(); };
      } catch (e) { /* sin red */ }
      if (esAdmin) {
        try {
          tiendas = await API.get('/api/tiendas');
          const selT = document.getElementById('inv-tienda');
          for (const t of tiendas) selT.insertAdjacentHTML('beforeend', `<option value="${t.id}">${esc(t.nombre)}</option>`);
          selT.onchange = () => { tiendaSel = selT.value; recargar(); };
        } catch (e) { /* sin red */ }
      }
      document.getElementById('inv-q').addEventListener('input', e => { qFiltro = e.target.value; render(); });
      const btnNuevo = document.getElementById('btn-nuevo');
      if (btnNuevo) btnNuevo.onclick = () => editar(null);
      recargar();
    }
  };

  async function recargar() {
    const params = new URLSearchParams();
    if (categoriaSel) params.set('categoria', categoriaSel);
    if (tiendaSel) params.set('tiendaId', tiendaSel);
    try { items = await API.get('/api/inventory' + (params.toString() ? '?'+params : '')); render(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function render() {
    const cont = document.getElementById('tabla-inv');
    const filtrados = !qFiltro ? items : items.filter(i =>
      (i.nombre||'').toLowerCase().includes(qFiltro.toLowerCase()) ||
      (i.sku||'').toLowerCase().includes(qFiltro.toLowerCase()) ||
      (i.marca||'').toLowerCase().includes(qFiltro.toLowerCase()));
    if (!filtrados.length) { cont.innerHTML = '<div class="empty">Sin productos</div>'; return; }
    const user = window.ComTec.Auth.user();
    cont.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>SKU</th><th>Producto</th><th>Categoría</th><th>Marca</th>
            ${user.role==='admin'?'<th>Tienda</th>':''}
            <th class="num">Precio</th><th class="num">Stock</th><th>Estado</th>
            ${user.role==='admin'?'<th></th>':''}
          </tr>
        </thead>
        <tbody>
          ${filtrados.map(i => `
            <tr>
              <td><code style="font-size:12px;color:#475569">${i.sku||'—'}</code></td>
              <td><strong>${i.nombre}</strong></td>
              <td><span class="pill pill-mute">${capit(i.categoria)}</span></td>
              <td>${i.marca||'—'}</td>
              ${user.role==='admin' ? `<td>${i.tienda_nombre ? '<span class="pill pill-cyan">'+esc(i.tienda_nombre)+'</span>' : '<span style="color:#cbd5e1;font-size:12px">— sin asignar —</span>'}</td>` : ''}
              <td class="num"><strong>${fmt.money(i.precio_venta)}</strong></td>
              <td class="num">${i.stock} <span style="color:#94a3b8;font-size:11px">/ min ${i.stock_min}</span></td>
              <td>${stockPill(i)}</td>
              ${user.role==='admin' ? `<td><button class="btn btn-ghost btn-icon" data-edit="${i.id}">Editar</button></td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>`;
    cont.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editar(b.dataset.edit));
  }

  function stockPill(i) {
    if (!i.activo) return '<span class="pill pill-mute">Inactivo</span>';
    if (i.stock === 0) return '<span class="pill pill-danger">Agotado</span>';
    if (i.stock <= i.stock_min) return '<span class="pill pill-warn">Bajo stock</span>';
    return '<span class="pill pill-success">En stock</span>';
  }

  function capit(s) { return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }
  function esc(s) { return s == null ? '' : String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  async function editar(id) {
    let it = { sku:'', nombre:'', categoria:'laptops', marca:'', descripcion:'', precio_compra:0, precio_venta:0, stock:0, stock_min:1, imagen_url:'', activo:1 };
    if (id) { try { it = await API.get('/api/inventory/' + id); } catch (e) { toast(e.message,'error'); return; } }
    const cats = ['laptops','desktops','impresoras','monitores','componentes','accesorios'];
    modal({
      title: id ? 'Editar producto' : 'Nuevo producto',
      html: `
        <div class="form-grid">
          <div class="form-row">
            <div><label class="field-lbl">SKU</label><input id="i-sku" class="input" value="${it.sku||''}"/></div>
            <div><label class="field-lbl">Categoría *</label>
              <select id="i-cat" class="select">${cats.map(c => `<option value="${c}" ${c===it.categoria?'selected':''}>${capit(c)}</option>`).join('')}</select>
            </div>
          </div>
          <div><label class="field-lbl">Nombre *</label><input id="i-nom" class="input" value="${(it.nombre||'').replace(/"/g,'&quot;')}"/></div>
          <div class="form-row">
            <div><label class="field-lbl">Marca</label><input id="i-mar" class="input" value="${it.marca||''}"/></div>
            <div><label class="field-lbl">Imagen (URL)</label><input id="i-img" class="input" value="${it.imagen_url||''}"/></div>
          </div>
          <div><label class="field-lbl">Descripción</label><textarea id="i-des" class="textarea" rows="2">${it.descripcion||''}</textarea></div>
          <div class="form-row three">
            <div><label class="field-lbl">P. compra</label><input id="i-pc" class="input" type="number" step="0.01" value="${it.precio_compra}"/></div>
            <div><label class="field-lbl">P. venta *</label><input id="i-pv" class="input" type="number" step="0.01" value="${it.precio_venta}"/></div>
            <div><label class="field-lbl">Stock</label><input id="i-st" class="input" type="number" value="${it.stock}"/></div>
          </div>
          <div class="form-row three">
            <div><label class="field-lbl">Stock mínimo</label><input id="i-sm" class="input" type="number" value="${it.stock_min}"/></div>
            <div><label class="field-lbl">Tienda</label>
              <select id="i-tienda" class="select"><option value="">Sin asignar</option>${tiendas.map(t => `<option value="${t.id}" ${t.id==it.tienda_id?'selected':''}>${esc(t.nombre)}</option>`).join('')}</select>
            </div>
            <div><label class="field-lbl">Estado</label>
              <select id="i-ac" class="select"><option value="1" ${it.activo?'selected':''}>Activo</option><option value="0" ${!it.activo?'selected':''}>Inactivo</option></select>
            </div>
          </div>
        </div>
      `,
      footer: `${id ? '<button class="btn btn-danger" id="btn-del">Eliminar</button>' : ''}<button class="btn btn-ghost" id="btn-x">Cancelar</button><button class="btn btn-primary" id="btn-ok">Guardar</button>`,
      onMount: (wrap, close) => {
        wrap.querySelector('#btn-x').onclick = close;
        const btnDel = wrap.querySelector('#btn-del');
        if (btnDel) btnDel.onclick = async () => {
          if (!window.ComTec.confirm('¿Desactivar este producto?')) return;
          try { await API.delete('/api/inventory/'+id); toast('Producto desactivado','success'); close(); recargar(); }
          catch (e) { toast(e.message,'error'); }
        };
        wrap.querySelector('#btn-ok').onclick = async () => {
          const data = {
            sku: wrap.querySelector('#i-sku').value.trim() || null,
            nombre: wrap.querySelector('#i-nom').value.trim(),
            categoria: wrap.querySelector('#i-cat').value,
            marca: wrap.querySelector('#i-mar').value.trim() || null,
            imagen_url: wrap.querySelector('#i-img').value.trim() || null,
            descripcion: wrap.querySelector('#i-des').value.trim() || null,
            precio_compra: +wrap.querySelector('#i-pc').value || 0,
            precio_venta: +wrap.querySelector('#i-pv').value || 0,
            stock: +wrap.querySelector('#i-st').value || 0,
            stock_min: +wrap.querySelector('#i-sm').value || 1,
            tienda_id: wrap.querySelector('#i-tienda').value ? +wrap.querySelector('#i-tienda').value : null,
            activo: +wrap.querySelector('#i-ac').value,
          };
          if (!data.nombre) return toast('Falta el nombre','error');
          try {
            if (id) await API.put('/api/inventory/'+id, data);
            else await API.post('/api/inventory', data);
            toast('Guardado','success'); close(); recargar();
          } catch (e) { toast(e.message,'error'); }
        };
      }
    });
  }
})();
