(() => {
  const cfg = window.AFK_CONFIG || {};
  const setupPanel = document.getElementById('setupPanel');
  const authPanel = document.getElementById('authPanel');
  const adminPanel = document.getElementById('adminPanel');
  const signOutBtn = document.getElementById('signOutBtn');
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  const productForm = document.getElementById('productForm');
  const listingList = document.getElementById('listingList');
  const saveMessage = document.getElementById('saveMessage');
  const editorTitle = document.getElementById('editorTitle');

  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('PASTE_') && !cfg.SUPABASE_ANON_KEY.includes('PASTE_');
  if (!configured) {
    setupPanel.hidden = false;
    return;
  }

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let listings = [];

  const moneyToCents = value => value === '' ? null : Math.round(Number(value) * 100);
  const centsToMoney = value => value == null ? '' : (Number(value) / 100).toFixed(2);
  const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);
  const uniquePath = (folder, file) => `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    renderAuth(Boolean(session));
    if (session) await loadListings();
    sb.auth.onAuthStateChange(async (_event, sessionNow) => {
      renderAuth(Boolean(sessionNow));
      if (sessionNow) await loadListings();
    });
  }

  function renderAuth(signedIn) {
    authPanel.hidden = signedIn;
    adminPanel.hidden = !signedIn;
    signOutBtn.hidden = !signedIn;
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginMessage.textContent = 'Signing in…';
    const { error } = await sb.auth.signInWithPassword({
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value
    });
    loginMessage.textContent = error ? error.message : 'Signed in.';
  });

  signOutBtn.addEventListener('click', () => sb.auth.signOut());
  document.getElementById('refreshBtn').addEventListener('click', loadListings);
  document.getElementById('resetFormBtn').addEventListener('click', resetForm);

  function resetForm() {
    productForm.reset();
    document.getElementById('productId').value = '';
    editorTitle.textContent = 'Add a mesh';
    saveMessage.textContent = '';
  }

  async function loadListings() {
    listingList.innerHTML = '<p>Loading…</p>';
    const { data, error } = await sb.from('products').select('*, product_images(*)').order('created_at', { ascending: false });
    if (error) {
      listingList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
      return;
    }
    listings = data || [];
    if (!listings.length) {
      listingList.innerHTML = '<p>No products yet.</p>';
      return;
    }
    listingList.innerHTML = listings.map(item => `
      <article class="listing-item">
        <div class="listing-row"><span class="listing-name">${escapeHtml(item.name)}</span><span class="status-pill">${escapeHtml(item.status)}</span></div>
        <div class="listing-meta">Personal ${formatPrice(item.personal_price_cents)} · Commercial ${formatPrice(item.commercial_price_cents)}</div>
        <div class="listing-buttons">
          <button class="tiny-button" data-edit="${item.id}">Edit</button>
          <button class="tiny-button danger" data-delete="${item.id}">Delete</button>
        </div>
      </article>
    `).join('');
    listingList.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => editListing(btn.dataset.edit)));
    listingList.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteListing(btn.dataset.delete)));
  }

  function editListing(id) {
    const item = listings.find(x => x.id === id);
    if (!item) return;
    document.getElementById('productId').value = item.id;
    document.getElementById('name').value = item.name || '';
    document.getElementById('category').value = item.category || '';
    document.getElementById('status').value = item.status || 'draft';
    document.getElementById('personalPrice').value = centsToMoney(item.personal_price_cents);
    document.getElementById('commercialPrice').value = centsToMoney(item.commercial_price_cents);
    document.getElementById('description').value = item.description || '';
    document.getElementById('printNotes').value = item.print_notes || '';
    editorTitle.textContent = `Edit ${item.name}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteListing(id) {
    if (!confirm('Delete this listing? Uploaded files will remain in storage for now.')) return;
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) alert(error.message);
    await loadListings();
    if (document.getElementById('productId').value === id) resetForm();
  }

  productForm.addEventListener('submit', async e => {
    e.preventDefault();
    saveMessage.textContent = 'Saving…';
    document.getElementById('saveBtn').disabled = true;
    try {
      const existingId = document.getElementById('productId').value || null;
      const name = document.getElementById('name').value.trim();
      const payload = {
        name,
        slug: slugify(name),
        category: document.getElementById('category').value.trim() || null,
        status: document.getElementById('status').value,
        personal_price_cents: moneyToCents(document.getElementById('personalPrice').value),
        commercial_price_cents: moneyToCents(document.getElementById('commercialPrice').value),
        description: document.getElementById('description').value.trim() || null,
        print_notes: document.getElementById('printNotes').value.trim() || null,
        updated_at: new Date().toISOString()
      };

      let product;
      if (existingId) {
        const { data, error } = await sb.from('products').update(payload).eq('id', existingId).select().single();
        if (error) throw error;
        product = data;
      } else {
        const { data, error } = await sb.from('products').insert(payload).select().single();
        if (error) throw error;
        product = data;
        document.getElementById('productId').value = product.id;
      }

      const imageFiles = [...document.getElementById('imageFiles').files];
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const path = uniquePath(product.id, file);
        const upload = await sb.storage.from('product-images').upload(path, file, { upsert: false });
        if (upload.error) throw upload.error;
        const { data: pub } = sb.storage.from('product-images').getPublicUrl(path);
        const { error: imageRowError } = await sb.from('product_images').insert({ product_id: product.id, storage_path: path, public_url: pub.publicUrl, sort_order: i });
        if (imageRowError) throw imageRowError;
      }

      const meshFiles = [...document.getElementById('meshFiles').files];
      for (const file of meshFiles) {
        const path = uniquePath(product.id, file);
        const upload = await sb.storage.from('mesh-files').upload(path, file, { upsert: false });
        if (upload.error) throw upload.error;
        const { error: meshRowError } = await sb.from('product_files').insert({ product_id: product.id, storage_path: path, original_name: file.name, file_size: file.size });
        if (meshRowError) throw meshRowError;
      }

      saveMessage.textContent = 'Saved ✓';
      document.getElementById('imageFiles').value = '';
      document.getElementById('meshFiles').value = '';
      await loadListings();
    } catch (err) {
      saveMessage.textContent = err.message || String(err);
    } finally {
      document.getElementById('saveBtn').disabled = false;
    }
  });

  function formatPrice(cents) { return cents == null ? '—' : `$${(Number(cents)/100).toFixed(2)}`; }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
  boot();
})();
