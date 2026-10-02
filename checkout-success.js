(async () => {
  const title = document.getElementById('resultTitle');
  const message = document.getElementById('resultMessage');
  const list = document.getElementById('downloadList');
  const expiry = document.getElementById('expiryNote');
  const sessionId = new URLSearchParams(location.search).get('session_id');

  if (!sessionId) {
    title.textContent = 'Checkout session missing';
    message.textContent = 'This page needs the Stripe checkout session ID to verify a purchase.';
    return;
  }

  try {
    const response = await fetch(`/api/order?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not verify this purchase.');

    title.textContent = 'Your mesh is ready';
    message.textContent = `${data.product} · ${capitalize(data.licenseType)} license`;

    if (!data.hasFiles || !data.bundleUrl) {
      list.innerHTML = '<p>No mesh files are attached to this listing yet.</p>';
    } else {
      list.innerHTML = `<a class="download-button" href="${escapeAttr(data.bundleUrl)}">Download ZIP</a>`;
      expiry.hidden = false;
      expiry.textContent = `Your ZIP includes the purchased product files plus the ${capitalize(data.licenseType)} license.`;
    }
  } catch (error) {
    title.textContent = 'We could not unlock the download';
    message.textContent = error.message || String(error);
  }

  function capitalize(value='') { return value ? value[0].toUpperCase() + value.slice(1) : ''; }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
  function escapeAttr(value='') { return escapeHtml(value); }
})();
