const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      url.pathname === '/api/shop-state' &&
      request.method === 'GET'
    ) {
      return shopState(request, env);
    }

    if (
      url.pathname === '/api/catalog' &&
      request.method === 'GET'
    ) {
      return getCatalog(request, env);
    }

    if (
      url.pathname === '/api/product' &&
      request.method === 'GET'
    ) {
      return getProductPage(request, env, url);
    }

    if (
      url.pathname === '/api/commission' &&
      request.method === 'POST'
    ) {
      return createCommission(request, env);
    }

    if (
      url.pathname === '/api/create-checkout' &&
      request.method === 'POST'
    ) {
      return createCheckout(request, env, url);
    }

    if (
      url.pathname === '/api/order' &&
      request.method === 'GET'
    ) {
      return getOrder(request, env, url);
    }

    if (
      url.pathname === '/api/library' &&
      request.method === 'GET'
    ) {
      return getLibrary(request, env);
    }

    if (
      url.pathname === '/api/library-download' &&
      request.method === 'GET'
    ) {
      return downloadLibraryBundle(request, env, url);
    }

    if (
      url.pathname === '/api/order-download' &&
      request.method === 'GET'
    ) {
      return downloadOrderBundle(request, env, url);
    }

    if (
      url.pathname === '/api/ownership' &&
      request.method === 'GET'
    ) {
      return getOwnership(request, env, url);
    }

    if (
      url.pathname === '/api/commercial-plans' &&
      request.method === 'GET'
    ) {
      return getCommercialPlans(request, env);
    }

    if (
      url.pathname === '/api/commercial-status' &&
      request.method === 'GET'
    ) {
      return getCommercialStatus(request, env);
    }

    if (
      url.pathname === '/api/create-commercial-checkout' &&
      request.method === 'POST'
    ) {
      return createCommercialCheckout(request, env, url);
    }

    if (
      url.pathname === '/api/commercial-license-result' &&
      request.method === 'GET'
    ) {
      return getCommercialLicenseResult(request, env, url);
    }

    if (
      url.pathname === '/api/create-billing-portal' &&
      request.method === 'POST'
    ) {
      return createBillingPortal(request, env, url);
    }

    if (
      url.pathname === '/api/admin/commission-email' &&
      request.method === 'POST'
    ) {
      return adminCommissionEmail(request, env);
    }

    if (
      url.pathname === '/api/admin/commission-payment' &&
      request.method === 'POST'
    ) {
      return adminCommissionPayment(request, env, url);
    }

    if (
      url.pathname === '/api/stripe-webhook' &&
      request.method === 'POST'
    ) {
      return stripeWebhook(request, env);
    }

    if (
      url.pathname === '/api/admin/remove-product' &&
      request.method === 'POST'
    ) {
      return removeProductAdmin(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function removeProductAdmin(request, env) {
  try {
    assertServerConfig(env);

    const admin = await requireAdmin(request, env);

    if (!admin) {
      return json(
        { error: 'Admin access required.' },
        403
      );
    }

    const body = await request.json();

    const productId = String(
      body.productId || ''
    );

    if (!isUuid(productId)) {
      return json(
        { error: 'Invalid product.' },
        400
      );
    }

    const orders = await supabaseRest(
      env,
      `orders?product_id=eq.${encodeURIComponent(
        productId
      )}&select=id&limit=1`
    );

    if (orders.length) {
      const response = await fetch(
        `${env.SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(
          productId
        )}`,
        {
          method: 'PATCH',

          headers: serviceHeaders(env, {
            'content-type': 'application/json',
            prefer: 'return=minimal'
          }),

          body: JSON.stringify({
            status: 'hidden',
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          `Could not hide purchased product: ${await response.text()}`
        );
      }

      return json({
        ok: true,
        action: 'hidden'
      });
    }

    for (const table of [
      'product_images',
      'product_files'
    ]) {
      const response = await fetch(
        `${env.SUPABASE_URL}/rest/v1/${table}?product_id=eq.${encodeURIComponent(
          productId
        )}`,
        {
          method: 'DELETE',

          headers: serviceHeaders(env, {
            prefer: 'return=minimal'
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          `Could not remove ${table}: ${await response.text()}`
        );
      }
    }

    const productResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(
        productId
      )}`,
      {
        method: 'DELETE',

        headers: serviceHeaders(env, {
          prefer: 'return=minimal'
        })
      }
    );

    if (!productResponse.ok) {
      throw new Error(
        `Could not delete product: ${await productResponse.text()}`
      );
    }

    return json({
      ok: true,
      action: 'deleted'
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function shopState(request, env) {
  try {
    assertServerConfig(env);

    const live = isShopLive(env);

    if (live) {
      return json({
        live: true,
        preview: false
      });
    }

    const user = await requireAdmin(
      request,
      env
    );

    if (!user) {
      return json(
        { error: 'Shop not launched.' },
        404
      );
    }

    return json({
      live: false,
      preview: true
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function getCatalog(request, env) {
  try {
    assertServerConfig(env);

    const live = isShopLive(env);

    let preview = false;

    if (!live) {
      const user = await requireAdmin(
        request,
        env
      );

      if (!user) {
        return json(
          { error: 'Shop not launched.' },
          404
        );
      }

      preview = true;
    }

    const statusFilter = live
      ? '&status=eq.published'
      : '';

    const rows = await supabaseRest(
      env,
      `products?select=id,name,slug,category,description,personal_price_cents,commercial_price_cents,status,created_at,product_images(id,public_url,sort_order)&order=created_at.desc${statusFilter}`
    );

    const products =
      rows.map(normalizeProductImages);

    const catalogUser =
      await requireUser(
        request,
        env
      );

    const memberDiscount =
      await getCommercialMemberBenefit(
        env,
        catalogUser?.email
      );

    return json({
      preview,
      products,
      memberDiscount
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function getProductPage(
  request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    const id =
      url.searchParams.get('id') || '';

    if (!isUuid(id)) {
      return json(
        { error: 'Invalid product.' },
        400
      );
    }

    const live =
      isShopLive(env);

    let preview = false;

    if (!live) {
      const user = await requireAdmin(
        request,
        env
      );

      if (!user) {
        return json(
          { error: 'Shop not launched.' },
          404
        );
      }

      preview = true;
    }

    const statusFilter =
      live
        ? '&status=eq.published'
        : '';

    const rows = await supabaseRest(
      env,
      `products?id=eq.${encodeURIComponent(
        id
      )}&select=id,name,slug,category,description,print_notes,personal_price_cents,commercial_price_cents,status,product_images(id,public_url,sort_order)${statusFilter}`
    );

    if (!rows[0]) {
      return json(
        { error: 'Product not found.' },
        404
      );
    }

    const productUser =
      await requireUser(
        request,
        env
      );

    const memberDiscount =
      await getCommercialMemberBenefit(
        env,
        productUser?.email
      );

    return json({
      preview,
      product:
        normalizeProductImages(
          rows[0]
        ),
      memberDiscount
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function createCommission(
  request,
  env
) {
  try {
    assertServerConfig(env);

    const live =
      isShopLive(env);

    if (!live) {
      const user = await requireAdmin(
        request,
        env
      );

      if (!user) {
        return json(
          {
            error:
              'Commissions are not open yet.'
          },
          401
        );
      }
    }

    const body =
      await request.json();

    if (body.website) {
      return json({
        ok: true
      });
    }

    const name =
      cleanText(
        body.name,
        100
      );

    const email =
      cleanText(
        body.email,
        200
      ).toLowerCase();

    const projectType =
      cleanText(
        body.projectType,
        120
      );

    const budget =
      cleanText(
        body.budget,
        100
      ) || null;

    const deadline =
      cleanDate(
        body.deadline
      );

    const referenceLinks =
      cleanText(
        body.referenceLinks,
        1000
      ) || null;

    const description =
      cleanText(
        body.description,
        5000
      );

    if (name.length < 2) {
      return json(
        {
          error:
            'Please enter your name.'
        },
        400
      );
    }

    if (
      !/^\S+@\S+\.\S+$/.test(email)
    ) {
      return json(
        {
          error:
            'Please enter a valid email.'
        },
        400
      );
    }

    if (!projectType) {
      return json(
        {
          error:
            'Please choose a project type.'
        },
        400
      );
    }

    if (
      description.length < 10
    ) {
      return json(
        {
          error:
            'Please include a little more detail about the project.'
        },
        400
      );
    }

    const response =
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/commission_requests`,
        {
          method: 'POST',

          headers:
            serviceHeaders(
              env,
              {
                'content-type':
                  'application/json',

                prefer:
                  'return=minimal'
              }
            ),

          body:
            JSON.stringify({
              name,
              email,
              project_type:
                projectType,
              budget,
              desired_deadline:
                deadline,
              reference_links:
                referenceLinks,
              description,
              status: 'new'
            })
        }
      );

    if (!response.ok) {
      throw new Error(
        `Could not save commission request: ${await response.text()}`
      );
    }

    await sendCommissionNotification(
      env,
      {
        name,
        email,
        projectType,
        budget,
        deadline,
        referenceLinks,
        description
      }
    );

    return json({
      ok: true,
      emailed: true
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function adminCommissionEmail(
  request,
  env
) {
  try {
    assertServerConfig(env);

    const admin =
      await requireAdmin(
        request,
        env
      );

    if (!admin) {
      return json(
        {
          error:
            'Admin access required.'
        },
        403
      );
    }

    const body =
      await request.json();

    const commissionId =
      String(
        body.commissionId || ''
      );

    const subject =
      cleanText(
        body.subject,
        180
      );

    const message =
      cleanText(
        body.message,
        5000
      );

    if (!isUuid(commissionId)) {
      return json(
        {
          error:
            'Invalid commission request.'
        },
        400
      );
    }

    if (!message) {
      return json(
        {
          error:
            'Write a message first.'
        },
        400
      );
    }

    const commission =
      await getCommissionRequest(
        env,
        commissionId
      );

    if (!commission) {
      return json(
        {
          error:
            'Commission request not found.'
        },
        404
      );
    }

    await sendCommissionCustomerEmail(
      env,
      {
        to:
          commission.email,

        customerName:
          commission.name,

        subject:
          subject ||
          `AFKProbably commission — ${
            commission.project_type ||
            commission.name
          }`,

        message
      }
    );

    return json({
      ok: true
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function adminCommissionPayment(
  request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    const admin =
      await requireAdmin(
        request,
        env
      );

    if (!admin) {
      return json(
        {
          error:
            'Admin access required.'
        },
        403
      );
    }

    const body =
      await request.json();

    const commissionId =
      String(
        body.commissionId || ''
      );

    const label =
      cleanText(
        body.label,
        180
      );

    const amountCents =
      Number(
        body.amountCents
      );

    if (!isUuid(commissionId)) {
      return json(
        {
          error:
            'Invalid commission request.'
        },
        400
      );
    }

    if (!label) {
      return json(
        {
          error:
            'Add a payment description.'
        },
        400
      );
    }

    if (
      !Number.isInteger(
        amountCents
      ) ||
      amountCents < 50
    ) {
      return json(
        {
          error:
            'Payment amount must be at least $0.50.'
        },
        400
      );
    }

    const commission =
      await getCommissionRequest(
        env,
        commissionId
      );

    if (!commission) {
      return json(
        {
          error:
            'Commission request not found.'
        },
        404
      );
    }

    const paymentCreate =
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/commission_payments`,
        {
          method: 'POST',

          headers:
            serviceHeaders(
              env,
              {
                'content-type':
                  'application/json',

                prefer:
                  'return=representation'
              }
            ),

          body:
            JSON.stringify({
              commission_id:
                commissionId,

              label,

              amount_cents:
                amountCents,

              status:
                'unpaid'
            })
        }
      );

    const createdRows =
      await paymentCreate
        .json()
        .catch(() => []);

    if (
      !paymentCreate.ok ||
      !createdRows?.[0]?.id
    ) {
      throw new Error(
        `Could not create commission payment: ${
          Array.isArray(
            createdRows
          )
            ? 'No payment row returned.'
            : createdRows?.message ||
              createdRows?.error ||
              'Database error.'
        }`
      );
    }

    const payment =
      createdRows[0];

    const params =
      new URLSearchParams();

    params.set(
      'mode',
      'payment'
    );

    params.set(
      'managed_payments[enabled]',
      'false'
    );

    params.set(
      'success_url',
      `${url.origin}/commissions.html?payment=success`
    );

    params.set(
      'cancel_url',
      `${url.origin}/commissions.html?payment=cancelled`
    );

    params.set(
      'customer_email',
      commission.email
    );

    params.set(
      'line_items[0][quantity]',
      '1'
    );

    params.set(
      'line_items[0][price_data][currency]',
      'usd'
    );

    params.set(
      'line_items[0][price_data][unit_amount]',
      String(amountCents)
    );

    params.set(
      'line_items[0][price_data][product_data][name]',
      `AFKProbably Commission — ${label}`
    );

    params.set(
      'line_items[0][price_data][product_data][description]',
      `Commission payment for ${commission.name}.`
    );

    params.set(
      'metadata[afk_commission]',
      '1'
    );

    params.set(
      'metadata[commission_id]',
      commissionId
    );

    params.set(
      'metadata[commission_payment_id]',
      payment.id
    );

    const stripeResponse =
      await fetch(
        'https://api.stripe.com/v1/checkout/sessions',
        {
          method: 'POST',

          headers: {
            authorization:
              `Bearer ${stripeSecretKey(
                env
              )}`,

            'content-type':
              'application/x-www-form-urlencoded'
          },

          body:
            params
        }
      );

    const session =
      await stripeResponse.json();

    if (
      !stripeResponse.ok ||
      !session?.id ||
      !session?.url
    ) {
      await patchCommissionPayment(
        env,
        payment.id,
        {
          status:
            'cancelled',

          updated_at:
            new Date()
              .toISOString()
        }
      );

      return json(
        {
          error:
            session?.error?.message ||
            'Stripe could not create the commission checkout.'
        },
        502
      );
    }

    await patchCommissionPayment(
      env,
      payment.id,
      {
        stripe_checkout_session_id:
          session.id,

        stripe_checkout_url:
          session.url,

        updated_at:
          new Date()
            .toISOString()
      }
    );

    try {
      await sendCommissionPaymentEmail(
        env,
        {
          to:
            commission.email,

          customerName:
            commission.name,

          label,

          amountCents,

          checkoutUrl:
            session.url
        }
      );
    } catch (emailError) {
      return json(
        {
          error:
            `Stripe checkout was created, but the email failed: ${safeMessage(
              emailError
            )}. Open the commission in Admin and use the saved checkout link.`
        },
        502
      );
    }

    return json({
      ok: true,

      paymentId:
        payment.id,

      checkoutUrl:
        session.url,

      amountCents
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function getCommissionRequest(
  env,
  id
) {
  const rows =
    await supabaseRest(
      env,
      `commission_requests?id=eq.${encodeURIComponent(
        id
      )}&select=id,name,email,project_type,status&limit=1`
    );

  return rows[0] || null;
}

async function patchCommissionPayment(
  env,
  id,
  patch
) {
  const response =
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/commission_payments?id=eq.${encodeURIComponent(
        id
      )}`,
      {
        method: 'PATCH',

        headers:
          serviceHeaders(
            env,
            {
              'content-type':
                'application/json',

              prefer:
                'return=minimal'
            }
          ),

        body:
          JSON.stringify(
            patch
          )
      }
    );

  if (!response.ok) {
    throw new Error(
      `Could not update commission payment: ${await response.text()}`
    );
  }
}

async function markCommissionPaymentPaid(
  env,
  session
) {
  const paymentId =
    String(
      session?.metadata
        ?.commission_payment_id ||
      ''
    );

  if (!isUuid(paymentId)) {
    throw new Error(
      'Commission payment metadata is incomplete.'
    );
  }

  await patchCommissionPayment(
    env,
    paymentId,
    {
      status:
        'paid',

      stripe_checkout_session_id:
        session.id,

      paid_at:
        new Date()
          .toISOString(),

      updated_at:
        new Date()
          .toISOString()
    }
  );
}

async function sendCommissionCustomerEmail(
  env,
  {
    to,
    customerName,
    subject,
    message
  }
) {
  const safeName =
    cleanText(
      customerName,
      100
    ) || 'there';

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#24123a">
      <p>Hi ${escapeHtml(safeName)},</p>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      <p style="margin-top:24px">— AFKProbably Commissions</p>
    </div>
  `;

  return sendResendEmail(
    env,
    {
      to,
      subject,

      text:
        `Hi ${safeName}\n\n${message}\n\n— AFKProbably Commissions`,

      html
    }
  );
}

async function sendCommissionPaymentEmail(
  env,
  {
    to,
    customerName,
    label,
    amountCents,
    checkoutUrl
  }
) {
  const safeName =
    cleanText(
      customerName,
      100
    ) || 'there';

  const amount =
    `$${(
      Number(amountCents) /
      100
    ).toFixed(2)}`;

  const text = [
    `Hi ${safeName},`,
    '',
    'Your AFKProbably commission payment is ready.',
    '',
    `${label}: ${amount}`,
    '',
    `Pay securely with Stripe: ${checkoutUrl}`,
    '',
    'If you have any questions, reply to this email.',
    '',
    '— AFKProbably Commissions'
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#24123a">
      <p>Hi ${escapeHtml(safeName)},</p>

      <p>
        Your AFKProbably commission payment is ready.
      </p>

      <p>
        <strong>${escapeHtml(label)}:</strong>
        ${escapeHtml(amount)}
      </p>

      <p style="margin:24px 0">
        <a
          href="${escapeHtml(checkoutUrl)}"
          style="display:inline-block;padding:12px 18px;border-radius:999px;background:#6b20df;color:#fff;text-decoration:none;font-weight:700"
        >
          Pay commission securely
        </a>
      </p>

      <p>
        If you have any questions, reply to this email.
      </p>

      <p>
        — AFKProbably Commissions
      </p>
    </div>
  `;

  return sendResendEmail(
    env,
    {
      to,

      subject:
        `AFKProbably commission payment — ${label}`,

      text,
      html
    }
  );
}

async function sendResendEmail(
  env,
  {
    to,
    subject,
    text,
    html
  }
) {
  const apiKey =
    String(
      env.RESEND_API_KEY ||
      ''
    ).trim();

  const from =
    String(
      env.COMMISSION_FROM_EMAIL ||
      'AFKProbably Commissions <onboarding@resend.dev>'
    ).trim();

  const replyTo =
    String(
      env.COMMISSION_EMAIL ||
      ''
    ).trim();

  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is missing.'
    );
  }

  if (
    !to ||
    !/^\S+@\S+\.\S+$/.test(
      String(to)
    )
  ) {
    throw new Error(
      'Customer email is invalid.'
    );
  }

  const response =
    await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
          authorization:
            `Bearer ${apiKey}`,

          'content-type':
            'application/json'
        },

        body:
          JSON.stringify({
            from,

            to: [
              String(to)
                .trim()
                .toLowerCase()
            ],

            ...(replyTo
              ? {
                  reply_to:
                    replyTo
                }
              : {}),

            subject,
            text,
            html
          })
      }
    );

  const raw =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Commission email failed (${response.status}): ${raw}`
    );
  }

  let result = null;

  try {
    result =
      raw
        ? JSON.parse(raw)
        : null;
  } catch {}

  if (!result?.id) {
    throw new Error(
      `Commission email was not confirmed by Resend: ${
        raw ||
        'empty response'
      }`
    );
  }

  return result.id;
}

async function createCheckout(
  request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    if (!isShopLive(env)) {
      const user =
        await requireAdmin(
          request,
          env
        );

      if (!user) {
        return json(
          {
            error:
              'Private shop preview only.'
          },
          401
        );
      }
    }

    const body =
      await request.json();

    const productId =
      String(
        body.productId || ''
      );

    const licenseType =
      'personal';

    if (!isUuid(productId)) {
      return json(
        {
          error:
            'Invalid product.'
        },
        400
      );
    }

    const product =
      await getProduct(
        env,
        productId
      );

    if (!product) {
      return json(
        {
          error:
            'Product not found.'
        },
        404
      );
    }

    if (
      isShopLive(env) &&
      product.status !==
        'published'
    ) {
      return json(
        {
          error:
            'This product is not available.'
        },
        404
      );
    }

    const baseAmount =
      product.personal_price_cents;

    if (
      !Number.isInteger(baseAmount) ||
      baseAmount < 50
    ) {
      return json(
        {
          error:
            'This license needs a valid price of at least $0.50 before checkout.'
        },
        400
      );
    }

    const checkoutUser =
      await requireUser(
        request,
        env
      );

    const memberDiscount =
      await getCommercialMemberBenefit(
        env,
        checkoutUser?.email
      );

    const amount =
      applyMemberDiscount(
        baseAmount,
        memberDiscount.percent
      );

    const params =
      new URLSearchParams();

    params.set(
      'mode',
      'payment'
    );

    params.set(
      'managed_payments[enabled]',
      'false'
    );

    params.set(
      'success_url',
      `${url.origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`
    );

    params.set(
      'cancel_url',
      `${url.origin}/product.html?id=${encodeURIComponent(
        product.id
      )}`
    );

    params.set(
      'customer_creation',
      'always'
    );

    if (checkoutUser?.email) {
      params.set(
        'customer_email',
        String(checkoutUser.email)
          .trim()
          .toLowerCase()
      );
    }

    params.set(
      'line_items[0][quantity]',
      '1'
    );

    params.set(
      'line_items[0][price_data][currency]',
      'usd'
    );

    params.set(
      'line_items[0][price_data][unit_amount]',
      String(amount)
    );

    params.set(
      'line_items[0][price_data][product_data][name]',
      `${product.name} — Digital Mesh`
    );

    params.set(
      'line_items[0][price_data][product_data][description]',
      memberDiscount.percent
        ? `${memberDiscount.percent}% ${memberDiscount.plan} commercial member discount applied. Commercial rights follow the active AFKProbably account license.`
        : 'Digital 3D-print mesh purchase. Personal use unless the purchasing account has active AFKProbably commercial rights.'
    );

    params.set(
      'metadata[product_id]',
      product.id
    );

    params.set(
      'metadata[license_type]',
      licenseType
    );

    params.set(
      'metadata[member_discount_percent]',
      String(memberDiscount.percent || 0)
    );

    params.set(
      'metadata[commercial_plan]',
      memberDiscount.plan || 'none'
    );

    const stripeResponse =
      await fetch(
        'https://api.stripe.com/v1/checkout/sessions',
        {
          method: 'POST',

          headers: {
            authorization:
              `Bearer ${stripeSecretKey(
                env
              )}`,

            'content-type':
              'application/x-www-form-urlencoded'
          },

          body:
            params
        }
      );

    const session =
      await stripeResponse.json();

    if (!stripeResponse.ok) {
      return json(
        {
          error:
            session?.error?.message ||
            'Stripe could not create checkout.'
        },
        502
      );
    }

    return json({
      url:
        session.url
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function getOrder(
  _request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    const sessionId =
      url.searchParams.get(
        'session_id'
      );

    if (
      !sessionId ||
      !sessionId.startsWith(
        'cs_'
      )
    ) {
      return json(
        {
          error:
            'Missing checkout session.'
        },
        400
      );
    }

    const stripeResponse =
      await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(
          sessionId
        )}`,
        {
          headers: {
            authorization:
              `Bearer ${stripeSecretKey(
                env
              )}`
          }
        }
      );

    const session =
      await stripeResponse.json();

    if (!stripeResponse.ok) {
      return json(
        {
          error:
            session?.error?.message ||
            'Could not verify payment.'
        },
        502
      );
    }

    if (
      session.payment_status !==
      'paid'
    ) {
      return json(
        {
          error:
            'Payment has not been confirmed yet.'
        },
        402
      );
    }

    const productId =
      session.metadata
        ?.product_id;

    const licenseType =
      session.metadata
        ?.license_type;

    if (
      !isUuid(productId) ||
      ![
        'personal',
        'commercial'
      ].includes(
        licenseType
      )
    ) {
      return json(
        {
          error:
            'Checkout metadata is incomplete.'
        },
        500
      );
    }

    const product =
      await getProduct(
        env,
        productId
      );

    if (!product) {
      return json(
        {
          error:
            'Purchased product no longer exists.'
        },
        404
      );
    }

    await upsertOrder(
      env,
      session
    );

    const customerEmail =
      session.customer_details
        ?.email ||
      session.customer_email ||
      '';

    const effectiveLicenseType =
      await getEffectiveLicenseType(
        env,
        customerEmail,
        licenseType
      );

    const files =
      await getProductFiles(
        env,
        productId
      );

    return json({
      paid: true,

      product:
        product.name,

      licenseType:
        effectiveLicenseType,

      amountTotal:
        session.amount_total,

      customerEmail:
        customerEmail || null,

      hasFiles:
        files.length > 0,

      bundleName:
        `${safeFileStem(product.name)}-${effectiveLicenseType}-license.zip`,

      bundleUrl:
        `/api/order-download?session_id=${encodeURIComponent(sessionId)}`,

      expiresInSeconds:
        null
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function getLibrary(
  request,
  env
) {
  try {
    assertServerConfig(env);

    const user =
      await requireUser(
        request,
        env
      );

    if (!user?.email) {
      return json(
        {
          error:
            'Please sign in to view your library.'
        },
        401
      );
    }

    const email =
      String(
        user.email
      )
        .trim()
        .toLowerCase();

    const orders =
      await supabaseRest(
        env,
        `orders?customer_email=ilike.${encodeURIComponent(
          email
        )}&payment_status=eq.paid&select=id,product_id,license_type,amount_total_cents,created_at,products(id,name,slug,category,description,product_images(id,public_url,sort_order))&order=created_at.desc`
      );

    const seen =
      new Set();

    const purchases = [];

    for (
      const order of orders
    ) {
      const key =
        `${order.product_id}:${order.license_type}`;

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      const product =
        order.products
          ? normalizeProductImages(
              order.products
            )
          : null;

      if (!product) {
        continue;
      }

      const files =
        await getProductFiles(
          env,
          order.product_id
        );

      const effectiveLicenseType =
        await getEffectiveLicenseType(
          env,
          email,
          order.license_type
        );

      purchases.push({
        product,

        licenseType:
          effectiveLicenseType,

        amountTotal:
          order.amount_total_cents,

        purchasedAt:
          order.created_at,

        hasFiles:
          files.length > 0,

        bundleName:
          `${safeFileStem(product.name)}-${effectiveLicenseType}-license.zip`
      });
    }

    return json({
      email,
      purchases,
      expiresInSeconds:
        600
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function downloadLibraryBundle(
  request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    const user =
      await requireUser(
        request,
        env
      );

    if (!user?.email) {
      return json(
        { error: 'Please sign in to download your purchase.' },
        401
      );
    }

    const productId =
      url.searchParams.get('product_id');

    if (!isUuid(productId)) {
      return json(
        { error: 'Invalid download request.' },
        400
      );
    }

    const email =
      String(user.email)
        .trim()
        .toLowerCase();

    const owned =
      await supabaseRest(
        env,
        `orders?customer_email=ilike.${encodeURIComponent(email)}&payment_status=eq.paid&product_id=eq.${encodeURIComponent(productId)}&select=id,license_type&order=created_at.desc&limit=1`
      );

    if (!owned.length) {
      return json(
        { error: 'This purchase is not available on your account.' },
        403
      );
    }

    const effectiveLicenseType =
      await getEffectiveLicenseType(
        env,
        email,
        owned[0].license_type
      );

    return createProductBundleResponse(
      env,
      productId,
      effectiveLicenseType
    );
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function downloadOrderBundle(
  _request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    const sessionId =
      url.searchParams.get('session_id');

    if (
      !sessionId ||
      !sessionId.startsWith('cs_')
    ) {
      return json(
        { error: 'Missing checkout session.' },
        400
      );
    }

    const stripeResponse =
      await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        {
          headers: {
            authorization:
              `Bearer ${stripeSecretKey(env)}`
          }
        }
      );

    const session =
      await stripeResponse.json();

    if (!stripeResponse.ok) {
      return json(
        {
          error:
            session?.error?.message ||
            'Could not verify payment.'
        },
        502
      );
    }

    if (session.payment_status !== 'paid') {
      return json(
        { error: 'Payment has not been confirmed yet.' },
        402
      );
    }

    const productId =
      session.metadata?.product_id;

    const licenseType =
      session.metadata?.license_type;

    if (
      !isUuid(productId) ||
      !['personal', 'commercial'].includes(licenseType)
    ) {
      return json(
        { error: 'Checkout metadata is incomplete.' },
        500
      );
    }

    await upsertOrder(env, session);

    const customerEmail =
      session.customer_details?.email ||
      session.customer_email ||
      '';

    const effectiveLicenseType =
      await getEffectiveLicenseType(
        env,
        customerEmail,
        licenseType
      );

    return createProductBundleResponse(
      env,
      productId,
      effectiveLicenseType
    );
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function getEffectiveLicenseType(
  env,
  email,
  purchasedLicenseType = 'personal'
) {
  if (purchasedLicenseType === 'commercial') {
    return 'commercial';
  }

  const normalizedEmail =
    String(email || '')
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    return 'personal';
  }

  const rows =
    await supabaseRest(
      env,
      `commercial_licenses?customer_email=ilike.${encodeURIComponent(normalizedEmail)}&select=plan_type,status,current_period_end&order=created_at.desc`
    );

  const now = Date.now();

  const hasCommercialRights =
    rows.some(row => {
      if (row.plan_type === 'lifetime') {
        return row.status === 'active';
      }

      if (row.plan_type !== 'monthly') {
        return false;
      }

      if (!['active', 'trialing'].includes(row.status)) {
        return false;
      }

      if (!row.current_period_end) {
        return true;
      }

      const rawPeriodEnd =
        row.current_period_end;

      const numericPeriodEnd =
        Number(rawPeriodEnd);

      const periodEnd =
        Number.isFinite(numericPeriodEnd)
          ? numericPeriodEnd * 1000
          : new Date(rawPeriodEnd).getTime();

      return !Number.isFinite(periodEnd) || periodEnd > now;
    });

  return hasCommercialRights
    ? 'commercial'
    : 'personal';
}

async function getCommercialMemberBenefit(
  env,
  email
) {
  const normalizedEmail =
    String(email || '')
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    return {
      plan: null,
      percent: 0
    };
  }

  const rows =
    await supabaseRest(
      env,
      `commercial_licenses?customer_email=ilike.${encodeURIComponent(normalizedEmail)}&select=plan_type,status,current_period_end&order=created_at.desc`
    );

  const lifetime =
    rows.find(
      row =>
        row.plan_type === 'lifetime' &&
        row.status === 'active'
    );

  if (lifetime) {
    return {
      plan: 'lifetime',
      percent: 10
    };
  }

  const now = Date.now();

  const monthly =
    rows.find(row => {
      if (
        row.plan_type !== 'monthly' ||
        !['active', 'trialing'].includes(row.status)
      ) {
        return false;
      }

      if (!row.current_period_end) {
        return true;
      }

      const numericPeriodEnd =
        Number(row.current_period_end);

      const periodEnd =
        Number.isFinite(numericPeriodEnd)
          ? numericPeriodEnd * 1000
          : new Date(row.current_period_end).getTime();

      return !Number.isFinite(periodEnd) || periodEnd > now;
    });

  if (monthly) {
    return {
      plan: 'monthly',
      percent: 5
    };
  }

  return {
    plan: null,
    percent: 0
  };
}

function applyMemberDiscount(
  amountCents,
  percent
) {
  const safePercent =
    Math.max(
      0,
      Math.min(
        100,
        Number(percent) || 0
      )
    );

  if (!safePercent) {
    return amountCents;
  }

  return Math.max(
    50,
    Math.round(
      amountCents *
      (1 - safePercent / 100)
    )
  );
}

async function createProductBundleResponse(
  env,
  productId,
  licenseType
) {
  const product =
    await getProduct(env, productId);

  if (!product) {
    return json(
      { error: 'Purchased product no longer exists.' },
      404
    );
  }

  const files =
    await getProductFiles(env, productId);

  if (!files.length) {
    return json(
      { error: 'No downloadable files are attached to this product yet.' },
      404
    );
  }

  const archiveName =
    `${safeFileStem(product.name)}-${licenseType}-license.zip`;

  const entries = files.map(file => ({
    name: sanitizeZipEntryName(file.original_name),
    storagePath: file.storage_path
  }));

  entries.push({
    name:
      licenseType === 'commercial'
        ? 'COMMERCIAL-LICENSE.txt'
        : 'PERSONAL-LICENSE.txt',
    text: buildLicenseText(
      product.name,
      licenseType
    )
  });

  return new Response(
    streamZip(env, entries),
    {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition':
          `attachment; filename="${archiveName}"; filename*=UTF-8''${encodeURIComponent(archiveName)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff'
      }
    }
  );
}

function buildLicenseText(
  productName,
  licenseType
) {
  const title =
    String(productName || 'AFKProbably Product');

  if (licenseType === 'commercial') {
    return `AFKProbably Commercial License\n\nProduct: ${title}\n\nThis product is covered by the commercial rights currently active on the purchaser's AFKProbably account. Commercial rights are shop-wide for AFKProbably meshes purchased by that licensed account. The buyer may modify this purchased mesh and manufacture and sell physical prints made from the original or modified version while those commercial rights are valid. Modification does not transfer ownership of the AFKProbably design.\n\nMonthly commercial rights apply only while the subscription remains active. Lifetime commercial rights do not expire unless terminated under the license terms. The commercial license does not unlock products that have not been purchased.\n\nThe digital mesh may not be shared, uploaded, traded, resold, sublicensed, redistributed, or offered as a competing digital file, including modified versions. Purchasing a product or commercial license does not transfer ownership of the underlying digital design.\n\nSee https://afkprobably.com/licenses.html and https://afkprobably.com/terms.html for the current license terms.\n`;
  }

  return `AFKProbably Personal License\n\nProduct: ${title}\n\nThis purchased AFKProbably mesh is licensed for personal use because the purchaser's account does not currently have active shop-wide commercial rights. The buyer may print copies for personal use, give physical prints as gifts, and modify the file for their own personal prints.\n\nPhysical prints made from the mesh may not be sold under this personal license. The digital mesh may not be shared, uploaded, traded, resold, sublicensed, redistributed, or offered as a competing digital file, including modified versions. Purchasing the product does not transfer ownership of the underlying digital design.\n\nCommercial rights are available separately through AFKProbably's shop-wide commercial licensing. See https://afkprobably.com/licenses.html and https://afkprobably.com/terms.html for the current license terms.\n`;
}

function safeFileStem(value) {
  const stem =
    String(value || 'AFKProbably-download')
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-. ]+|[-. ]+$/g, '');

  return stem || 'AFKProbably-download';
}

function sanitizeZipEntryName(value) {
  const name =
    String(value || 'download')
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .pop() || 'download';

  return name
    .replace(/[\x00-\x1F]/g, '')
    .replace(/^\.+$/, 'download');
}

function streamZip(env, entries) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      (async () => {
        let offset = 0;
        const central = [];

        const enqueue = bytes => {
          controller.enqueue(bytes);
          offset += bytes.byteLength;
        };

        for (const entry of entries) {
          const nameBytes =
            encoder.encode(entry.name);

          const localOffset = offset;
          const { dosTime, dosDate } = zipDosDateTime(new Date());
          const flags = 0x0808;

          enqueue(zipLocalHeader(
            nameBytes,
            flags,
            dosTime,
            dosDate
          ));

          let crc = 0xffffffff;
          let size = 0;

          if (Object.prototype.hasOwnProperty.call(entry, 'text')) {
            const bytes = encoder.encode(entry.text);
            crc = crc32Update(crc, bytes);
            size += bytes.byteLength;
            enqueue(bytes);
          } else {
            const response =
              await fetchPrivateMeshFile(
                env,
                entry.storagePath
              );

            if (!response.ok || !response.body) {
              throw new Error(
                `Could not read ${entry.name} from storage.`
              );
            }

            const reader = response.body.getReader();

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (!value?.byteLength) continue;

              crc = crc32Update(crc, value);
              size += value.byteLength;
              enqueue(value);
            }
          }

          crc = (crc ^ 0xffffffff) >>> 0;

          enqueue(zipDataDescriptor(crc, size));

          central.push({
            nameBytes,
            flags,
            dosTime,
            dosDate,
            crc,
            size,
            localOffset
          });
        }

        const centralOffset = offset;

        for (const item of central) {
          enqueue(zipCentralHeader(item));
        }

        const centralSize =
          offset - centralOffset;

        enqueue(zipEndOfCentralDirectory(
          central.length,
          centralSize,
          centralOffset
        ));

        controller.close();
      })().catch(error => {
        controller.error(error);
      });
    }
  });
}

async function fetchPrivateMeshFile(
  env,
  storagePath
) {
  const encodedPath =
    String(storagePath || '')
      .split('/')
      .map(encodeURIComponent)
      .join('/');

  return fetch(
    `${env.SUPABASE_URL}/storage/v1/object/mesh-files/${encodedPath}`,
    {
      headers: serviceHeaders(env)
    }
  );
}

function zipLocalHeader(
  nameBytes,
  flags,
  dosTime,
  dosDate
) {
  const out = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, flags, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, dosTime, true);
  view.setUint16(12, dosDate, true);
  view.setUint32(14, 0, true);
  view.setUint32(18, 0, true);
  view.setUint32(22, 0, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  out.set(nameBytes, 30);
  return out;
}

function zipDataDescriptor(crc, size) {
  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc >>> 0, true);
  view.setUint32(8, size >>> 0, true);
  view.setUint32(12, size >>> 0, true);
  return out;
}

function zipCentralHeader(item) {
  const out = new Uint8Array(46 + item.nameBytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, item.flags, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, item.dosTime, true);
  view.setUint16(14, item.dosDate, true);
  view.setUint32(16, item.crc >>> 0, true);
  view.setUint32(20, item.size >>> 0, true);
  view.setUint32(24, item.size >>> 0, true);
  view.setUint16(28, item.nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, item.localOffset >>> 0, true);
  out.set(item.nameBytes, 46);
  return out;
}

function zipEndOfCentralDirectory(
  count,
  centralSize,
  centralOffset
) {
  const out = new Uint8Array(22);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralSize >>> 0, true);
  view.setUint32(16, centralOffset >>> 0, true);
  view.setUint16(20, 0, true);
  return out;
}

function zipDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    dosTime:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    dosDate:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate()
  };
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1)
        ? (0xedb88320 ^ (c >>> 1))
        : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Update(crc, bytes) {
  let value = crc >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    value =
      CRC32_TABLE[(value ^ bytes[i]) & 0xff] ^
      (value >>> 8);
  }
  return value >>> 0;
}

async function getOwnership(
  request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    const user =
      await requireUser(
        request,
        env
      );

    if (!user?.email) {
      return json({
        signedIn: false,
        owned: []
      });
    }

    const productId =
      url.searchParams.get(
        'product_id'
      ) || '';

    if (!isUuid(productId)) {
      return json(
        {
          error:
            'Invalid product.'
        },
        400
      );
    }

    const email =
      String(
        user.email
      )
        .trim()
        .toLowerCase();

    const rows =
      await supabaseRest(
        env,
        `orders?customer_email=ilike.${encodeURIComponent(
          email
        )}&product_id=eq.${encodeURIComponent(
          productId
        )}&payment_status=eq.paid&select=license_type`
      );

    const owned = [
      ...new Set(
        rows
          .map(
            row =>
              row.license_type
          )
          .filter(type =>
            [
              'personal',
              'commercial'
            ].includes(type)
          )
      )
    ];

    return json({
      signedIn: true,
      owned
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function getCommercialPlans(
  request,
  env
) {
  try {
    assertServerConfig(env);

    const live =
      isShopLive(env);

    let preview = false;

    if (!live) {
      const admin =
        await requireAdmin(
          request,
          env
        );

      if (!admin) {
        return json(
          {
            error:
              'Commercial licensing is not live yet.'
          },
          404
        );
      }

      preview = true;
    }

    const rows =
      await supabaseRest(
        env,
        'commercial_license_plans?select=plan_type,price_cents,active&order=plan_type.asc'
      );

    const plans =
      rows
        .filter(
          row =>
            preview ||
            row.active
        )
        .filter(
          row =>
            Number.isInteger(
              row.price_cents
            ) &&
            row.price_cents >=
              50
        );

    return json({
      preview,
      plans
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function getCommercialStatus(
  request,
  env
) {
  try {
    assertServerConfig(env);

    const user =
      await requireUser(
        request,
        env
      );

    if (!user?.email) {
      return json(
        {
          error:
            'Please sign in first.'
        },
        401
      );
    }

    const email =
      String(
        user.email
      )
        .trim()
        .toLowerCase();

    const rows =
      await supabaseRest(
        env,
        `commercial_licenses?customer_email=ilike.${encodeURIComponent(
          email
        )}&select=id,plan_type,status,current_period_end,stripe_customer_id,stripe_subscription_id,created_at&order=created_at.desc`
      );

    const lifetimeRow =
      rows.find(
        row =>
          row.plan_type ===
            'lifetime' &&
          row.status ===
            'active'
      );

    let monthlyRow =
      rows.find(
        row =>
          row.plan_type ===
          'monthly'
      ) || null;

    if (
      monthlyRow
        ?.stripe_subscription_id
    ) {
      const response =
        await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(
            monthlyRow.stripe_subscription_id
          )}`,
          {
            headers: {
              authorization:
                `Bearer ${stripeSecretKey(
                  env
                )}`
            }
          }
        );

      if (response.ok) {
        const subscription =
          await response.json();

        monthlyRow = {
          ...monthlyRow,

          status:
            subscription.status,

          current_period_end:
            subscription.current_period_end ||
            monthlyRow.current_period_end,

          stripe_customer_id:
            typeof subscription.customer ===
            'string'
              ? subscription.customer
              : monthlyRow.stripe_customer_id
        };

        await patchCommercialLicense(
          env,
          monthlyRow.id,
          {
            status:
              monthlyRow.status,

            current_period_end:
              monthlyRow.current_period_end,

            stripe_customer_id:
              monthlyRow.stripe_customer_id,

            updated_at:
              new Date()
                .toISOString()
          }
        );
      }
    }

    const monthlyActive =
      Boolean(
        monthlyRow &&
        [
          'active',
          'trialing'
        ].includes(
          monthlyRow.status
        )
      );

    return json({
      lifetime:
        Boolean(
          lifetimeRow
        ),

      monthly:
        monthlyRow
          ? {
              active:
                monthlyActive,

              status:
                monthlyRow.status,

              currentPeriodEnd:
                monthlyRow.current_period_end,

              canManage:
                Boolean(
                  monthlyRow.stripe_customer_id
                )
            }
          : null
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function createCommercialCheckout(
  request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    const user =
      await requireUser(
        request,
        env
      );

    if (!user?.email) {
      return json(
        {
          error:
            'Please sign in through My Library first.'
        },
        401
      );
    }

    if (!isShopLive(env)) {
      const admin =
        await requireAdmin(
          request,
          env
        );

      if (!admin) {
        return json(
          {
            error:
              'Private shop preview only.'
          },
          401
        );
      }
    }

    const body =
      await request.json();

    const planType =
      body.planType ===
      'monthly'
        ? 'monthly'
        : body.planType ===
            'lifetime'
          ? 'lifetime'
          : '';

    if (!planType) {
      return json(
        {
          error:
            'Invalid commercial plan.'
        },
        400
      );
    }

    const plans =
      await supabaseRest(
        env,
        `commercial_license_plans?plan_type=eq.${planType}&select=plan_type,price_cents,active`
      );

    const plan =
      plans[0];

    if (
      !plan ||
      !plan.active
    ) {
      return json(
        {
          error:
            'That commercial plan is not available.'
        },
        404
      );
    }

    if (
      !Number.isInteger(
        plan.price_cents
      ) ||
      plan.price_cents <
        50
    ) {
      return json(
        {
          error:
            'Set a valid commercial plan price in Admin first.'
        },
        400
      );
    }

    const email =
      String(
        user.email
      )
        .trim()
        .toLowerCase();

    const params =
      new URLSearchParams();

    params.set(
      'mode',
      planType === 'monthly'
        ? 'subscription'
        : 'payment'
    );

    params.set(
      'managed_payments[enabled]',
      'false'
    );

    params.set(
      'success_url',
      `${url.origin}/commercial-success.html?session_id={CHECKOUT_SESSION_ID}`
    );

    params.set(
      'cancel_url',
      `${url.origin}/commercial.html`
    );

    params.set(
      'customer_email',
      email
    );

    params.set(
      'line_items[0][quantity]',
      '1'
    );

    params.set(
      'line_items[0][price_data][currency]',
      'usd'
    );

    params.set(
      'line_items[0][price_data][unit_amount]',
      String(
        plan.price_cents
      )
    );

    params.set(
      'line_items[0][price_data][product_data][name]',
      planType ===
        'monthly'
        ? 'AFKProbably Monthly Commercial License'
        : 'AFKProbably Lifetime Commercial License'
    );

    params.set(
      'line_items[0][price_data][product_data][description]',
      'Shop-wide commercial rights for physical prints made from AFKProbably meshes purchased by this account. Digital file redistribution is not included.'
    );

    if (
      planType ===
      'monthly'
    ) {
      params.set(
        'line_items[0][price_data][recurring][interval]',
        'month'
      );
    }

    if (
      planType ===
      'lifetime'
    ) {
      params.set(
        'customer_creation',
        'always'
      );
    }

    params.set(
      'metadata[afk_commercial]',
      '1'
    );

    params.set(
      'metadata[plan_type]',
      planType
    );

    params.set(
      'metadata[customer_email]',
      email
    );

    if (
      planType ===
      'monthly'
    ) {
      params.set(
        'subscription_data[metadata][afk_commercial]',
        '1'
      );

      params.set(
        'subscription_data[metadata][plan_type]',
        planType
      );

      params.set(
        'subscription_data[metadata][customer_email]',
        email
      );
    }

    const stripeResponse =
      await fetch(
        'https://api.stripe.com/v1/checkout/sessions',
        {
          method: 'POST',

          headers: {
            authorization:
              `Bearer ${stripeSecretKey(
                env
              )}`,

            'content-type':
              'application/x-www-form-urlencoded'
          },

          body:
            params
        }
      );

    const session =
      await stripeResponse.json();

    if (!stripeResponse.ok) {
      return json(
        {
          error:
            session?.error?.message ||
            'Stripe could not create commercial checkout.'
        },
        502
      );
    }

    return json({
      url:
        session.url
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function getCommercialLicenseResult(
  request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    const user =
      await requireUser(
        request,
        env
      );

    if (!user?.email) {
      return json(
        {
          error:
            'Please sign in first.'
        },
        401
      );
    }

    const sessionId =
      url.searchParams.get(
        'session_id'
      ) || '';

    if (
      !sessionId.startsWith(
        'cs_'
      )
    ) {
      return json(
        {
          error:
            'Missing checkout session.'
        },
        400
      );
    }

    const response =
      await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(
          sessionId
        )}`,
        {
          headers: {
            authorization:
              `Bearer ${stripeSecretKey(
                env
              )}`
          }
        }
      );

    const session =
      await response.json();

    if (!response.ok) {
      return json(
        {
          error:
            session?.error?.message ||
            'Could not verify Stripe checkout.'
        },
        502
      );
    }

    if (
      session.metadata
        ?.afk_commercial !==
      '1'
    ) {
      return json(
        {
          error:
            'This is not a commercial-license checkout.'
        },
        400
      );
    }

    const planType =
      session.metadata
        ?.plan_type;

    if (
      ![
        'monthly',
        'lifetime'
      ].includes(planType)
    ) {
      return json(
        {
          error:
            'Commercial plan metadata is missing.'
        },
        500
      );
    }

    const checkoutEmail =
      String(
        session
          .customer_details
          ?.email ||
        session
          .customer_email ||
        session.metadata
          ?.customer_email ||
        ''
      )
        .trim()
        .toLowerCase();

    const userEmail =
      String(
        user.email
      )
        .trim()
        .toLowerCase();

    if (
      !checkoutEmail ||
      checkoutEmail !==
        userEmail
    ) {
      return json(
        {
          error:
            'Sign in with the same email used for checkout.'
        },
        403
      );
    }

    let record;

    if (
      planType ===
      'monthly'
    ) {
      if (
        !session.subscription
      ) {
        return json(
          {
            error:
              'Stripe subscription was not created.'
          },
          409
        );
      }

      record =
        await commercialRecordFromSubscription(
          env,
          session,
          checkoutEmail
        );

      if (
        ![
          'active',
          'trialing'
        ].includes(
          record.status
        )
      ) {
        return json(
          {
            error:
              `Subscription is ${
                record.status ||
                'not active'
              }.`
          },
          402
        );
      }
    } else {
      if (
        session
          .payment_status !==
        'paid'
      ) {
        return json(
          {
            error:
              'Payment has not been confirmed yet.'
          },
          402
        );
      }

      record = {
        customer_email:
          checkoutEmail,

        plan_type:
          'lifetime',

        stripe_checkout_session_id:
          session.id,

        stripe_customer_id:
          typeof session.customer ===
          'string'
            ? session.customer
            : null,

        stripe_subscription_id:
          null,

        status:
          'active',

        current_period_end:
          null
      };
    }

    await upsertCommercialLicense(
      env,
      record
    );

    return json({
      active: true,

      planType,

      planLabel:
        planType ===
        'monthly'
          ? 'Monthly Commercial License'
          : 'Lifetime Commercial License'
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function createBillingPortal(
  request,
  env,
  url
) {
  try {
    assertServerConfig(env);

    const user =
      await requireUser(
        request,
        env
      );

    if (!user?.email) {
      return json(
        {
          error:
            'Please sign in first.'
        },
        401
      );
    }

    const email =
      String(
        user.email
      )
        .trim()
        .toLowerCase();

    const rows =
      await supabaseRest(
        env,
        `commercial_licenses?customer_email=ilike.${encodeURIComponent(
          email
        )}&stripe_customer_id=not.is.null&select=stripe_customer_id,created_at&order=created_at.desc&limit=1`
      );

    const customerId =
      rows[0]
        ?.stripe_customer_id;

    if (!customerId) {
      return json(
        {
          error:
            'No Stripe subscription customer is attached to this account yet.'
        },
        404
      );
    }

    const params =
      new URLSearchParams();

    params.set(
      'customer',
      customerId
    );

    params.set(
      'return_url',
      `${url.origin}/commercial.html`
    );

    const response =
      await fetch(
        'https://api.stripe.com/v1/billing_portal/sessions',
        {
          method: 'POST',

          headers: {
            authorization:
              `Bearer ${stripeSecretKey(
                env
              )}`,

            'content-type':
              'application/x-www-form-urlencoded'
          },

          body:
            params
        }
      );

    const portal =
      await response.json();

    if (!response.ok) {
      return json(
        {
          error:
            portal?.error?.message ||
            'Could not open Stripe Billing Portal.'
        },
        502
      );
    }

    return json({
      url:
        portal.url
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      500
    );
  }
}

async function commercialRecordFromSubscription(
  env,
  session,
  email
) {
  const response =
    await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(
        session.subscription
      )}`,
      {
        headers: {
          authorization:
            `Bearer ${stripeSecretKey(
              env
            )}`
        }
      }
    );

  const subscription =
    await response.json();

  if (!response.ok) {
    throw new Error(
      subscription?.error?.message ||
      'Could not verify subscription.'
    );
  }

  return {
    customer_email:
      email,

    plan_type:
      'monthly',

    stripe_checkout_session_id:
      session.id,

    stripe_customer_id:
      typeof subscription.customer ===
      'string'
        ? subscription.customer
        : typeof session.customer ===
            'string'
          ? session.customer
          : null,

    stripe_subscription_id:
      subscription.id,

    status:
      subscription.status,

    current_period_end:
      subscription.current_period_end ||
      null
  };
}

async function upsertCommercialLicense(
  env,
  record
) {
  const payload = {
    ...record,

    updated_at:
      new Date()
        .toISOString()
  };

  const response =
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/commercial_licenses?on_conflict=stripe_checkout_session_id`,
      {
        method: 'POST',

        headers:
          serviceHeaders(
            env,
            {
              'content-type':
                'application/json',

              prefer:
                'resolution=merge-duplicates,return=minimal'
            }
          ),

        body:
          JSON.stringify(
            payload
          )
      }
    );

  if (!response.ok) {
    throw new Error(
      `Could not record commercial license: ${await response.text()}`
    );
  }
}

async function patchCommercialLicense(
  env,
  id,
  patch
) {
  if (!id) {
    return;
  }

  const response =
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/commercial_licenses?id=eq.${encodeURIComponent(
        id
      )}`,
      {
        method: 'PATCH',

        headers:
          serviceHeaders(
            env,
            {
              'content-type':
                'application/json',

              prefer:
                'return=minimal'
            }
          ),

        body:
          JSON.stringify(
            patch
          )
      }
    );

  if (!response.ok) {
    throw new Error(
      `Could not update commercial license: ${await response.text()}`
    );
  }
}

async function patchCommercialLicenseBySubscription(
  env,
  subscription
) {
  if (!subscription?.id) {
    return;
  }

  const response =
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/commercial_licenses?stripe_subscription_id=eq.${encodeURIComponent(
        subscription.id
      )}`,
      {
        method: 'PATCH',

        headers:
          serviceHeaders(
            env,
            {
              'content-type':
                'application/json',

              prefer:
                'return=minimal'
            }
          ),

        body:
          JSON.stringify({
            status:
              subscription.status ||
              'inactive',

            current_period_end:
              subscription.current_period_end ||
              null,

            stripe_customer_id:
              typeof subscription.customer ===
              'string'
                ? subscription.customer
                : null,

            updated_at:
              new Date()
                .toISOString()
          })
      }
    );

  if (!response.ok) {
    throw new Error(
      `Could not update subscription status: ${await response.text()}`
    );
  }
}

async function stripeWebhook(
  request,
  env
) {
  try {
    const webhookSecrets =
      stripeWebhookSecrets(
        env
      );

    if (
      !webhookSecrets.length
    ) {
      return json(
        {
          error:
            'Webhook secret not configured.'
        },
        503
      );
    }

    const body =
      await request.text();

    const signature =
      request.headers.get(
        'stripe-signature'
      ) || '';

    let valid = false;

    for (
      const secret of webhookSecrets
    ) {
      if (
        await verifyStripeSignature(
          body,
          signature,
          secret
        )
      ) {
        valid = true;
        break;
      }
    }

    if (!valid) {
      return json(
        {
          error:
            'Invalid webhook signature.'
        },
        400
      );
    }

    const event =
      JSON.parse(body);

    if (
      event.type ===
      'checkout.session.completed'
    ) {
      const session =
        event.data
          ?.object;

      if (
        session
          ?.metadata
          ?.afk_commission ===
        '1'
      ) {
        if (
          session
            .payment_status ===
          'paid'
        ) {
          await markCommissionPaymentPaid(
            env,
            session
          );
        }
      } else if (
        session
          ?.metadata
          ?.afk_commercial ===
        '1'
      ) {
        const email =
          String(
            session
              .customer_details
              ?.email ||
            session
              .customer_email ||
            session
              .metadata
              ?.customer_email ||
            ''
          )
            .trim()
            .toLowerCase();

        if (
          email &&
          session
            .metadata
            ?.plan_type ===
            'lifetime' &&
          session
            .payment_status ===
            'paid'
        ) {
          await upsertCommercialLicense(
            env,
            {
              customer_email:
                email,

              plan_type:
                'lifetime',

              stripe_checkout_session_id:
                session.id,

              stripe_customer_id:
                typeof session.customer ===
                'string'
                  ? session.customer
                  : null,

              stripe_subscription_id:
                null,

              status:
                'active',

              current_period_end:
                null
            }
          );
        } else if (
          email &&
          session
            .metadata
            ?.plan_type ===
            'monthly' &&
          session.subscription
        ) {
          await upsertCommercialLicense(
            env,
            await commercialRecordFromSubscription(
              env,
              session,
              email
            )
          );
        }
      } else if (
        session
          ?.payment_status ===
        'paid'
      ) {
        await upsertOrder(
          env,
          session
        );
      }
    } else if (
      event.type ===
        'customer.subscription.updated' ||
      event.type ===
        'customer.subscription.deleted'
    ) {
      await patchCommercialLicenseBySubscription(
        env,
        event.data
          ?.object
      );
    }

    return json({
      received: true
    });
  } catch (error) {
    return json(
      { error: safeMessage(error) },
      400
    );
  }
}

async function requireUser(
  request,
  env
) {
  const authorization =
    request.headers.get(
      'authorization'
    ) || '';

  if (
    !authorization.startsWith(
      'Bearer '
    )
  ) {
    return null;
  }

  const token =
    authorization.slice(
      7
    );

  const response =
    await fetch(
      `${env.SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey:
            env.SUPABASE_PUBLISHABLE_KEY,

          authorization:
            `Bearer ${token}`
        }
      }
    );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function requireAdmin(
  request,
  env
) {
  const user =
    await requireUser(
      request,
      env
    );

  if (!user) {
    return null;
  }

  return String(
    user.email || ''
  ).toLowerCase() ===
    String(
      env.ADMIN_EMAIL ||
      ''
    ).toLowerCase()
    ? user
    : null;
}

async function getProduct(
  env,
  id
) {
  const rows =
    await supabaseRest(
      env,
      `products?id=eq.${encodeURIComponent(
        id
      )}&select=id,name,status,personal_price_cents,commercial_price_cents`
    );

  return rows[0] || null;
}

async function getProductFiles(
  env,
  productId
) {
  return supabaseRest(
    env,
    `product_files?product_id=eq.${encodeURIComponent(
      productId
    )}&select=storage_path,original_name&order=created_at.asc`
  );
}

async function upsertOrder(
  env,
  session
) {
  const payload = {
    stripe_checkout_session_id:
      session.id,

    stripe_payment_intent_id:
      typeof session.payment_intent ===
      'string'
        ? session.payment_intent
        : null,

    product_id:
      session.metadata
        ?.product_id,

    license_type:
      session.metadata
        ?.license_type,

    amount_total_cents:
      session.amount_total ??
      null,

    customer_email:
      session.customer_details
        ?.email ||
      session.customer_email ||
      null,

    payment_status:
      session.payment_status ||
      'paid'
  };

  const response =
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/orders?on_conflict=stripe_checkout_session_id`,
      {
        method: 'POST',

        headers:
          serviceHeaders(
            env,
            {
              'content-type':
                'application/json',

              prefer:
                'resolution=merge-duplicates,return=minimal'
            }
          ),

        body:
          JSON.stringify(
            payload
          )
      }
    );

  if (!response.ok) {
    throw new Error(
      `Could not record order: ${await response.text()}`
    );
  }
}

async function createSignedDownload(
  env,
  storagePath,
  originalName
) {
  const encodedPath =
    storagePath
      .split('/')
      .map(
        encodeURIComponent
      )
      .join('/');

  const response =
    await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/sign/mesh-files/${encodedPath}`,
      {
        method: 'POST',

        headers:
          serviceHeaders(
            env,
            {
              'content-type':
                'application/json'
            }
          ),

        body:
          JSON.stringify({
            expiresIn:
              600
          })
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.signedURL
  ) {
    throw new Error(
      data.message ||
      data.error ||
      'Could not create download link.'
    );
  }

  return `${env.SUPABASE_URL}/storage/v1${data.signedURL}${
    data.signedURL.includes(
      '?'
    )
      ? '&'
      : '?'
  }download=${encodeURIComponent(
    String(originalName || 'download')
  )}`;
}

async function supabaseRest(
  env,
  query
) {
  const response =
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/${query}`,
      {
        headers:
          serviceHeaders(
            env
          )
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      'Database request failed.'
    );
  }

  return data;
}

function serviceHeaders(
  env,
  extra = {}
) {
  return {
    apikey:
      env.SUPABASE_SERVICE_ROLE_KEY,

    authorization:
      `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,

    ...extra
  };
}

function stripeMode(env) {
  return String(
    env.STRIPE_MODE ||
    'live'
  )
    .trim()
    .toLowerCase() ===
    'test'
    ? 'test'
    : 'live';
}

function stripeSecretKey(env) {
  const mode =
    stripeMode(env);

  const key =
    mode === 'test'
      ? String(
          env.STRIPE_SECRET_KEY_TEST ||
          ''
        ).trim()
      : String(
          env.STRIPE_SECRET_KEY ||
          ''
        ).trim();

  if (!key) {
    throw new Error(
      mode === 'test'
        ? 'Stripe test mode is selected, but STRIPE_SECRET_KEY_TEST is missing.'
        : 'Stripe live mode is selected, but STRIPE_SECRET_KEY is missing.'
    );
  }

  return key;
}

function stripeWebhookSecrets(
  env
) {
  return [
    String(
      env.STRIPE_WEBHOOK_SECRET ||
      ''
    ).trim(),

    String(
      env.STRIPE_WEBHOOK_SECRET_TEST ||
      ''
    ).trim()
  ].filter(Boolean);
}

function assertServerConfig(
  env
) {
  const needed = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY'
  ];

  const missing =
    needed.filter(
      key =>
        !env[key]
    );

  if (
    missing.length
  ) {
    throw new Error(
      `Server setup incomplete: ${missing.join(
        ', '
      )}`
    );
  }
}

function isShopLive(env) {
  return String(
    env.SHOP_LIVE ||
    ''
  )
    .trim()
    .toLowerCase() ===
    'true';
}

async function sendCommissionNotification(
  env,
  commission
) {
  const apiKey =
    String(
      env.RESEND_API_KEY ||
      ''
    ).trim();

  const to =
    String(
      env.COMMISSION_EMAIL ||
      ''
    ).trim();

  const from =
    String(
      env.COMMISSION_FROM_EMAIL ||
      'AFKProbably Commissions <onboarding@resend.dev>'
    ).trim();

  if (!apiKey) {
    throw new Error(
      'Commission email is not configured: RESEND_API_KEY is missing.'
    );
  }

  if (!to) {
    throw new Error(
      'Commission email is not configured: COMMISSION_EMAIL is missing.'
    );
  }

  const subjectName =
    commission.name
      .replace(
        /[\r\n]+/g,
        ' '
      )
      .slice(
        0,
        80
      );

  const lines = [
    'New AFKProbably commission request',
    '',
    `Name: ${commission.name}`,
    `Email: ${commission.email}`,
    `Project type: ${commission.projectType}`,
    `Budget: ${
      commission.budget ||
      'Not provided'
    }`,
    `Desired deadline: ${
      commission.deadline ||
      'Not provided'
    }`,
    `Reference links: ${
      commission.referenceLinks ||
      'None provided'
    }`,
    '',
    'Project description:',
    commission.description
  ];

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#24123a">
      <h2 style="margin:0 0 16px">New AFKProbably commission request</h2>

      <p>
        <strong>Name:</strong>
        ${escapeHtml(
          commission.name
        )}
      </p>

      <p>
        <strong>Email:</strong>
        ${escapeHtml(
          commission.email
        )}
      </p>

      <p>
        <strong>Project type:</strong>
        ${escapeHtml(
          commission.projectType
        )}
      </p>

      <p>
        <strong>Budget:</strong>
        ${escapeHtml(
          commission.budget ||
          'Not provided'
        )}
      </p>

      <p>
        <strong>Desired deadline:</strong>
        ${escapeHtml(
          commission.deadline ||
          'Not provided'
        )}
      </p>

      <p>
        <strong>Reference links:</strong>
        ${escapeHtml(
          commission.referenceLinks ||
          'None provided'
        )}
      </p>

      <hr style="border:0;border-top:1px solid #ddd;margin:20px 0">

      <p>
        <strong>
          Project description:
        </strong>
      </p>

      <p style="white-space:pre-wrap">
        ${escapeHtml(
          commission.description
        )}
      </p>
    </div>
  `;

  const response =
    await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
          authorization:
            `Bearer ${apiKey}`,

          'content-type':
            'application/json'
        },

        body:
          JSON.stringify({
            from,

            to: [
              to
            ],

            reply_to:
              commission.email,

            subject:
              `New commission request — ${subjectName}`,

            text:
              lines.join(
                '\n'
              ),

            html
          })
      }
    );

  const raw =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Commission email failed (${response.status}): ${raw}`
    );
  }

  let result = null;

  try {
    result =
      raw
        ? JSON.parse(
            raw
          )
        : null;
  } catch {}

  if (!result?.id) {
    throw new Error(
      `Commission email was not confirmed by Resend: ${
        raw ||
        'empty response'
      }`
    );
  }

  return result.id;
}

function escapeHtml(
  value
) {
  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}

function normalizeProductImages(
  product
) {
  return {
    ...product,

    images: [
      ...(
        product
          .product_images ||
        []
      )
    ].sort(
      (
        a,
        b
      ) =>
        (
          a.sort_order ||
          0
        ) -
        (
          b.sort_order ||
          0
        )
    ),

    product_images:
      undefined
  };
}

function cleanText(
  value,
  max
) {
  return String(
    value || ''
  )
    .trim()
    .slice(
      0,
      max
    );
}

function cleanDate(
  value
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(
      value || ''
    )
  )
    ? String(value)
    : null;
}

async function verifyStripeSignature(
  payload,
  header,
  secret
) {
  const entries =
    header
      .split(',')
      .map(
        x =>
          x.trim()
      );

  const timestamp =
    entries
      .find(
        x =>
          x.startsWith(
            't='
          )
      )
      ?.slice(2);

  const signatures =
    entries
      .filter(
        x =>
          x.startsWith(
            'v1='
          )
      )
      .map(
        x =>
          x.slice(3)
      );

  if (
    !timestamp ||
    !signatures.length
  ) {
    return false;
  }

  if (
    Math.abs(
      Math.floor(
        Date.now() /
        1000
      ) -
      Number(
        timestamp
      )
    ) >
    300
  ) {
    return false;
  }

  const key =
    await crypto.subtle.importKey(
      'raw',

      new TextEncoder()
        .encode(
          secret
        ),

      {
        name:
          'HMAC',

        hash:
          'SHA-256'
      },

      false,

      [
        'sign'
      ]
    );

  const signed =
    await crypto.subtle.sign(
      'HMAC',

      key,

      new TextEncoder()
        .encode(
          `${timestamp}.${payload}`
        )
    );

  const expected = [
    ...new Uint8Array(
      signed
    )
  ]
    .map(
      b =>
        b
          .toString(16)
          .padStart(
            2,
            '0'
          )
    )
    .join('');

  return signatures.some(
    sig =>
      constantTimeEqual(
        expected,
        sig
      )
  );
}

function constantTimeEqual(
  a,
  b
) {
  if (
    a.length !==
    b.length
  ) {
    return false;
  }

  let diff = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    diff |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return diff === 0;
}

function isUuid(
  value
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || ''
  );
}

function capitalize(
  value
) {
  return (
    value
      .charAt(0)
      .toUpperCase() +
    value.slice(1)
  );
}

function safeMessage(
  error
) {
  return error instanceof Error
    ? error.message
    : 'Unexpected server error.';
}

function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data
    ),
    {
      status,

      headers:
        JSON_HEADERS
    }
  );
}
