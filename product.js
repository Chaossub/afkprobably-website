(async () => {
  const cfg = window.AFK_CONFIG || {};
  const lockedView = document.getElementById('lockedView');
  const productView = document.getElementById('productView');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { lockedView.hidden = false; return; }

  let session = null;
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    session = (await sb.auth.getSession()).data.session;
  }
  const headers = session ? { authorization: `Bearer ${session.access_token}` } : {};
  const response = await fetch(`/api/product?id=${encodeURIComponent(id)}`, { headers, cache: 'no-store' });
  if (!response.ok) { lockedView.hidden = false; return; }
  const payload = await response.json();
  const product = payload.product;
  productView.hidden = false;

  if (payload.preview) {
    document.getElementById('previewBadge').hidden = false;
    document.getElementById('adminNav').hidden = false;
    const state = document.getElementById('productState');
    state.hidden = false;
    state.textContent = product.status;
  }

  document.title = `${product.name} | AFKProbably`;
  document.getElementById('productName').textContent = product.name;
  document.getElementById('productCategory').textContent = product.category || 'AFKPROBABLY 3D';
  document.getElementById('productDescription').textContent = product.description || 'A downloadable 3D-print mesh from AFKProbably.';
  document.getElementById('printNotes').textContent = product.print_notes || 'No special print notes have been added yet.';

  const images = product.images || [];
  const mainImage = document.getElementById('mainImage');
  const thumbStrip = document.getElementById('thumbStrip');
  const setImage = image => {
    mainImage.innerHTML = image ? `<img src="${escapeAttr(image.public_url)}" alt="${escapeAttr(product.name)}">` : `<img class="placeholder-moon" src="assets/moon-mark.png" alt="">`;
  };
  setImage(images[0]);
  thumbStrip.innerHTML = images.length > 1 ? images.map((image, i) => `<button type="button" data-image="${i}"><img src="${escapeAttr(image.public_url)}" alt="${escapeAttr(product.name)} preview ${i+1}"></button>`).join('') : '';
  thumbStrip.querySelectorAll('[data-image]').forEach(btn => btn.addEventListener('click', () => setImage(images[Number(btn.dataset.image)])));

  const options = [];
  if (Number.isInteger(product.personal_price_cents)) options.push({ type:'personal', label:'Personal License', price:product.personal_price_cents, copy:'Print it for yourself, gifts, or other non-commercial personal use.' });
  if (Number.isInteger(product.commercial_price_cents)) options.push({ type:'commercial', label:'Commercial License', price:product.commercial_price_cents, copy:'Sell physical prints you produce. Digital redistribution is never included.' });
  let ownedLicenses = [];
  if (session) {
    try {
      const ownershipResponse = await fetch(`/api/ownership?product_id=${encodeURIComponent(product.id)}`, { headers, cache: 'no-store' });
      if (ownershipResponse.ok) ownedLicenses = (await ownershipResponse.json()).owned || [];
    } catch (_) {}
  }

  document.getElementById('licenseOptions').innerHTML = options.map(option => {
    const owned = ownedLicenses.includes(option.type);
    return `
    <article class="license-option ${owned ? 'owned-license' : ''}">
      <div><h3>${option.label}</h3><p>${option.copy}</p>${owned ? '<span class="owned-pill">Owned</span>' : ''}</div>
      <div class="license-action"><strong>${formatPrice(option.price)}</strong>${owned ? '<a class="buy-button owned-button" href="library.html">Download in My Library</a>' : `<button class="buy-button" data-license="${option.type}">${payload.preview ? 'Test checkout' : 'Buy now'}</button>`}</div>
    </article>`;
  }).join('');

  document.querySelectorAll('[data-license]').forEach(button => {
    button.addEventListener('click', async () => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Opening Stripe…';
      try {
        const checkoutHeaders = { 'content-type':'application/json', ...headers };
        const checkout = await fetch('/api/create-checkout', { method:'POST', headers: checkoutHeaders, body: JSON.stringify({ productId: product.id, licenseType: button.dataset.license }) });
        const result = await checkout.json();
        if (!checkout.ok) throw new Error(result.error || 'Could not start checkout.');
        location.href = result.url;
      } catch (error) {
        alert(error.message || String(error));
        button.disabled = false;
        button.textContent = original;
      }
    });
  });

  function formatPrice(cents) { return `$${(Number(cents)/100).toFixed(2)}`; }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
  function escapeAttr(value='') { return escapeHtml(value); }
})();
