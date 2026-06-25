// Panel: Tiendas — gestión de sucursales (solo admin)
(function () {
  const { API, toast, modal } = window.ComTec;
  let tiendas = [];

  window.ComTec.panels.tiendas = {
    async render(root) {
      root.innerHTML = `
        <div class="section-head">
          <div class="title"><h2>Tiendas</h2><p>Sucursales del negocio. El nombre que pongas aquí se usa en el inventario y en el cierre de caja.</p></div>
          <div class="filters">
            <button class="btn btn-primary" id="btn-add">+ Nueva tienda</button>
          </div>
        </div>
        <div class="card" style="padding:0">
          <div id="tabla-tiendas" style="overflow-x:auto"></div>
        </div>
      `;
      document.getElementById('btn-add').onclick = () => editar(null);
      recargar();
    }
  };

  async function recargar() {
    try { tiendas = await API.get('/api/tiendas?todas=1'); render(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function render() {
    const cont = document.getElementById('tabla-tiendas');
    if (!tiendas.length) { cont.innerHTML = '<div class="empty">Aún no hay tiendas. Crea la primera.</div>'; return; }
    cont.innerHTML = `
      <table class="table">
        <thead><tr><th>Tienda</th><th>Dirección</th><th>Teléfono</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${tiendas.map(t => `
            <tr>
              <td><strong>${esc(t.nombre)}</strong></td>
              <td>${esc(t.direccion) || '—'}</td>
              <td>${esc(t.telefono) || '—'}</td>
              <td><span class="pill ${t.activo ? 'pill-success' : 'pill-mute'}">${t.activo ? 'Activa' : 'Inactiva'}</span></td>
              <td><button class="btn btn-ghost btn-icon" data-edit="${t.id}">Editar</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    cont.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editar(b.dataset.edit));
  }

  function editar(id) {
    const cur = id ? tiendas.find(t => t.id == id) : { nombre:'', direccion:'', telefono:'', activo:1 };
    modal({
      title: id ? 'Editar tienda' : 'Nueva tienda',
      html: `
        <div class="form-grid">
          <div><label class="field-lbl">Nombre de la tienda *</label><input id="t-nom" class="input" value="${esc(cur.nombre)}" placeholder="Ej: Tienda Centro"/></div>
          <div><label class="field-lbl">Dirección</label><input id="t-dir" class="input" value="${esc(cur.direccion)}"/></div>
          <div class="form-row">
            <div><label class="field-lbl">Teléfono</label><input id="t-tel" class="input" value="${esc(cur.telefono)}"/></div>
            <div><label class="field-lbl">Estado</label>
              <select id="t-act" class="select"><option value="1" ${cur.activo?'selected':''}>Activa</option><option value="0" ${!cur.activo?'selected':''}>Inactiva</option></select>
            </div>
          </div>
        </div>`,
      footer: `${id ? '<button class="btn btn-danger" id="btn-del">Desactivar</button>' : ''}<button class="btn btn-ghost" id="btn-x">Cancelar</button><button class="btn btn-primary" id="btn-ok">Guardar</button>`,
      onMount: (wrap, close) => {
        wrap.querySelector('#btn-x').onclick = close;
        const btnDel = wrap.querySelector('#btn-del');
        if (btnDel) btnDel.onclick = async () => {
          if (!window.ComTec.confirm('¿Desactivar esta tienda? No se borra el historial.')) return;
          try { await API.delete('/api/tiendas/'+id); toast('Tienda desactivada','success'); close(); recargar(); }
          catch (e) { toast(e.message,'error'); }
        };
        wrap.querySelector('#btn-ok').onclick = async () => {
          const data = {
            nombre: wrap.querySelector('#t-nom').value.trim(),
            direccion: wrap.querySelector('#t-dir').value.trim() || null,
            telefono: wrap.querySelector('#t-tel').value.trim() || null,
            activo: +wrap.querySelector('#t-act').value,
          };
          if (!data.nombre) return toast('El nombre es requerido','error');
          try {
            if (id) await API.put('/api/tiendas/'+id, data);
            else    await API.post('/api/tiendas', data);
            toast('Guardado','success'); close(); recargar();
          } catch (e) { toast(e.message,'error'); }
        };
      }
    });
  }

  function esc(s) { return s == null ? '' : String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
})();
