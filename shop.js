(async () => {
  const cfg = window.AFK_CONFIG || {};
  const lockedView = document.getElementById('lockedView');
  const shopView = document.getElementById('shopView');
  const grid = document.getElementById('catalogGrid');
  const empty = document.getElementById('catalogEmpty');
  const search = document.getElementById('catalogSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const previewBadge = document.getElementById('previewBadge');

  let session = null;
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    session = (await sb.auth.getSession()).data.session;
  }

  const headers = session ? { authorization: `Bearer ${session.access_token}` } : {};
  const response = await fetch('/api/catalog', { headers, cache: 'no-store' });
  if (!response.ok) {
    lockedView.hidden = false;
    return;
  }

  const payload = await response.json();
  const products = payload.products || [];
  const memberDiscount = payload.memberDiscount || { plan: null, percent: 0 };
  const discountPercent = Number(memberDiscount.percent || 0);
  shopView.hidden = false;
  if (payload.preview) {
    previewBadge.hidden = false;
  }

  const categories = [...new Set(products.map(x => x.category).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  categoryFilter.innerHTML += categories.map(category => `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`).join('');

  const render = () => {
    const needle = search.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const filtered = products.filter(product => {
      const text = `${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
      return (!needle || text.includes(needle)) && (!category || product.category === category);
    });

    empty.hidden = filtered.length !== 0;
    grid.innerHTML = filtered.map(product => {
      const image = product.images?.[0]?.public_url;
      const previewState = payload.preview ? `<span class="preview-state">${escapeHtml(product.status)}</span>` : '';
      return `
        <article class="catalog-card">
          <a class="catalog-image" href="product.html?id=${encodeURIComponent(product.id)}">
            ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(product.name)}">` : `<img class="placeholder-moon" src="assets/moon-mark.png" alt="">`}
          </a>
          <div class="catalog-content">
            <div class="product-title-row">
              <div>
                ${product.category ? `<p class="card-category">${escapeHtml(product.category)}</p>` : ''}
                <h2><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h2>
              </div>
              ${previewState}
            </div>
            <p class="card-description">${escapeHtml(product.description || 'A downloadable 3D-print mesh from AFKProbably.')}</p>
            <div class="catalog-footer">
              <div class="price-stack">
                ${product.personal_price_cents != null ? (discountPercent > 0
                  ? `<span class="shop-member-price"><span class="original-price">${formatPrice(product.personal_price_cents)}</span> ${formatPrice(applyDiscount(product.personal_price_cents, discountPercent))}<small>${discountPercent}% ${memberDiscount.plan === 'lifetime' ? 'lifetime' : 'monthly'} member discount</small></span>`
                  : `<span>${formatPrice(product.personal_price_cents)}</span>`) : ''}
              </div>
              <a class="view-button" href="product.html?id=${encodeURIComponent(product.id)}">View mesh</a>
            </div>
          </div>
        </article>`;
    }).join('');
  };

  search.addEventListener('input', render);
  categoryFilter.addEventListener('change', render);
  render();

  function applyDiscount(cents, percent) { return Math.max(50, Math.round(Number(cents) * (1 - Number(percent || 0) / 100))); }
  function formatPrice(cents) { return `$${(Number(cents) / 100).toFixed(2)}`; }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
  function escapeAttr(value='') { return escapeHtml(value); }
})();
