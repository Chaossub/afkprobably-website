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
    const personal = product.personal_price_cents;
    const commercial = product.commercial_price_cents;
    return `
      <article class="product-card">
        <div class="product-image">${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(product.name)}">` : `<img class="placeholder-moon" src="assets/moon-mark.png" alt="">`}</div>
        <div class="product-content">
          <div class="product-title-row"><h2>${escapeHtml(product.name)}</h2><span class="preview-state">${escapeHtml(product.status)}</span></div>
          <p>${escapeHtml(product.description || 'No description yet.')}</p>
          <div class="price-stack preview-prices">
            <span>Personal ${formatPrice(personal)}</span>
            <span>Commercial ${formatPrice(commercial)}</span>
          </div>
          <div class="checkout-actions">
            ${Number.isInteger(personal) ? `<button class="buy-button" data-buy="${product.id}" data-license="personal">Test Personal Checkout</button>` : ''}
            ${Number.isInteger(commercial) ? `<button class="buy-button secondary-buy" data-buy="${product.id}" data-license="commercial">Test Commercial Checkout</button>` : ''}
          </div>
          <p class="checkout-note">Private Stripe test checkout. Nothing here is linked from the public homepage.</p>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('[data-buy]').forEach(button => {
    button.addEventListener('click', async () => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Opening Stripe…';
      try {
        const { data: { session: currentSession } } = await sb.auth.getSession();
        if (!currentSession) throw new Error('Please sign in again.');
        const response = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${currentSession.access_token}`
          },
          body: JSON.stringify({ productId: button.dataset.buy, licenseType: button.dataset.license })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not start checkout.');
        location.href = result.url;
      } catch (err) {
        alert(err.message || String(err));
        button.disabled = false;
        button.textContent = original;
      }
    });
  });

  function formatPrice(cents) { return cents == null ? '—' : `$${(Number(cents)/100).toFixed(2)}`; }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
  function escapeAttr(value='') { return escapeHtml(value); }
})();
