// Panel: Resumen (KPIs + gráficos)
(function () {
  const { API, fmt, el } = window.ComTec;

  window.ComTec.panels.home = {
    async render(root, user) {
      root.innerHTML = `
        <div class="section-head">
          <div class="title">
            <h2>Hola, ${user.nombre.split(' ')[0]} 👋</h2>
            <p>Vista general del mes y actividad reciente</p>
          </div>
        </div>
        <div id="kpis" class="kpi-grid"></div>
        <div class="grid-2" style="margin-bottom:18px">
          <div class="card">
            <div class="card-head">
              <div><h3>Ventas — últimos 30 días</h3><div class="sub">Total por día (sin anuladas)</div></div>
            </div>
            <div class="chart-wrap"><canvas id="chart-ventas"></canvas></div>
          </div>
          <div class="card">
            <div class="card-head">
              <div><h3>Por categoría</h3><div class="sub">Mes en curso</div></div>
            </div>
            <div class="chart-wrap"><canvas id="chart-cat"></canvas></div>
          </div>
        </div>
        <div class="grid-1-1">
          <div class="card">
            <div class="card-head"><div><h3>Top vendedores del mes</h3></div></div>
            <div id="top-vend"></div>
          </div>
          <div class="card">
            <div class="card-head"><div><h3>Productos más vendidos (30d)</h3></div></div>
            <div id="top-prod"></div>
          </div>
        </div>
      `;

      let stats;
      try { stats = await API.get('/api/dashboard/stats'); }
      catch (e) { root.innerHTML = `<div class="card empty">No se pudo cargar: ${e.message}</div>`; return; }

      renderKpis(stats.kpis, user.role);
      renderVentasChart(stats.ventasPorDia);
      renderCategoriaChart(stats.ventasPorCategoria);
      renderTopVendedores(stats.topVendedores);
      renderTopProductos(stats.topProductos);
    },
  };

  function renderKpis(k, role) {
    const cont = document.getElementById('kpis');
    const cards = [
      { color: 'brand',   icon: '💰', titulo: 'Ventas hoy',         valor: fmt.money(k.montoHoy), sub: k.ventasHoy + ' ventas' },
      { color: 'cyan',    icon: '📅', titulo: 'Ventas del mes',     valor: fmt.money(k.montoMes), sub: k.ventasMes + ' ventas' },
      { color: 'success', icon: '📦', titulo: 'Productos activos',  valor: fmt.int(k.totalProductos), sub: (k.bajoStock || 0) + ' bajo stock' },
    ];
    if (role === 'admin' || role === 'tecnico') {
      cards.push({ color: 'warn', icon: '🛠', titulo: 'Ingresos técnicos (mes)', valor: fmt.money(k.ingresosTecMes), sub: '' });
    } else {
      cards.push({ color: 'warn', icon: '👥', titulo: 'Personal activo', valor: fmt.int(k.totalUsuarios), sub: '' });
    }
    cont.innerHTML = cards.map(c => `
      <div class="kpi">
        <div class="icon ${c.color}" style="font-size:22px">${c.icon}</div>
        <div class="text"><small>${c.titulo}</small><strong>${c.valor}</strong><div class="sub">${c.sub}</div></div>
      </div>
    `).join('');
  }

  function renderVentasChart(rows) {
    const dias = ultimos30Dias();
    const map = Object.fromEntries(rows.map(r => [r.dia, r.monto]));
    const data = dias.map(d => map[d] || 0);
    const labels = dias.map(d => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('es-PE', { day:'2-digit', month:'short' });
    });

    new Chart(document.getElementById('chart-ventas'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ventas (S/)',
          data,
          borderColor: '#1e329c',
          backgroundColor: ctx => {
            const c = ctx.chart.ctx;
            const grad = c.createLinearGradient(0, 0, 0, 250);
            grad.addColorStop(0, 'rgba(0,141,222,.4)');
            grad.addColorStop(1, 'rgba(0,141,222,0)');
            return grad;
          },
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#008dde',
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: '#94a3b8' } },
          y: { ticks: { color: '#94a3b8', callback: v => 'S/ ' + v }, grid: { color: '#e3e7f1' } },
        },
        maintainAspectRatio: false,
      }
    });
  }

  function renderCategoriaChart(rows) {
    if (!rows.length) {
      document.getElementById('chart-cat').replaceWith(emptyBox('Sin ventas este mes'));
      return;
    }
    new Chart(document.getElementById('chart-cat'), {
      type: 'doughnut',
      data: {
        labels: rows.map(r => capitalize(r.categoria)),
        datasets: [{
          data: rows.map(r => +r.monto.toFixed(2)),
          backgroundColor: ['#1e329c','#008dde','#3a4daf','#4cb3ec','#99dcf5','#5a6bbe'],
          borderWidth: 0,
        }]
      },
      options: {
        plugins: { legend: { position: 'right', labels: { color:'#475569', boxWidth: 12, padding: 12, font: { size: 12 } } } },
        cutout: '60%',
        maintainAspectRatio: false,
      }
    });
  }

  function renderTopVendedores(rows) {
    const cont = document.getElementById('top-vend');
    if (!rows.length) { cont.innerHTML = '<div class="empty">Sin datos este mes</div>'; return; }
    cont.innerHTML = `
      <table class="table">
        <thead><tr><th>Vendedor</th><th class="num">Ventas</th><th class="num">Monto</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td><span class="pill pill-${i===0?'brand':'mute'}" style="margin-right:8px">#${i+1}</span>${r.nombre}</td>
              <td class="num">${r.ventas}</td>
              <td class="num"><strong>${fmt.money(r.monto)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  function renderTopProductos(rows) {
    const cont = document.getElementById('top-prod');
    if (!rows.length) { cont.innerHTML = '<div class="empty">Sin ventas en los últimos 30 días</div>'; return; }
    cont.innerHTML = `
      <table class="table">
        <thead><tr><th>Producto</th><th class="num">Unid.</th><th class="num">Monto</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr><td>${r.nombre}<div style="font-size:11.5px;color:#94a3b8">${r.categoria}</div></td>
                <td class="num">${r.unidades}</td>
                <td class="num">${fmt.money(r.monto)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  function ultimos30Dias() {
    const out = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      out.push(d.toISOString().slice(0,10));
    }
    return out;
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function emptyBox(t) { const d = document.createElement('div'); d.className = 'empty'; d.textContent = t; return d; }
})();
