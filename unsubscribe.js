(() => {
  const message = document.getElementById('unsubscribeMessage');
  const cfg = window.AFK_CONFIG || {};
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    message.textContent = 'This unsubscribe link is incomplete. You can also sign in to My Library and change your email preference there.';
    return;
  }

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
    message.textContent = 'Email preferences are temporarily unavailable.';
    return;
  }

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  (async () => {
    const { data, error } = await sb.rpc('unsubscribe_marketing', { token });

    if (error) {
      message.textContent = 'We could not update that preference. You can sign in to My Library and turn promotional emails off there.';
      return;
    }

    message.textContent = data
      ? 'You’ve been unsubscribed from new print and shop update emails. You will still receive necessary order, commission, security, and password emails.'
      : 'This address is already unsubscribed, or the unsubscribe link has expired.';
  })();
})();
