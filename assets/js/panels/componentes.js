// Panel: Componentes destacados (los que se muestran en index.html)
(function () {
  const { API, fmt, toast, modal } = window.ComTec;
  let items = [];
  let inventario = [];

  window.ComTec.panels.componentes = {
    async render(root, user) {
      root.innerHTML = `
        <div class="section-head">
          <div class="title"><h2>Componentes destacados</h2><p>Productos que aparecerán en la página principal</p></div>
          <div class="filters">
            <button class="btn btn-primary" id="btn-add">+ Destacar producto</button>
          </div>
        </div>
        <div class="card" style="padding:0">
          <div id="tabla-comp" style="overflow-x:auto"></div>
        </div>
      `;
      try {
        [items, inventario] = await Promise.all([
          API.get('/api/components'),
          API.get('/api/inventory'),
        ]);
        render();
      } catch (e) { toast(e.message,'error'); }
      document.getElementById('btn-add').onclick = () => editar(null);
    }
  };

  function render() {
    const cont = document.getElementById('tabla-comp');
    if (!items.length) { cont.innerHTML = '<div class="empty">Aún no hay componentes destacados</div>'; return; }
    items.sort((a,b)=>a.orden-b.orden);
    cont.innerHTML = `
      <table class="table">
        <thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th class="num">Precio</th><th>Etiqueta</th><th></th></tr></thead>
        <tbody>
          ${items.map(c => `
            <tr>
              <td><strong>${c.orden}</strong></td>
              <td>${c.nombre}<div style="font-size:11.5px;color:#94a3b8">${c.sku||''}</div></td>
              <td><span class="pill pill-mute">${c.categoria||''}</span></td>
              <td class="num">${fmt.money(c.precio_venta)}</td>
              <td>${c.etiqueta ? '<span class="pill pill-cyan">'+c.etiqueta+'</span>' : '—'}</td>
              <td>
                <button class="btn btn-ghost btn-icon" data-edit="${c.id}">Editar</button>
                <button class="btn btn-danger btn-icon" data-del="${c.id}">Quitar</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    cont.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editar(b.dataset.edit));
    cont.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!window.ComTec.confirm('¿Quitar de destacados?')) return;
      try { await API.delete('/api/components/' + b.dataset.del); toast('Quitado','success'); window.ComTec.panels.componentes.render(document.getElementById('content')); }
      catch (e) { toast(e.message,'error'); }
    });
  }

  function editar(id) {
    const cur = id ? items.find(x => x.id == id) : { inventory_id:'', orden: items.length, etiqueta:'', destacado:0 };
    const opts = inventario.map(p => `<option value="${p.id}" ${p.id===cur.inventory_id?'selected':''}>${p.nombre}</option>`).join('');
    modal({
      title: id ? 'Editar destacado' : 'Destacar producto',
      html: `
        <div class="form-grid">
          ${!id ? `<div><label class="field-lbl">Producto *</label><select id="c-inv" class="select">${opts}</select></div>` : ''}
          <div class="form-row">
            <div><label class="field-lbl">Orden</label><input id="c-ord" class="input" type="number" value="${cur.orden||0}"/></div>
            <div><label class="field-lbl">Etiqueta (opcional)</label><input id="c-et" class="input" value="${cur.etiqueta||''}" placeholder="OFERTA, NUEVO…"/></div>
          </div>
          <div>
            <label class="check"><input type="checkbox" id="c-dest" ${cur.destacado?'checked':''}/> <span>Mostrar como destacado especial</span></label>
          </div>
        </div>`,
      footer: `<button class="btn btn-ghost" id="btn-x">Cancelar</button><button class="btn btn-primary" id="btn-ok">Guardar</button>`,
      onMount: (wrap, close) => {
        wrap.querySelector('#btn-x').onclick = close;
        wrap.querySelector('#btn-ok').onclick = async () => {
          const data = {
            orden: +wrap.querySelector('#c-ord').value || 0,
            etiqueta: wrap.querySelector('#c-et').value.trim() || null,
            destacado: wrap.querySelector('#c-dest').checked ? 1 : 0,
          };
          try {
            if (id) await API.put('/api/components/'+id, data);
            else {
              data.inventory_id = +wrap.querySelector('#c-inv').value;
              await API.post('/api/components', data);
            }
            toast('Guardado','success');
            close();
            window.ComTec.panels.componentes.render(document.getElementById('content'));
          } catch (e) { toast(e.message,'error'); }
        };
      }
    });
  }
})();
