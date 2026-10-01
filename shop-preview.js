(async () => {
  const cfg = window.AFK_CONFIG || {};
  const previewAuth = document.getElementById('previewAuth');
  const previewShop = document.getElementById('previewShop');
  const grid = document.getElementById('previewGrid');
  const empty = document.getElementById('emptyPreview');
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('PASTE_') && !cfg.SUPABASE_ANON_KEY.includes('PASTE_');
  if (!configured) { previewAuth.hidden = false; return; }

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { previewAuth.hidden = false; return; }
  previewShop.hidden = false;

  const { data, error } = await sb.from('products').select('*, product_images(*)').order('created_at', { ascending: false });
  if (error) { grid.innerHTML = `<p>${escapeHtml(error.message)}</p>`; return; }
  const products = data || [];
  if (!products.length) { empty.hidden = false; return; }

  grid.innerHTML = products.map(product => {
    const sortedImages = [...(product.product_images || [])].sort((a,b) => (a.sort_order||0) - (b.sort_order||0));
    const image = sortedImages[0]?.public_url;
    return `
      <article class="product-card">
        <div class="product-image">${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(product.name)}">` : `<img class="placeholder-moon" src="assets/moon-mark.png" alt="">`}</div>
        <div class="product-content">
          <h2>${escapeHtml(product.name)}</h2>
          <p>${escapeHtml(product.description || 'No description yet.')}</p>
          <div class="product-footer">
            <div class="price-stack">
              <span>Personal ${formatPrice(product.personal_price_cents)}</span>
              <span>Commercial ${formatPrice(product.commercial_price_cents)}</span>
            </div>
            <span class="preview-state">${escapeHtml(product.status)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  function formatPrice(cents) { return cents == null ? '—' : `$${(Number(cents)/100).toFixed(2)}`; }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
  function escapeAttr(value='') { return escapeHtml(value); }
})();
