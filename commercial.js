(async () => {
  const cfg = window.AFK_CONFIG || {};
  const locked = document.getElementById('lockedView');
  const view = document.getElementById('commercialView');
  const plansEl = document.getElementById('commercialPlans');
  const statusEl = document.getElementById('commercialStatus');
  const badge = document.getElementById('previewBadge');
  let session = null;
  let sb = null;
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) { sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); session = (await sb.auth.getSession()).data.session; }
  const headers = session ? { authorization:`Bearer ${session.access_token}` } : {};
  const response = await fetch('/api/commercial-plans', { headers, cache:'no-store' });
  if (!response.ok) { locked.hidden = false; return; }
  const data = await response.json();
  view.hidden = false; if (data.preview) badge.hidden = false;

  let status = null;
  if (session) {
    const sr = await fetch('/api/commercial-status', { headers, cache:'no-store' });
    if (sr.ok) status = await sr.json();
  }
  renderStatus();
  renderPlans(data.plans || []);

  function renderStatus() {
    if (!session) { statusEl.innerHTML = '<strong>Already have an AFKProbably account?</strong><p>Sign in through <a href="library.html">My Library</a> before buying a commercial license so it stays attached to your account.</p>'; return; }
    if (status?.lifetime) { statusEl.innerHTML = '<strong>Lifetime Commercial License · Active</strong><p>Your account has permanent shop-wide commercial rights for AFKProbably meshes you purchase, plus 10% off AFKProbably digital files.</p>'; return; }
    if (status?.monthly?.active) {
      const until = status.monthly.currentPeriodEnd ? new Date(status.monthly.currentPeriodEnd * 1000).toLocaleDateString() : '';
      statusEl.innerHTML = `<strong>Monthly Commercial License · Active</strong><p>${until ? `Current paid period through ${escapeHtml(until)}.` : 'Your subscription is active.'} Your active monthly license also gives you 5% off AFKProbably digital files.</p>${status.monthly.canManage ? '<button id="manageCommercial" class="secondary-button" type="button">Manage subscription</button>' : ''}`;
      document.getElementById('manageCommercial')?.addEventListener('click', manageSubscription);
      return;
    }
    statusEl.innerHTML = `<strong>Signed in as ${escapeHtml(session.user.email || '')}</strong><p>No active commercial license is attached to this account yet.</p>`;
  }

  function renderPlans(plans) {
    if (!plans.length) { plansEl.innerHTML = '<article class="info-card"><h2>Pricing coming soon</h2><p>Commercial plan prices have not been set yet.</p></article>'; return; }
    plansEl.innerHTML = plans.map(plan => {
      const isMonthly = plan.plan_type === 'monthly';
      const owned = status?.lifetime || (isMonthly && status?.monthly?.active);
      const label = isMonthly ? 'Monthly Commercial' : 'Lifetime Commercial';
      const copy = isMonthly
        ? 'Recurring shop-wide commercial rights while your subscription is active. Includes 5% off AFKProbably digital files and automatically renews monthly until canceled.'
        : 'One payment for ongoing shop-wide commercial rights. Includes 10% off AFKProbably digital files with no recurring charges.';
      return `<article class="info-card ${isMonthly ? '' : 'featured'}"><p class="eyebrow">${isMonthly ? 'MONTHLY' : 'LIFETIME'}</p><h2>${label}</h2><p>${copy}</p><div class="commercial-plan-price">${formatPrice(plan.price_cents)}${isMonthly ? '<small>/month</small>' : ''}</div>${owned ? '<span class="owned-pill">Covered by your active license</span>' : `<button class="buy-button commercial-buy" data-plan="${plan.plan_type}" type="button">${data.preview ? 'Test checkout' : 'Buy license'}</button>`}</article>`;
    }).join('');
    document.querySelectorAll('.commercial-buy').forEach(btn => btn.addEventListener('click', () => startCheckout(btn)));
  }

  async function startCheckout(button) {
    if (!session) { location.href = 'library.html'; return; }
    const old = button.textContent; button.disabled = true; button.textContent = 'Opening Stripe…';
    try {
      const r = await fetch('/api/create-commercial-checkout', { method:'POST', headers:{ 'content-type':'application/json', authorization:`Bearer ${session.access_token}` }, body:JSON.stringify({ planType:button.dataset.plan }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not start checkout.'); location.href = d.url;
    } catch (e) { alert(e.message || String(e)); button.disabled = false; button.textContent = old; }
  }

  async function manageSubscription() {
    const r = await fetch('/api/create-billing-portal', { method:'POST', headers:{ authorization:`Bearer ${session.access_token}` } });
    const d = await r.json(); if (!r.ok) { alert(d.error || 'Could not open subscription management.'); return; } location.href = d.url;
  }
  function formatPrice(cents) { return `$${(Number(cents)/100).toFixed(2)}`; }
  function escapeHtml(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
})();
