/* ============================================================
   ComTec — Generador del grid de catálogo
   Inyecta tarjetas de producto en #catalogGrid
   ============================================================ */
(() => {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  const products = [
    {
      cat: 'Laptops', brand: 'Lenovo', name: 'Lenovo IdeaPad Gaming 3',
      specs: 'Ryzen 7 · 16GB · RTX 4050 · SSD 512GB',
      price: 'S/ 4,299', old: 'S/ 4,899', badge: 'oferta', badgeText: '-15%',
      img: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 124,
    },
    {
      cat: 'Laptops', brand: 'Apple', name: 'MacBook Air M3 13"',
      specs: 'Apple M3 · 8GB · SSD 256GB · macOS',
      price: 'S/ 5,499', badge: 'top', badgeText: 'Top ventas',
      img: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 89,
    },
    {
      cat: 'Desktops', brand: 'HP', name: 'HP Pavilion AIO 24"',
      specs: 'Core i5 · 8GB · SSD 256GB · 23.8" FHD',
      price: 'S/ 3,099', badge: 'nuevo', badgeText: 'Nuevo',
      img: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=600&q=80',
      stars: 4, reviews: 42,
    },
    {
      cat: 'Laptops', brand: 'Asus', name: 'Asus ROG Strix G16',
      specs: 'i7-13650HX · 16GB · RTX 4060 · 165Hz',
      price: 'S/ 6,799', old: 'S/ 7,299', badge: 'gamer', badgeText: 'Gamer',
      img: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 67,
    },
    {
      cat: 'Monitores', brand: 'Samsung', name: 'Samsung Curvo 27" QHD',
      specs: 'QHD · 165Hz · 1ms · FreeSync',
      price: 'S/ 1,199', badge: 'stock', badgeText: 'En stock',
      img: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 231,
    },
    {
      cat: 'Impresoras', brand: 'Epson', name: 'Epson EcoTank L3250',
      specs: 'Multifuncional · WiFi · Sistema continuo',
      price: 'S/ 849', old: 'S/ 949', badge: 'oferta', badgeText: '-10%',
      img: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=600&q=80',
      stars: 4, reviews: 312,
    },
    {
      cat: 'Desktops', brand: 'ComTec', name: 'PC Gamer ComTec CT-Pro',
      specs: 'Ryzen 5 7600 · 16GB DDR5 · RTX 4060',
      price: 'S/ 5,899', badge: 'gamer', badgeText: 'Build',
      img: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 78,
    },
    {
      cat: 'Impresoras', brand: 'Canon', name: 'Canon Pixma G3170',
      specs: 'Multifuncional · WiFi · Tanque de tinta',
      price: 'S/ 799', badge: 'stock', badgeText: 'En stock',
      img: 'https://images.unsplash.com/photo-1612815292258-f4354e07e2d4?auto=format&fit=crop&w=600&q=80',
      stars: 4, reviews: 98,
    },
    {
      cat: 'Componentes', brand: 'Intel', name: 'Intel Core i5-13400F',
      specs: '10 núcleos · 16 hilos · 4.6 GHz Turbo',
      price: 'S/ 749',
      img: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 156,
    },
    {
      cat: 'Componentes', brand: 'Kingston', name: 'Kingston Fury 16GB DDR5',
      specs: '5200 MHz · CL40 · Heatspreader',
      price: 'S/ 299',
      img: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 89,
    },
    {
      cat: 'Componentes', brand: 'Nvidia', name: 'Nvidia RTX 4060 8GB',
      specs: 'Asus Dual · DLSS 3 · Ray Tracing',
      price: 'S/ 1,499', badge: 'gamer', badgeText: 'Gamer',
      img: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 134,
    },
    {
      cat: 'Componentes', brand: 'Samsung', name: 'Samsung 980 Pro 1TB',
      specs: 'PCIe 4.0 · 7000 MB/s lectura',
      price: 'S/ 449',
      img: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 212,
    },
    {
      cat: 'Laptops', brand: 'HP', name: 'HP Pavilion 15"',
      specs: 'Core i5-1335U · 16GB · SSD 512GB',
      price: 'S/ 3,499',
      img: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80',
      stars: 4, reviews: 56,
    },
    {
      cat: 'Laptops', brand: 'Dell', name: 'Dell Inspiron 15',
      specs: 'Core i7-1355U · 16GB · SSD 1TB',
      price: 'S/ 4,099',
      img: 'https://images.unsplash.com/photo-1611186871348-b1ce6e998f13?auto=format&fit=crop&w=600&q=80',
      stars: 4, reviews: 72,
    },
    {
      cat: 'Accesorios', brand: 'Logitech', name: 'Teclado Mecánico G Pro',
      specs: 'Switches GX · RGB · USB-C',
      price: 'S/ 549', badge: 'top', badgeText: 'Top',
      img: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 187,
    },
    {
      cat: 'Accesorios', brand: 'Logitech', name: 'Mouse Gamer G502 Hero',
      specs: '25K DPI · 11 botones · RGB',
      price: 'S/ 299',
      img: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80',
      stars: 5, reviews: 421,
    },
  ];

  // Iconos SVG
  const cartIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>`;
  const heartIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

  function starsHTML(n, reviews) {
    const full = '★'.repeat(n);
    const empty = '☆'.repeat(5 - n);
    return `${full}${empty} <span style="color:var(--plomo-400); font-weight:600;">(${reviews})</span>`;
  }

  function cardHTML(p) {
    return `
      <article class="product-card">
        <div class="img-wrap">
          <img src="${p.img}" alt="${p.name}" loading="lazy" />
          ${p.badge ? `<span class="badge badge-${p.badge}">${p.badgeText}</span>` : ''}
          <button class="wish" aria-label="Favorito">${heartIcon}</button>
        </div>
        <div class="body">
          <span class="cat">${p.cat}</span>
          <h3>${p.name}</h3>
          <div class="stars">${starsHTML(p.stars, p.reviews)}</div>
          <p class="specs">${p.specs}</p>
          <div class="price-row">
            <div class="price">
              ${p.old ? `<span class="old">${p.old}</span>` : ''}
              <span class="new">${p.price}</span>
            </div>
            <a href="#" class="buy" aria-label="Comprar">${cartIcon}</a>
          </div>
        </div>
      </article>
    `;
  }

  // ---------- Filtrado por URL ?cat=laptops ----------
  const params = new URLSearchParams(window.location.search);
  const filterCat = params.get('cat');
  const catMap = {
    laptops: 'Laptops',
    desktops: 'Desktops',
    impresoras: 'Impresoras',
    monitores: 'Monitores',
    componentes: 'Componentes',
    accesorios: 'Accesorios',
  };

  let list = products;
  if (filterCat && catMap[filterCat]) {
    list = products.filter((p) => p.cat === catMap[filterCat]);
    // Marcar el checkbox correspondiente
    const cb = document.querySelector(`input[data-filter="cat"][value="${catMap[filterCat]}"]`);
    if (cb) {
      document.querySelectorAll('input[data-filter="cat"]').forEach((el) => (el.checked = false));
      cb.checked = true;
    }
    // Actualizar título y contador
    const title = document.querySelector('h1.section-title');
    if (title) title.textContent = catMap[filterCat];
    const results = document.querySelector('.catalog-toolbar .results');
    if (results) results.innerHTML = `Mostrando <strong>1-${list.length}</strong> de <strong>${list.length}</strong> productos`;
  }

  grid.innerHTML = list.map(cardHTML).join('');
})();
