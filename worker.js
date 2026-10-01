const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/shop-state' && request.method === 'GET') return shopState(request, env);
    if (url.pathname === '/api/catalog' && request.method === 'GET') return getCatalog(request, env);
    if (url.pathname === '/api/product' && request.method === 'GET') return getProductPage(request, env, url);
    if (url.pathname === '/api/commission' && request.method === 'POST') return createCommission(request, env);
    if (url.pathname === '/api/create-checkout' && request.method === 'POST') return createCheckout(request, env, url);
    if (url.pathname === '/api/order' && request.method === 'GET') return getOrder(request, env, url);
    if (url.pathname === '/api/library' && request.method === 'GET') return getLibrary(request, env);
    if (url.pathname === '/api/ownership' && request.method === 'GET') return getOwnership(request, env, url);
    if (url.pathname === '/api/stripe-webhook' && request.method === 'POST') return stripeWebhook(request, env);

    return env.ASSETS.fetch(request);
  }
};

async function shopState(request, env) {
  try {
    assertServerConfig(env);
    const live = isShopLive(env);
    if (live) return json({ live: true, preview: false });
    const user = await requireAdmin(request, env);
    if (!user) return json({ error: 'Shop not launched.' }, 404);
    return json({ live: false, preview: true });
  } catch (error) {
    return json({ error: safeMessage(error) }, 500);
  }
}

async function getCatalog(request, env) {
  try {
    assertServerConfig(env);
    const live = isShopLive(env);
    let preview = false;
    if (!live) {
      const user = await requireAdmin(request, env);
      if (!user) return json({ error: 'Shop not launched.' }, 404);
      preview = true;
    }

    const statusFilter = live ? '&status=eq.published' : '';
    const rows = await supabaseRest(env,
      `products?select=id,name,slug,category,description,personal_price_cents,commercial_price_cents,status,created_at,product_images(id,public_url,sort_order)&order=created_at.desc${statusFilter}`
    );
    const products = rows.map(normalizeProductImages);
    return json({ preview, products });
  } catch (error) {
    return json({ error: safeMessage(error) }, 500);
  }
}

async function getProductPage(request, env, url) {
  try {
    assertServerConfig(env);
    const id = url.searchParams.get('id') || '';
    if (!isUuid(id)) return json({ error: 'Invalid product.' }, 400);

    const live = isShopLive(env);
    let preview = false;
    if (!live) {
      const user = await requireAdmin(request, env);
      if (!user) return json({ error: 'Shop not launched.' }, 404);
      preview = true;
    }

    const statusFilter = live ? '&status=eq.published' : '';
    const rows = await supabaseRest(env,
      `products?id=eq.${encodeURIComponent(id)}&select=id,name,slug,category,description,print_notes,personal_price_cents,commercial_price_cents,status,product_images(id,public_url,sort_order)${statusFilter}`
    );
    if (!rows[0]) return json({ error: 'Product not found.' }, 404);
    return json({ preview, product: normalizeProductImages(rows[0]) });
  } catch (error) {
    return json({ error: safeMessage(error) }, 500);
  }
}

async function createCommission(request, env) {
  try {
    assertServerConfig(env);
    const live = isShopLive(env);
    if (!live) {
      const user = await requireAdmin(request, env);
      if (!user) return json({ error: 'Commissions are not open yet.' }, 401);
    }

    const body = await request.json();
    if (body.website) return json({ ok: true }); // honeypot

    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 200).toLowerCase();
    const projectType = cleanText(body.projectType, 120);
    const budget = cleanText(body.budget, 100) || null;
    const deadline = cleanDate(body.deadline);
    const referenceLinks = cleanText(body.referenceLinks, 1000) || null;
    const description = cleanText(body.description, 5000);

    if (name.length < 2) return json({ error: 'Please enter your name.' }, 400);
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Please enter a valid email.' }, 400);
    if (!projectType) return json({ error: 'Please choose a project type.' }, 400);
    if (description.length < 10) return json({ error: 'Please include a little more detail about the project.' }, 400);

    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/commission_requests`, {
      method: 'POST',
      headers: serviceHeaders(env, { 'content-type': 'application/json', 'prefer': 'return=minimal' }),
      body: JSON.stringify({
        name,
        email,
        project_type: projectType,
        budget,
        desired_deadline: deadline,
        reference_links: referenceLinks,
        description,
        status: 'new'
      })
    });
    if (!response.ok) throw new Error(`Could not save commission request: ${await response.text()}`);
    return json({ ok: true });
  } catch (error) {
    return json({ error: safeMessage(error) }, 500);
  }
}

async function createCheckout(request, env, url) {
  try {
    assertServerConfig(env);

    if (!isShopLive(env)) {
      const user = await requireAdmin(request, env);
      if (!user) return json({ error: 'Private shop preview only.' }, 401);
    }

    const body = await request.json();
    const productId = String(body.productId || '');
    const licenseType = body.licenseType === 'commercial' ? 'commercial' : 'personal';
    if (!isUuid(productId)) return json({ error: 'Invalid product.' }, 400);

    const product = await getProduct(env, productId);
    if (!product) return json({ error: 'Product not found.' }, 404);

    if (isShopLive(env) && product.status !== 'published') {
      return json({ error: 'This product is not available.' }, 404);
    }

    const amount = licenseType === 'commercial'
      ? product.commercial_price_cents
      : product.personal_price_cents;

    if (!Number.isInteger(amount) || amount < 50) {
      return json({ error: 'This license needs a valid price of at least $0.50 before checkout.' }, 400);
    }

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('managed_payments[enabled]', 'false');
    params.set('success_url', `${url.origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${url.origin}/product.html?id=${encodeURIComponent(product.id)}`);
    params.set('customer_creation', 'always');
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', String(amount));
    params.set('line_items[0][price_data][product_data][name]', `${product.name} — ${capitalize(licenseType)} License`);
    params.set('line_items[0][price_data][product_data][description]', licenseType === 'commercial'
      ? 'Commercial-use license for physical prints. Digital file redistribution is not included.'
      : 'Personal-use license for this digital 3D-print mesh.');
    params.set('metadata[product_id]', product.id);
    params.set('metadata[license_type]', licenseType);

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const session = await stripeResponse.json();
    if (!stripeResponse.ok) {
      return json({ error: session?.error?.message || 'Stripe could not create checkout.' }, 502);
    }

    return json({ url: session.url });
  } catch (error) {
    return json({ error: safeMessage(error) }, 500);
  }
}

async function getOrder(_request, env, url) {
  try {
    assertServerConfig(env);
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId || !sessionId.startsWith('cs_')) return json({ error: 'Missing checkout session.' }, 400);

    const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { 'authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok) return json({ error: session?.error?.message || 'Could not verify payment.' }, 502);
    if (session.payment_status !== 'paid') return json({ error: 'Payment has not been confirmed yet.' }, 402);

    const productId = session.metadata?.product_id;
    const licenseType = session.metadata?.license_type;
    if (!isUuid(productId) || !['personal','commercial'].includes(licenseType)) {
      return json({ error: 'Checkout metadata is incomplete.' }, 500);
    }

    const product = await getProduct(env, productId);
    if (!product) return json({ error: 'Purchased product no longer exists.' }, 404);

    await upsertOrder(env, session);
    const files = await getProductFiles(env, productId);
    const downloads = [];
    for (const file of files) {
      downloads.push({ name: file.original_name, url: await createSignedDownload(env, file.storage_path) });
    }

    return json({
      paid: true,
      product: product.name,
      licenseType,
      amountTotal: session.amount_total,
      customerEmail: session.customer_details?.email || session.customer_email || null,
      downloads,
      expiresInSeconds: 600
    });
  } catch (error) {
    return json({ error: safeMessage(error) }, 500);
  }
}

async function getLibrary(request, env) {
  try {
    assertServerConfig(env);
    const user = await requireUser(request, env);
    if (!user?.email) return json({ error: 'Please sign in to view your library.' }, 401);

    const email = String(user.email).trim().toLowerCase();
    const orders = await supabaseRest(env,
      `orders?customer_email=ilike.${encodeURIComponent(email)}&payment_status=eq.paid&select=id,product_id,license_type,amount_total_cents,created_at,products(id,name,slug,category,description,product_images(id,public_url,sort_order))&order=created_at.desc`
    );

    const seen = new Set();
    const purchases = [];
    for (const order of orders) {
      const key = `${order.product_id}:${order.license_type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const product = order.products ? normalizeProductImages(order.products) : null;
      if (!product) continue;
      const files = await getProductFiles(env, order.product_id);
      const downloads = [];
      for (const file of files) {
        downloads.push({ name: file.original_name, url: await createSignedDownload(env, file.storage_path) });
      }
      purchases.push({
        product,
        licenseType: order.license_type,
        amountTotal: order.amount_total_cents,
        purchasedAt: order.created_at,
        downloads
      });
    }

    return json({ email, purchases, expiresInSeconds: 600 });
  } catch (error) {
    return json({ error: safeMessage(error) }, 500);
  }
}

async function getOwnership(request, env, url) {
  try {
    assertServerConfig(env);
    const user = await requireUser(request, env);
    if (!user?.email) return json({ signedIn: false, owned: [] });
    const productId = url.searchParams.get('product_id') || '';
    if (!isUuid(productId)) return json({ error: 'Invalid product.' }, 400);
    const email = String(user.email).trim().toLowerCase();
    const rows = await supabaseRest(env,
      `orders?customer_email=ilike.${encodeURIComponent(email)}&product_id=eq.${encodeURIComponent(productId)}&payment_status=eq.paid&select=license_type`
    );
    const owned = [...new Set(rows.map(row => row.license_type).filter(type => ['personal','commercial'].includes(type)))];
    return json({ signedIn: true, owned });
  } catch (error) {
    return json({ error: safeMessage(error) }, 500);
  }
}

async function stripeWebhook(request, env) {
  try {
    if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook secret not configured.' }, 503);
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') || '';
    const valid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return json({ error: 'Invalid webhook signature.' }, 400);

    const event = JSON.parse(body);
    if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
      await upsertOrder(env, event.data.object);
    }
    return json({ received: true });
  } catch (error) {
    return json({ error: safeMessage(error) }, 400);
  }
}

async function requireUser(request, env) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7);
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': env.SUPABASE_PUBLISHABLE_KEY, 'authorization': `Bearer ${token}` }
  });
  if (!response.ok) return null;
  return response.json();
}

async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (!user) return null;
  return String(user.email || '').toLowerCase() === String(env.ADMIN_EMAIL || '').toLowerCase() ? user : null;
}

async function getProduct(env, id) {
  const rows = await supabaseRest(env, `products?id=eq.${encodeURIComponent(id)}&select=id,name,status,personal_price_cents,commercial_price_cents`);
  return rows[0] || null;
}

async function getProductFiles(env, productId) {
  return supabaseRest(env, `product_files?product_id=eq.${encodeURIComponent(productId)}&select=storage_path,original_name&order=created_at.asc`);
}

async function upsertOrder(env, session) {
  const payload = {
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    product_id: session.metadata?.product_id,
    license_type: session.metadata?.license_type,
    amount_total_cents: session.amount_total ?? null,
    customer_email: session.customer_details?.email || session.customer_email || null,
    payment_status: session.payment_status || 'paid'
  };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/orders?on_conflict=stripe_checkout_session_id`, {
    method: 'POST',
    headers: serviceHeaders(env, { 'content-type': 'application/json', 'prefer': 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Could not record order: ${await response.text()}`);
}

async function createSignedDownload(env, storagePath) {
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/mesh-files/${encodedPath}`, {
    method: 'POST',
    headers: serviceHeaders(env, { 'content-type': 'application/json' }),
    body: JSON.stringify({ expiresIn: 600 })
  });
  const data = await response.json();
  if (!response.ok || !data.signedURL) throw new Error(data.message || data.error || 'Could not create download link.');
  return `${env.SUPABASE_URL}/storage/v1${data.signedURL}${data.signedURL.includes('?') ? '&' : '?'}download=1`;
}

async function supabaseRest(env, query) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${query}`, { headers: serviceHeaders(env) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || 'Database request failed.');
  return data;
}

function serviceHeaders(env, extra = {}) {
  return { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, ...extra };
}

function assertServerConfig(env) {
  const needed = ['STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
  const missing = needed.filter(key => !env[key]);
  if (missing.length) throw new Error(`Server setup incomplete: ${missing.join(', ')}`);
}

function isShopLive(env) { return String(env.SHOP_LIVE).toLowerCase() === 'true'; }
function normalizeProductImages(product) {
  return { ...product, images: [...(product.product_images || [])].sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)), product_images: undefined };
}
function cleanText(value, max) { return String(value || '').trim().slice(0, max); }
function cleanDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null; }

async function verifyStripeSignature(payload, header, secret) {
  const entries = header.split(',').map(x => x.trim());
  const timestamp = entries.find(x => x.startsWith('t='))?.slice(2);
  const signatures = entries.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(signed)].map(b => b.toString(16).padStart(2, '0')).join('');
  return signatures.some(sig => constantTimeEqual(expected, sig));
}

function constantTimeEqual(a, b) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || ''); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function safeMessage(error) { return error instanceof Error ? error.message : 'Unexpected server error.'; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }
