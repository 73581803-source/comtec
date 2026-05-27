/* ============================================================
   ComTec — JS común (header + carrito + año footer)
   ============================================================ */
(() => {
  // ---------- Menú móvil ----------
  const menuBtn = document.getElementById('menuBtn');
  const navMenu = document.getElementById('navMenu');
  if (menuBtn && navMenu) {
    menuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
  }

  // ---------- Año dinámico en footer ----------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- Carrito (localStorage simple) ----------
  const CART_KEY = 'comtec_cart';
  const cartCountEl = document.getElementById('cartCount');

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function setCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartUI();
  }

  function updateCartUI() {
    if (!cartCountEl) return;
    const cart = getCart();
    const total = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    cartCountEl.textContent = total;
    cartCountEl.style.display = total > 0 ? 'grid' : 'none';
  }

  function addToCart(product) {
    const cart = getCart();
    const existing = cart.find((it) => it.id === product.id);
    if (existing) existing.qty = (existing.qty || 1) + 1;
    else cart.push({ ...product, qty: 1 });
    setCart(cart);

    // Toast simple
    showToast(`✓ ${product.name} añadido al carrito`);
  }

  // ---------- Toast notification ----------
  function showToast(msg) {
    let toast = document.getElementById('cart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cart-toast';
      toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px;
        background: #0f172a; color: #fff;
        padding: 12px 18px; border-radius: 10px;
        font-weight: 600; font-size: 14px;
        box-shadow: 0 10px 30px rgba(15,23,42,.25);
        opacity: 0; transform: translateY(20px);
        transition: opacity .25s, transform .25s;
        z-index: 9999; max-width: 320px;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
    }, 2200);
  }

  // ---------- Interceptar botones "Comprar" en el grid ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.product-card .buy, .product-card .btn-cyan, .hero-card .btn-cyan');
    if (!btn) return;
    e.preventDefault();

    const card = btn.closest('.product-card, .hero-card');
    if (!card) return;

    const nameEl = card.querySelector('h3');
    const priceEl = card.querySelector('.new');
    if (!nameEl) return;

    addToCart({
      id: nameEl.textContent.trim(),
      name: nameEl.textContent.trim(),
      price: priceEl ? priceEl.textContent.trim() : '',
    });
  });

  // ---------- Wishlist toggle visual ----------
  document.addEventListener('click', (e) => {
    const wish = e.target.closest('.wish');
    if (!wish) return;
    e.preventDefault();
    wish.classList.toggle('active');
    wish.style.color = wish.classList.contains('active') ? '#e11d48' : '';
  });

  // Init
  updateCartUI();
})();
