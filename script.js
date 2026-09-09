'use strict';

(function () {
    /* =====================================================
       CONFIGURACIÓN
       ===================================================== */
    const CONFIG = {
        cartKey: 'centroDigital.cart',
        wishKey: 'centroDigital.wishlist',
        freeShipping: 150000,   // umbral de envío gratis (antes USD 150)
        searchDebounce: 250,    // ms
        addedFeedback: 1200,    // ms que dura el estado "Añadido" del botón
        toastDuration: 2600     // ms
    };

    // Cotización de referencia usada para pasar los precios de USD a ARS:
    // 1 USD = $1.000 ARS. Es un valor de referencia (no en tiempo real) —
    // si cambia la cotización, recalculá "price" de cada producto con esta
    // constante y volvé a redondear.
    const USD_TO_ARS = 1000;

    /* =====================================================
       DATOS
       ===================================================== */
    const products = [
        {
            id: 1,
            title: 'Mouse Gamer Pro Wireless',
            category: 'perifericos',
            price: 79990, // USD 79.99 × USD_TO_ARS
            stock: 14,
            rating: 4.6,
            reviews: 213,
            image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&q=80&w=400',
            desc: 'Sensor óptico 26K DPI, switches ópticos ultra rápidos.'
        },
        {
            id: 2,
            title: 'Teclado Mecánico RGB 75%',
            category: 'perifericos',
            price: 120000, // USD 120.00 × USD_TO_ARS
            stock: 8,
            rating: 4.8,
            reviews: 341,
            onSale: true,
            discount: 15,
            image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=400',
            desc: 'Switches hot-swappable, iluminación RGB personalizable.'
        },
        {
            id: 3,
            title: 'Auriculares Surround 7.1',
            category: 'perifericos',
            price: 89990, // USD 89.99 × USD_TO_ARS
            stock: 0,
            rating: 4.3,
            reviews: 158,
            image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=400',
            desc: 'Drivers de 50mm, micrófono con cancelación de ruido.'
        },
        {
            id: 4,
            title: 'Tarjeta Gráfica RTX 4070 Ti',
            category: 'componentes',
            price: 799990, // USD 799.99 × USD_TO_ARS
            stock: 3,
            rating: 4.9,
            reviews: 92,
            image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&q=80&w=400',
            desc: '12GB GDDR6X, DLSS 3.0 para máximo rendimiento.'
        },
        {
            id: 5,
            title: 'Mousepad XL Gaming Neon',
            category: 'accesorios',
            price: 25000, // USD 25.00 × USD_TO_ARS
            stock: 40,
            rating: 4.4,
            reviews: 507,
            onSale: true,
            discount: 20,
            image: 'https://images.unsplash.com/photo-1629429408209-1f912961dbd8?auto=format&fit=crop&q=80&w=400',
            desc: 'Superficie de microtextura con bordes cosidos.'
        },
        {
            id: 6,
            title: 'Polera Oficial Centro Digital',
            category: 'merch',
            price: 35000, // USD 35.00 × USD_TO_ARS
            stock: 22,
            rating: 4.1,
            reviews: 74,
            image: 'https://http2.mlstatic.com/D_783892-CBT110718319387_042026-O.jpg',
            desc: 'Algodón 100% premium con diseño cyberpunk.'
        }
    ];

    // Máximo de stock disponible (para la barra visual)
    const MAX_STOCK = Math.max(...products.map((p) => p.stock));

    /* =====================================================
       ESTADO
       ===================================================== */
    const state = {
        category: 'all',
        query: '',
        sort: 'default',
        saleOnly: false,
        inStockOnly: false,
        wishlistOnly: false
    };

    let cart = loadJSON(CONFIG.cartKey, []);
    let wishlist = loadJSON(CONFIG.wishKey, []); // array de ids

    /* =====================================================
       REFERENCIAS AL DOM
       ===================================================== */
    const dom = {};

    function cacheDom() {
        dom.grid = document.getElementById('productsGrid');
        dom.resultsCount = document.getElementById('resultsCount');
        dom.clearChip = document.getElementById('clearChip');
        dom.sortSelect = document.getElementById('sortSelect');
        dom.searchInput = document.getElementById('searchInput');
        dom.filterBtns = Array.from(document.querySelectorAll('.filter-btn'));
        dom.saleToggle = document.getElementById('saleToggle');
        dom.stockToggle = document.getElementById('stockToggle');

        dom.cartBtn = document.getElementById('cartBtn');
        dom.cartCount = document.getElementById('cartCount');
        dom.cartModal = document.getElementById('cartModal');
        dom.closeCartBtn = document.getElementById('closeCart');
        dom.cartItems = document.getElementById('cartItems');
        dom.cartTotal = document.getElementById('cartTotal');
        dom.checkoutBtn = document.getElementById('checkoutBtn');
        dom.shipProgress = document.getElementById('shipProgress');
        dom.shipBarFill = document.getElementById('shipBarFill');
        dom.shipMsg = document.getElementById('shipMsg');

        dom.wishlistBtn = document.getElementById('wishlistBtn');
        dom.wishlistCount = document.getElementById('wishlistCount');

        dom.quickModal = document.getElementById('quickModal');
        dom.quickBody = document.getElementById('quickBody');
        dom.closeQuick = document.getElementById('closeQuick');

        dom.navToggle = document.getElementById('navToggle');
        dom.primaryNav = document.getElementById('primaryNav');
        dom.navOfertas = document.getElementById('navOfertas');
        dom.toastContainer = document.getElementById('toastContainer');
        dom.shippingPerkNote = document.getElementById('shippingPerkNote');
        dom.year = document.getElementById('year');
    }

    /* =====================================================
       UTILIDADES
       ===================================================== */
    const arsFormatter = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    });

    function formatPrice(value) {
        return arsFormatter.format(value);
    }

    function finalPrice(product) {
        return product.onSale ? product.price * (1 - product.discount / 100) : product.price;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            console.warn(`No se pudo leer "${key}":`, err);
            return fallback;
        }
    }

    function saveJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            console.warn(`No se pudo guardar "${key}":`, err);
        }
    }

    // Animación de rebote reutilizable en los contadores
    function bump(el) {
        el.classList.remove('bump');
        void el.offsetWidth; // fuerza reflow para reiniciar la animación
        el.classList.add('bump');
    }

    /* =====================================================
       FILTRADO Y RENDER DE PRODUCTOS
       ===================================================== */
    function getVisibleProducts() {
        let list = products.slice();

        if (state.category !== 'all') {
            list = list.filter((p) => p.category === state.category);
        }
        if (state.saleOnly) {
            list = list.filter((p) => p.onSale);
        }
        if (state.inStockOnly) {
            list = list.filter((p) => p.stock > 0);
        }
        if (state.wishlistOnly) {
            list = list.filter((p) => wishlist.includes(p.id));
        }
        if (state.query) {
            const q = state.query.toLowerCase();
            list = list.filter((p) =>
                p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
            );
        }

        switch (state.sort) {
            case 'price-asc':  list.sort((a, b) => finalPrice(a) - finalPrice(b)); break;
            case 'price-desc': list.sort((a, b) => finalPrice(b) - finalPrice(a)); break;
            case 'rating-desc': list.sort((a, b) => b.rating - a.rating); break;
        }

        return list;
    }

    function starsMarkup(rating, reviews) {
        const pct = (rating / 5) * 100;
        return `
            <div class="rating">
                <span class="stars" style="--pct:${pct}%" role="img" aria-label="${rating} de 5 estrellas"></span>
                <span>${rating.toFixed(1)} (${reviews})</span>
            </div>`;
    }

    function stockMeterMarkup(product) {
        const pct = Math.round((product.stock / MAX_STOCK) * 100);
        const low = product.stock <= 5;
        return `
            <div class="stock-meter ${low ? 'low' : ''}">
                <div class="bar"><span style="width:${pct}%"></span></div>
                <small>${product.stock} en stock</small>
            </div>`;
    }

    function productCardTemplate(product, index, animate) {
        const soldOut = product.stock === 0;
        const price = finalPrice(product);
        const wished = wishlist.includes(product.id);
        const staggerAttr = animate ? ` style="--stagger:${index * 50}ms"` : '';

        return `
            <article class="product-card ${soldOut ? 'is-sold-out' : ''} ${animate ? 'animate-in' : ''}" data-id="${product.id}"${staggerAttr}>
                <div class="product-badges">
                    ${product.onSale ? `<span class="badge badge-sale">-${product.discount}%</span>` : ''}
                    ${!soldOut && product.stock <= 5 ? `<span class="badge badge-stock">Últimas ${product.stock}</span>` : ''}
                </div>
                <div class="product-media">
                    <button class="wish-btn ${wished ? 'is-active' : ''}" type="button" data-wish="${product.id}"
                            aria-pressed="${wished}" aria-label="${wished ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </button>
                    <button class="media-btn" type="button" data-quick="${product.id}" aria-label="Vista rápida de ${escapeHtml(product.title)}">
                        <img src="${product.image}" alt="${escapeHtml(product.title)}" class="product-img" loading="lazy">
                        <span class="media-hint">Vista rápida</span>
                    </button>
                </div>
                <h3 class="product-title">${escapeHtml(product.title)}</h3>
                ${starsMarkup(product.rating, product.reviews)}
                <p class="product-desc">${escapeHtml(product.desc)}</p>
                ${soldOut ? '' : stockMeterMarkup(product)}
                <div class="product-footer">
                    <div class="price-group">
                        ${product.onSale ? `<span class="price-original">${formatPrice(product.price)}</span>` : ''}
                        <span class="price">${formatPrice(price)}</span>
                    </div>
                    <button class="btn-add" type="button" data-add="${product.id}" ${soldOut ? 'disabled' : ''}>
                        ${soldOut ? 'Agotado' : 'Añadir'}
                    </button>
                </div>
            </article>`;
    }

    function anyFilterActive() {
        return state.category !== 'all' || state.saleOnly || state.inStockOnly ||
               state.wishlistOnly || state.query !== '';
    }

    // La animación de entrada de las tarjetas solo se juega en la primera
    // carga: repetirla en cada búsqueda/filtro sería ruido visual constante.
    let isFirstRender = true;

    function renderProducts() {
        const list = getVisibleProducts();
        const animate = isFirstRender;

        dom.resultsCount.textContent =
            `${list.length} producto${list.length === 1 ? '' : 's'} encontrado${list.length === 1 ? '' : 's'}`;
        dom.clearChip.hidden = !anyFilterActive();

        if (list.length === 0) {
            const msg = state.wishlistOnly
                ? 'Todavía no guardaste favoritos. Tocá el corazón de un producto.'
                : 'No encontramos productos con esos filtros.';
            dom.grid.innerHTML = `
                <div class="empty-state">
                    <p>${msg}</p>
                    <button class="btn-secondary" type="button" id="resetFiltersBtn">Ver todos</button>
                </div>`;
        } else {
            dom.grid.innerHTML = list.map((product, index) => productCardTemplate(product, index, animate)).join('');
        }

        isFirstRender = false;
    }

    /* =====================================================
       CARRITO
       ===================================================== */
    function addToCart(id) {
        const product = products.find((p) => p.id === id);
        if (!product || product.stock === 0) return;

        const item = cart.find((i) => i.id === id);
        const currentQty = item ? item.quantity : 0;

        if (currentQty >= product.stock) {
            showToast(`Ya tenés el máximo disponible de "${product.title}"`, 'warning');
            return;
        }

        if (item) {
            item.quantity += 1;
        } else {
            cart.push({ id: product.id, title: product.title, price: finalPrice(product), quantity: 1 });
        }

        saveJSON(CONFIG.cartKey, cart);
        updateCartUI();
        bump(dom.cartCount);
        flashAddButton(id);
        showToast(`"${product.title}" añadido al carrito`, 'success');
    }

    // Feedback visual en el botón "Añadir" de la tarjeta
    function flashAddButton(id) {
        const btn = dom.grid.querySelector(`[data-add="${id}"]`);
        if (!btn || btn.disabled) return;
        const original = btn.textContent;
        btn.classList.add('added');
        btn.textContent = '✓ Añadido';
        setTimeout(() => {
            btn.classList.remove('added');
            btn.textContent = original;
        }, CONFIG.addedFeedback);
    }

    function changeQuantity(id, delta) {
        const item = cart.find((i) => i.id === id);
        if (!item) return;

        const product = products.find((p) => p.id === id);
        const newQty = item.quantity + delta;

        if (newQty <= 0) {
            removeFromCart(id);
            return;
        }
        if (product && newQty > product.stock) {
            showToast('Alcanzaste el stock disponible', 'warning');
            return;
        }

        item.quantity = newQty;
        saveJSON(CONFIG.cartKey, cart);
        updateCartUI();
    }

    function removeFromCart(id) {
        cart = cart.filter((i) => i.id !== id);
        saveJSON(CONFIG.cartKey, cart);
        updateCartUI();
    }

    function cartItemTemplate(item) {
        const lineTotal = item.price * item.quantity;
        return `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-info">
                    <h4>${escapeHtml(item.title)}</h4>
                    <p>${formatPrice(item.price)} c/u · <span class="line-total">${formatPrice(lineTotal)}</span></p>
                </div>
                <div class="cart-item-controls">
                    <button type="button" class="qty-btn" data-decrease="${item.id}" aria-label="Restar unidad">−</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button type="button" class="qty-btn" data-increase="${item.id}" aria-label="Sumar unidad">+</button>
                    <button type="button" class="remove-btn" data-remove="${item.id}" aria-label="Eliminar producto">🗑</button>
                </div>
            </div>`;
    }

    function updateCartUI() {
        const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
        dom.cartCount.textContent = totalQty;

        dom.cartItems.innerHTML = cart.length === 0
            ? '<p class="empty-msg">Tu carrito está vacío</p>'
            : cart.map(cartItemTemplate).join('');

        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        dom.cartTotal.textContent = formatPrice(total);
        dom.checkoutBtn.disabled = cart.length === 0;

        updateShippingProgress(total);
    }

    function updateShippingProgress(total) {
        if (cart.length === 0) {
            dom.shipProgress.hidden = true;
            return;
        }
        dom.shipProgress.hidden = false;

        const threshold = CONFIG.freeShipping;
        const pct = Math.min((total / threshold) * 100, 100);
        dom.shipBarFill.style.width = `${pct}%`;

        if (total >= threshold) {
            dom.shipProgress.classList.add('unlocked');
            dom.shipMsg.textContent = '¡Tenés envío gratis! 🚚';
        } else {
            dom.shipProgress.classList.remove('unlocked');
            const falta = threshold - total;
            dom.shipMsg.textContent = `Te faltan ${formatPrice(falta)} para el envío gratis`;
        }
    }

    function handleCheckout() {
        if (cart.length === 0) return;
        showToast('¡Gracias por tu compra! Pedido simulado con éxito.', 'success');
        cart = [];
        saveJSON(CONFIG.cartKey, cart);
        updateCartUI();
        closeModal(dom.cartModal);
    }

    /* =====================================================
       FAVORITOS (WISHLIST)
       ===================================================== */
    function toggleWishlist(id) {
        const product = products.find((p) => p.id === id);
        if (!product) return;

        const idx = wishlist.indexOf(id);
        let added;
        if (idx === -1) {
            wishlist.push(id);
            added = true;
        } else {
            wishlist.splice(idx, 1);
            added = false;
        }

        saveJSON(CONFIG.wishKey, wishlist);
        updateWishlistUI();

        // Actualiza solo el corazón de la tarjeta afectada, sin re-renderizar todo
        const btn = dom.grid.querySelector(`[data-wish="${id}"]`);
        if (btn) {
            btn.classList.toggle('is-active', added);
            btn.setAttribute('aria-pressed', String(added));
            btn.setAttribute('aria-label', added ? 'Quitar de favoritos' : 'Añadir a favoritos');
        }

        // Si estamos viendo solo favoritos, refrescamos la lista
        if (state.wishlistOnly) renderProducts();

        showToast(added ? `"${product.title}" guardado en favoritos` : `"${product.title}" quitado de favoritos`);
    }

    function updateWishlistUI() {
        dom.wishlistCount.textContent = wishlist.length;
        dom.wishlistBtn.classList.toggle('has-items', wishlist.length > 0);
        bump(dom.wishlistCount);
    }

    /* =====================================================
       VISTA RÁPIDA (QUICK VIEW)
       ===================================================== */
    function openQuickView(id) {
        const product = products.find((p) => p.id === id);
        if (!product) return;

        const soldOut = product.stock === 0;
        const price = finalPrice(product);

        dom.quickBody.innerHTML = `
            <img src="${product.image}" alt="${escapeHtml(product.title)}">
            <div class="modal-info">
                <h2 id="quickTitle">${escapeHtml(product.title)}</h2>
                ${starsMarkup(product.rating, product.reviews)}
                <div class="modal-price">
                    ${formatPrice(price)}
                    ${product.onSale ? `<span class="price-original">${formatPrice(product.price)}</span>` : ''}
                </div>
                <p>${escapeHtml(product.desc)}</p>
                <ul class="modal-meta">
                    <li>Categoría: ${product.category}</li>
                    <li>Disponibilidad: ${soldOut ? 'Agotado' : `${product.stock} unidades`}</li>
                    <li>Valoración: ${product.rating.toFixed(1)} / 5 · ${product.reviews} reseñas</li>
                </ul>
                <button class="btn-primary btn-block" type="button" data-add="${product.id}" ${soldOut ? 'disabled' : ''}>
                    ${soldOut ? 'Agotado' : 'Añadir al carrito'}
                </button>
            </div>`;

        openModal(dom.quickModal);
    }

    /* =====================================================
       MODALES GENÉRICOS + FOCUS TRAP (accesibilidad)
       ===================================================== */
    let activeModal = null;
    let lastFocused = null;

    function openModal(modal) {
        lastFocused = document.activeElement;
        activeModal = modal;
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        const focusable = getFocusable(modal);
        if (focusable.length) focusable[0].focus();

        document.addEventListener('keydown', handleModalKeydown);
    }

    function closeModal(modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleModalKeydown);
        activeModal = null;
        if (lastFocused) lastFocused.focus();
    }

    function getFocusable(container) {
        return Array.from(container.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter((el) => el.offsetParent !== null);
    }

    // Escape para cerrar + Tab que no se escapa del modal (focus trap)
    function handleModalKeydown(e) {
        if (!activeModal) return;

        if (e.key === 'Escape') {
            closeModal(activeModal);
            return;
        }
        if (e.key !== 'Tab') return;

        const focusable = getFocusable(activeModal);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    /* =====================================================
       NOTIFICACIONES (TOAST)
       ===================================================== */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        dom.toastContainer.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, CONFIG.toastDuration);
    }

    /* =====================================================
       FILTROS: CATEGORÍA, BÚSQUEDA, ORDEN, TOGGLES
       ===================================================== */
    function selectCategory(category) {
        state.category = category;
        state.wishlistOnly = false;
        dom.filterBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.category === category));
        renderProducts();
    }

    // Aplica un filtro rápido (oferta o favoritos) dejando los demás en un
    // estado conocido, para que nunca queden dos filtros excluyentes activos
    // a la vez (p. ej. "Ofertas" sobre una categoría vacía de ofertas).
    function setQuickFilter(type) {
        state.category = 'all';
        state.saleOnly = type === 'sale';
        state.wishlistOnly = type === 'wishlist';
        dom.saleToggle.checked = state.saleOnly;
        dom.filterBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.category === 'all'));
        renderProducts();
        document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
    }

    function resetFilters() {
        Object.assign(state, {
            category: 'all', query: '', sort: 'default',
            saleOnly: false, inStockOnly: false, wishlistOnly: false
        });
        dom.searchInput.value = '';
        dom.sortSelect.value = 'default';
        dom.saleToggle.checked = false;
        dom.stockToggle.checked = false;
        dom.filterBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.category === 'all'));
        renderProducts();
    }

    /* =====================================================
       EVENTOS
       ===================================================== */
    function bindEvents() {
        // --- Filtros ---
        dom.filterBtns.forEach((btn) => {
            btn.addEventListener('click', () => selectCategory(btn.dataset.category));
        });

        dom.searchInput.addEventListener('input', debounce((e) => {
            state.query = e.target.value.trim();
            renderProducts();
        }, CONFIG.searchDebounce));

        dom.sortSelect.addEventListener('change', (e) => {
            state.sort = e.target.value;
            renderProducts();
        });

        dom.saleToggle.addEventListener('change', (e) => {
            state.saleOnly = e.target.checked;
            renderProducts();
        });

        dom.stockToggle.addEventListener('change', (e) => {
            state.inStockOnly = e.target.checked;
            renderProducts();
        });

        dom.clearChip.addEventListener('click', resetFilters);

        dom.navOfertas.addEventListener('click', (e) => {
            e.preventDefault();
            setQuickFilter('sale');
        });

        // Enlaces del footer que apuntan a una categoría
        document.querySelectorAll('.site-footer [data-category]').forEach((link) => {
            link.addEventListener('click', () => selectCategory(link.dataset.category));
        });

        // --- Delegación: grid de productos ---
        dom.grid.addEventListener('click', (e) => {
            const addBtn = e.target.closest('[data-add]');
            if (addBtn) { addToCart(Number(addBtn.dataset.add)); return; }

            const wishBtn = e.target.closest('[data-wish]');
            if (wishBtn) { toggleWishlist(Number(wishBtn.dataset.wish)); return; }

            const quick = e.target.closest('[data-quick]');
            if (quick) { openQuickView(Number(quick.dataset.quick)); return; }

            if (e.target.closest('#resetFiltersBtn')) resetFilters();
        });

        // --- Delegación: controles del carrito ---
        dom.cartItems.addEventListener('click', (e) => {
            const inc = e.target.closest('[data-increase]');
            const dec = e.target.closest('[data-decrease]');
            const rem = e.target.closest('[data-remove]');
            if (inc) changeQuantity(Number(inc.dataset.increase), 1);
            if (dec) changeQuantity(Number(dec.dataset.decrease), -1);
            if (rem) removeFromCart(Number(rem.dataset.remove));
        });

        // --- Vista rápida: el botón "Añadir" dentro del modal ---
        dom.quickBody.addEventListener('click', (e) => {
            const addBtn = e.target.closest('[data-add]');
            if (addBtn) addToCart(Number(addBtn.dataset.add));
        });

        // --- Carrito (drawer) ---
        dom.cartBtn.addEventListener('click', () => openModal(dom.cartModal));
        dom.closeCartBtn.addEventListener('click', () => closeModal(dom.cartModal));
        dom.cartModal.addEventListener('click', (e) => {
            if (e.target === dom.cartModal) closeModal(dom.cartModal);
        });
        dom.checkoutBtn.addEventListener('click', handleCheckout);

        // --- Vista rápida (modal) ---
        dom.closeQuick.addEventListener('click', () => closeModal(dom.quickModal));
        dom.quickModal.addEventListener('click', (e) => {
            if (e.target === dom.quickModal) closeModal(dom.quickModal);
        });

        // --- Favoritos: filtro desde el navbar ---
        dom.wishlistBtn.addEventListener('click', () => {
            if (state.wishlistOnly) {
                resetFilters();
            } else {
                setQuickFilter('wishlist');
            }
        });

        // --- Menú responsive ---
        dom.navToggle.addEventListener('click', () => {
            const isOpen = dom.primaryNav.classList.toggle('open');
            dom.navToggle.setAttribute('aria-expanded', String(isOpen));
        });
    }

    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */
    function init() {
        cacheDom();
        dom.shippingPerkNote.textContent = `en compras desde ${formatPrice(CONFIG.freeShipping)}`;
        dom.year.textContent = new Date().getFullYear();
        bindEvents();
        renderProducts();
        updateCartUI();
        updateWishlistUI();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
