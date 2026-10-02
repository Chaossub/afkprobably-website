(async () => {
  const title = document.getElementById('resultTitle'); const message = document.getElementById('resultMessage');
  const cfg = window.AFK_CONFIG || {}; const id = new URLSearchParams(location.search).get('session_id');
  if (!id || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) { title.textContent='Could not verify license'; message.textContent='Missing checkout or account information.'; return; }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); const session = (await sb.auth.getSession()).data.session;
  if (!session) { title.textContent='Sign in to finish'; message.innerHTML='Sign in through <a href="library.html">My Library</a> with the same account used for checkout, then return to this page.'; return; }
  try { const r = await fetch(`/api/commercial-license-result?session_id=${encodeURIComponent(id)}`, { headers:{ authorization:`Bearer ${session.access_token}` }, cache:'no-store' }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not verify commercial license.'); title.textContent = `${d.planLabel} is active`; message.textContent = d.planType === 'monthly' ? 'Your shop-wide commercial rights are active while the subscription remains active.' : 'Your account now has a Lifetime Commercial License for AFKProbably meshes you purchase.'; } catch(e) { title.textContent='We could not activate the license'; message.textContent=e.message || String(e); }
})();
