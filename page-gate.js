(async () => {
  const cfg = window.AFK_CONFIG || {};
  let session = null;
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    session = (await sb.auth.getSession()).data.session;
  }
  const headers = session ? { authorization: `Bearer ${session.access_token}` } : {};
  const response = await fetch('/api/shop-state', { headers, cache:'no-store' });
  if (!response.ok) { document.getElementById('lockedView').hidden = false; return; }
  const state = await response.json();
  document.getElementById('pageView').hidden = false;
  if (state.preview) {
    const badge = document.getElementById('previewBadge');
    const admin = document.getElementById('adminNav');
    if (badge) badge.hidden = false;
    if (admin) admin.hidden = false;
  }
})();
