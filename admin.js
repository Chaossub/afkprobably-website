(() => {
  const cfg = window.AFK_CONFIG || {};
  const setupPanel = document.getElementById('setupPanel');
  const authPanel = document.getElementById('authPanel');
  const adminPanel = document.getElementById('adminPanel');
  const signOutBtn = document.getElementById('signOutBtn');
  const loginMessage = document.getElementById('loginMessage');
  const productForm = document.getElementById('productForm');
  const listingList = document.getElementById('listingList');
  const saveMessage = document.getElementById('saveMessage');
  const editorTitle = document.getElementById('editorTitle');
  const commissionAdmin = document.getElementById('commissionAdmin');
  const commercialAdmin = document.getElementById('commercialAdmin');
  const commercialPlanForm = document.getElementById('commercialPlanForm');
  const commercialPlanMessage = document.getElementById('commercialPlanMessage');
  const commissionRequestList = document.getElementById('commissionRequestList');

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

  const adminEmail = String(cfg.ADMIN_EMAIL || 'admin@afkprobably.com').toLowerCase();

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    await renderAuth(session);
    sb.auth.onAuthStateChange(async (_event, sessionNow) => {
      await renderAuth(sessionNow);
    });
  }

  async function renderAuth(session) {
    const signedIn = Boolean(session);
    const isAdmin = signedIn && String(session.user?.email || '').toLowerCase() === adminEmail;
    authPanel.hidden = isAdmin;
    adminPanel.hidden = !isAdmin;
    commissionAdmin.hidden = !isAdmin;
    commercialAdmin.hidden = !isAdmin;
    signOutBtn.hidden = !signedIn;

    if (!signedIn) {
      loginMessage.textContent = 'Sign in with your AFKProbably account, then return to this page.';
      return;
    }
    if (!isAdmin) {
      loginMessage.textContent = 'This account does not have admin access.';
      return;
    }
    loginMessage.textContent = '';
    await loadListings();
    await loadCommissions();
    await loadCommercialPlans();
  }

  signOutBtn.addEventListener('click', () => sb.auth.signOut());
  document.getElementById('refreshBtn').addEventListener('click', loadListings);
  document.getElementById('resetFormBtn').addEventListener('click', resetForm);
  document.getElementById('refreshCommissionsBtn')?.addEventListener('click', loadCommissions);

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
        <div class="listing-meta">Personal ${formatPrice(item.personal_price_cents)}</div>
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



  async function loadCommercialPlans() {
    if (!commercialAdmin) return;
    const { data, error } = await sb.from('commercial_license_plans').select('*');
    if (error) {
      commercialPlanMessage.textContent = error.code === '42P01' ? 'Run supabase/commercial-license-upgrade.sql first.' : error.message;
      return;
    }
    const byType = Object.fromEntries((data || []).map(row => [row.plan_type, row]));
    document.getElementById('monthlyCommercialPrice').value = centsToMoney(byType.monthly?.price_cents);
    document.getElementById('lifetimeCommercialPrice').value = centsToMoney(byType.lifetime?.price_cents);
    document.getElementById('monthlyCommercialActive').value = String(byType.monthly?.active !== false);
    document.getElementById('lifetimeCommercialActive').value = String(byType.lifetime?.active !== false);
  }

  commercialPlanForm?.addEventListener('submit', async event => {
    event.preventDefault();
    commercialPlanMessage.textContent = 'Saving…';
    const rows = [
      { plan_type:'monthly', price_cents:moneyToCents(document.getElementById('monthlyCommercialPrice').value), active:document.getElementById('monthlyCommercialActive').value === 'true', updated_at:new Date().toISOString() },
      { plan_type:'lifetime', price_cents:moneyToCents(document.getElementById('lifetimeCommercialPrice').value), active:document.getElementById('lifetimeCommercialActive').value === 'true', updated_at:new Date().toISOString() }
    ];
    if (rows.some(row => row.price_cents != null && row.price_cents < 50)) { commercialPlanMessage.textContent = 'Prices must be at least $0.50.'; return; }
    const { error } = await sb.from('commercial_license_plans').upsert(rows, { onConflict:'plan_type' });
    commercialPlanMessage.textContent = error ? error.message : 'Saved ✓';
  });


  async function loadCommissions() {
    if (!commissionAdmin || !commissionRequestList) return;
    commissionAdmin.hidden = false;
    commissionRequestList.innerHTML = '<p class="commission-empty">Loading…</p>';
    const { data, error } = await sb.from('commission_requests').select('*').order('created_at', { ascending: false });
    if (error) {
      commissionRequestList.innerHTML = `<p class="commission-empty">${error.code === '42P01' ? 'Run supabase/customer-shop-upgrade.sql to enable commission requests.' : escapeHtml(error.message)}</p>`;
      return;
    }
    const rows = data || [];
    if (!rows.length) {
      commissionRequestList.innerHTML = '<p class="commission-empty">No commission requests yet.</p>';
      return;
    }
    const statuses = ['new','reviewing','quoted','accepted','declined','completed'];
    commissionRequestList.innerHTML = rows.map(item => `
      <article class="commission-request">
        <div class="commission-request-head">
          <div><h3>${escapeHtml(item.name)} · ${escapeHtml(item.project_type)}</h3><div class="commission-request-meta"><span>${escapeHtml(item.email)}</span>${item.budget ? `<span>${escapeHtml(item.budget)}</span>` : ''}${item.desired_deadline ? `<span>Deadline ${escapeHtml(item.desired_deadline)}</span>` : ''}</div></div>
          <select data-commission-status="${item.id}" aria-label="Commission status">${statuses.map(status => `<option value="${status}" ${status === item.status ? 'selected' : ''}>${status}</option>`).join('')}</select>
        </div>
        <p>${escapeHtml(item.description)}</p>
        ${item.reference_links ? `<a href="${escapeHtml(item.reference_links)}" target="_blank" rel="noopener noreferrer">Open reference link</a>` : ''}
        <div class="listing-buttons" style="margin-top:12px">
          <button class="tiny-button danger" type="button" data-delete-commission="${item.id}">Delete request</button>
        </div>
      </article>`).join('');

    commissionRequestList.querySelectorAll('[data-commission-status]').forEach(select => select.addEventListener('change', async () => {
      const { error: updateError } = await sb.from('commission_requests').update({ status: select.value }).eq('id', select.dataset.commissionStatus);
      if (updateError) alert(updateError.message);
    }));

    commissionRequestList.querySelectorAll('[data-delete-commission]').forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.dataset.deleteCommission;
        if (!confirm('Delete this commission request permanently?')) return;

        button.disabled = true;
        button.textContent = 'Deleting…';

        const { error: deleteError } = await sb
          .from('commission_requests')
          .delete()
          .eq('id', id);

        if (deleteError) {
          alert(deleteError.message);
          button.disabled = false;
          button.textContent = 'Delete request';
          return;
        }

        await loadCommissions();
      });
    });
  }
  function formatPrice(cents) { return cents == null ? '—' : `$${(Number(cents)/100).toFixed(2)}`; }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
  boot();
})();
