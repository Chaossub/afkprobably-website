(() => {
  const cfg = window.AFK_CONFIG || {};
  const authCard = document.getElementById('libraryAuth');
  const libraryView = document.getElementById('libraryView');
  const loginForm = document.getElementById('libraryLoginForm');
  const createAccountBtn = document.getElementById('createAccountBtn');
  const authMessage = document.getElementById('libraryAuthMessage');
  const emailInput = document.getElementById('libraryEmail');
  const passwordInput = document.getElementById('libraryPassword');
  const grid = document.getElementById('libraryGrid');
  const empty = document.getElementById('libraryEmpty');
  const emailLabel = document.getElementById('libraryEmailLabel');
  const signOutBtn = document.getElementById('librarySignOut');

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
    authMessage.textContent = 'Account login is not configured yet.';
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    await renderSession(session);
    sb.auth.onAuthStateChange(async (_event, nextSession) => renderSession(nextSession));
  }

  async function renderSession(session) {
    const signedIn = Boolean(session);
    authCard.hidden = signedIn;
    libraryView.hidden = !signedIn;
    if (!signedIn) return;
    emailLabel.textContent = session.user.email || '';
    await loadLibrary(session.access_token);
  }

  async function loadLibrary(token) {
    grid.innerHTML = '<p>Loading your purchases…</p>';
    empty.hidden = true;
    const response = await fetch('/api/library', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      grid.innerHTML = `<p>${escapeHtml(data.error || 'Could not load your library.')}</p>`;
      return;
    }
    const purchases = data.purchases || [];
    if (!purchases.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    grid.innerHTML = purchases.map(item => {
      const product = item.product || {};
      const image = product.images?.[0]?.public_url;
      const downloads = (item.downloads || []).map(file => `<a class="download-button" href="${escapeAttr(file.url)}">Download ${escapeHtml(file.name)}</a>`).join('');
      return `<article class="library-card">
        <div class="library-card-image">${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(product.name || '')}">` : `<img class="placeholder-moon" src="assets/moon-mark.png" alt="">`}</div>
        <div class="library-card-body">
          ${product.category ? `<p class="card-category">${escapeHtml(product.category)}</p>` : ''}
          <h2>${escapeHtml(product.name || 'Purchased mesh')}</h2>
          <span class="owned-pill">${capitalize(item.licenseType)} license · Owned</span>
          <div class="library-downloads">${downloads || '<p>No files are attached to this mesh yet.</p>'}</div>
          <a class="secondary-link" href="product.html?id=${encodeURIComponent(product.id || '')}">View product</a>
        </div>
      </article>`;
    }).join('');
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    authMessage.textContent = 'Signing in…';
    const { error } = await sb.auth.signInWithPassword({ email: emailInput.value.trim(), password: passwordInput.value });
    authMessage.textContent = error ? error.message : '';
  });

  createAccountBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || password.length < 6) {
      authMessage.textContent = 'Enter your email and a password of at least 6 characters first.';
      return;
    }
    authMessage.textContent = 'Creating account…';
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { authMessage.textContent = error.message; return; }
    authMessage.textContent = data.session ? 'Account created.' : 'Account created. Check your email if Supabase requires confirmation, then sign in.';
  });

  signOutBtn.addEventListener('click', () => sb.auth.signOut());

  function capitalize(value='') { return value ? value[0].toUpperCase() + value.slice(1) : ''; }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
  function escapeAttr(value='') { return escapeHtml(value); }
  boot();
})();
