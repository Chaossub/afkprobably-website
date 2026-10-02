(async () => {
  const cfg = window.AFK_CONFIG || {};
  let session = null;
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    session = (await sb.auth.getSession()).data.session;
  }
  const authHeaders = session ? { authorization: `Bearer ${session.access_token}` } : {};
  const stateResponse = await fetch('/api/shop-state', { headers: authHeaders, cache:'no-store' });
  if (!stateResponse.ok) { document.getElementById('lockedView').hidden = false; return; }
  const state = await stateResponse.json();
  document.getElementById('pageView').hidden = false;
  if (state.preview) {
    document.getElementById('previewBadge').hidden = false;
  }

  const form = document.getElementById('commissionForm');
  const message = document.getElementById('commissionMessage');
  const submit = document.getElementById('commissionSubmit');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = 'Sending…';
    try {
      const payload = {
        name: document.getElementById('commissionName').value.trim(),
        email: document.getElementById('commissionEmail').value.trim(),
        projectType: document.getElementById('commissionType').value,
        budget: document.getElementById('commissionBudget').value.trim(),
        deadline: document.getElementById('commissionDeadline').value || null,
        referenceLinks: document.getElementById('commissionReferences').value.trim(),
        description: document.getElementById('commissionDescription').value.trim(),
        website: document.getElementById('commissionWebsite').value
      };
      const response = await fetch('/api/commission', { method:'POST', headers:{ 'content-type':'application/json', ...authHeaders }, body:JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send request.');
      form.reset();
      message.textContent = state.preview ? 'Test request saved ✓' : 'Request sent ✓ I’ll review it before any work begins.';
    } catch (error) {
      message.textContent = error.message || String(error);
    } finally {
      submit.disabled = false;
    }
  });
})();
