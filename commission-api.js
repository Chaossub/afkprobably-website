export async function handleCommissionApi(
  request,
  env,
  url
) {

  if (
    url.pathname ===
      '/api/admin/commission-deposit' &&
    request.method ===
      'POST'
  ) {
    return adminCommissionDeposit(
      request,
      env,
      url
    );
  }


  if (
    url.pathname ===
      '/api/admin/commission-final-payment' &&
    request.method ===
      'POST'
  ) {
    return adminCommissionFinalPayment(
      request,
      env,
      url
    );
  }


  if (
    url.pathname ===
      '/api/admin/commission-delivery' &&
    request.method ===
      'POST'
  ) {
    return adminCommissionDelivery(
      request,
      env,
      url
    );
  }


  if (
    url.pathname ===
      '/api/commission-download' &&
    request.method ===
      'GET'
  ) {
    return commissionDownload(
      env,
      url
    );
  }


  return null;
}


async function adminCommissionDeposit(
  request,
  env,
  url
) {
  try {

    assertServerConfig(
      env
    );


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
        body.commissionId ||
        ''
      );


    const totalCents =
      Number(
        body.totalCents
      );


    const depositCents =
      Number(
        body.depositCents
      );


    if (
      !isUuid(
        commissionId
      )
    ) {

      return json(
        {
          error:
            'Invalid commission request.'
        },
        400
      );

    }


    if (
      !Number.isInteger(
        totalCents
      ) ||
      totalCents <
        50
    ) {

      return json(
        {
          error:
            'Total commission price must be at least $0.50.'
        },
        400
      );

    }


    if (
      !Number.isInteger(
        depositCents
      ) ||
      depositCents <
        50
    ) {

      return json(
        {
          error:
            'Deposit must be at least $0.50.'
        },
        400
      );

    }


    if (
      depositCents >
      totalCents
    ) {

      return json(
        {
          error:
            'Deposit cannot exceed the total commission price.'
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


    const payments =
      await getCommissionPayments(
        env,
        commissionId
      );


    const existingDeposit =
      payments.find(
        payment =>
          payment.payment_type ===
            'deposit' &&
          payment.status !==
            'cancelled'
      );


    if (
      existingDeposit
    ) {

      return json(
        {
          error:
            existingDeposit.status ===
              'paid'
              ? 'The deposit for this commission has already been paid.'
              : 'A deposit payment request already exists for this commission.'
        },
        409
      );

    }


    await patchCommissionRequest(
      env,
      commissionId,
      {
        quote_total_cents:
          totalCents,

        deposit_cents:
          depositCents
      }
    );


    const payment =
      await createCommissionPaymentRow(
        env,
        {
          commissionId,

          paymentType:
            'deposit',

          label:
            'Commission deposit',

          amountCents:
            depositCents
        }
      );


    const remainingCents =
      Math.max(
        totalCents -
        depositCents,
        0
      );


    const session =
      await createStripeCheckout(
        env,
        url,
        {
          commission,

          payment,

          paymentType:
            'deposit',

          label:
            'Commission deposit',

          amountCents:
            depositCents
        }
      );


    try {

      await sendDepositEmail(
        env,
        {
          to:
            commission.email,

          customerName:
            commission.name,

          totalCents,

          depositCents,

          remainingCents,

          checkoutUrl:
            session.url
        }
      );


      await patchCommissionPayment(
        env,
        payment.id,
        {
          emailed_at:
            new Date()
              .toISOString(),

          updated_at:
            new Date()
              .toISOString()
        }
      );

    } catch (
      emailError
    ) {

      return json(
        {
          error:
            `Stripe checkout was created, but the deposit email failed: ${safeMessage(
              emailError
            )}. The checkout link is saved in Admin.`
        },
        502
      );

    }


    return json(
      {
        ok:
          true,

        paymentId:
          payment.id,

        checkoutUrl:
          session.url,

        totalCents,

        depositCents,

        remainingCents
      }
    );

  } catch (
    error
  ) {

    return json(
      {
        error:
          safeMessage(
            error
          )
      },
      500
    );

  }
}


async function adminCommissionFinalPayment(
  request,
  env,
  url
) {
  try {

    assertServerConfig(
      env
    );


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
        body.commissionId ||
        ''
      );


    if (
      !isUuid(
        commissionId
      )
    ) {

      return json(
        {
          error:
            'Invalid commission request.'
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


    const totalCents =
      Number(
        commission
          .quote_total_cents
      );


    const depositCents =
      Number(
        commission
          .deposit_cents
      );


    if (
      !Number.isInteger(
        totalCents
      ) ||
      totalCents <
        50
    ) {

      return json(
        {
          error:
            'This commission does not have a saved total price.'
        },
        400
      );

    }


    if (
      !Number.isInteger(
        depositCents
      ) ||
      depositCents <
        50
    ) {

      return json(
        {
          error:
            'This commission does not have a saved deposit.'
        },
        400
      );

    }


    const payments =
      await getCommissionPayments(
        env,
        commissionId
      );


    const depositPayment =
      payments.find(
        payment =>
          payment.payment_type ===
            'deposit' &&
          payment.status ===
            'paid'
      );


    if (
      !depositPayment
    ) {

      return json(
        {
          error:
            'The deposit must be paid before sending the final balance.'
        },
        409
      );

    }


    const existingFinal =
      payments.find(
        payment =>
          payment.payment_type ===
            'final' &&
          payment.status !==
            'cancelled'
      );


    if (
      existingFinal
    ) {

      return json(
        {
          error:
            existingFinal.status ===
              'paid'
              ? 'This commission is already paid in full.'
              : 'A final payment request already exists for this commission.'
        },
        409
      );

    }


    const amountCents =
      Math.max(
        totalCents -
        depositCents,
        0
      );


    if (
      amountCents <
      50
    ) {

      return json(
        {
          error:
            'There is no remaining balance to charge.'
        },
        409
      );

    }


    const payment =
      await createCommissionPaymentRow(
        env,
        {
          commissionId,

          paymentType:
            'final',

          label:
            'Final commission balance',

          amountCents
        }
      );


    const session =
      await createStripeCheckout(
        env,
        url,
        {
          commission,

          payment,

          paymentType:
            'final',

          label:
            'Final commission balance',

          amountCents
        }
      );


    try {

      await sendFinalPaymentEmail(
        env,
        {
          to:
            commission.email,

          customerName:
            commission.name,

          totalCents,

          depositCents,

          amountCents,

          checkoutUrl:
            session.url
        }
      );


      await patchCommissionPayment(
        env,
        payment.id,
        {
          emailed_at:
            new Date()
              .toISOString(),

          updated_at:
            new Date()
              .toISOString()
        }
      );

    } catch (
      emailError
    ) {

      return json(
        {
          error:
            `Stripe checkout was created, but the final-payment email failed: ${safeMessage(
              emailError
            )}. The checkout link is saved in Admin.`
        },
        502
      );

    }


    return json(
      {
        ok:
          true,

        paymentId:
          payment.id,

        checkoutUrl:
          session.url,

        amountCents
      }
    );

  } catch (
    error
  ) {

    return json(
      {
        error:
          safeMessage(
            error
          )
      },
      500
    );

  }
}


async function createCommissionPaymentRow(
  env,
  {
    commissionId,
    paymentType,
    label,
    amountCents
  }
) {

  const response =
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/commission_payments`,
      {
        method:
          'POST',

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
          JSON.stringify(
            {
              commission_id:
                commissionId,

              payment_type:
                paymentType,

              label,

              amount_cents:
                amountCents,

              status:
                'unpaid'
            }
          )
      }
    );


  const rows =
    await response
      .json()
      .catch(
        () => []
      );


  if (
    !response.ok ||
    !rows?.[0]?.id
  ) {

    throw new Error(
      `Could not create commission payment: ${
        Array.isArray(
          rows
        )
          ? 'No payment row returned.'
          : rows?.message ||
            rows?.error ||
            'Database error.'
      }`
    );

  }


  return rows[0];
}


async function createStripeCheckout(
  env,
  url,
  {
    commission,
    payment,
    paymentType,
    label,
    amountCents
  }
) {

  const params =
    new URLSearchParams();


  params.set(
    'mode',
    'payment'
  );


  /*
    IMPORTANT:
    Disable Stripe Managed Payments for these
    commission checkout sessions.

    Without this, Stripe can require a product
    tax code and reject the checkout.
  */
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
    String(
      amountCents
    )
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
    commission.id
  );


  params.set(
    'metadata[commission_payment_id]',
    payment.id
  );


  params.set(
    'metadata[commission_payment_type]',
    paymentType
  );


  const stripeResponse =
    await fetch(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method:
          'POST',

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
    await stripeResponse
      .json();


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


    throw new Error(
      session
        ?.error
        ?.message ||
      'Stripe could not create the commission checkout.'
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


  return session;
}


async function adminCommissionDelivery(
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
        body.commissionId ||
        ''
      );

    const note =
      cleanText(
        body.note,
        3000
      );

    const files =
      Array.isArray(
        body.files
      )
        ? body.files
        : [];

    if (!isUuid(commissionId)) {
      return json(
        {
          error:
            'Invalid commission request.'
        },
        400
      );
    }

    if (
      !files.length ||
      files.length > 20
    ) {
      return json(
        {
          error:
            'Choose at least one commission file (maximum 20 files per delivery).'
        },
        400
      );
    }

    const normalizedFiles =
      files.map(
        file => ({
          storagePath:
            cleanText(
              file?.storagePath,
              1000
            ),

          originalName:
            cleanText(
              file?.originalName,
              255
            ),

          fileSize:
            Number(
              file?.fileSize ||
              0
            )
        })
      );

    if (
      normalizedFiles.some(
        file =>
          !file.storagePath ||
          !file.originalName ||
          !file.storagePath.startsWith(
            `commissions/${commissionId}/`
          ) ||
          !Number.isFinite(
            file.fileSize
          ) ||
          file.fileSize < 0
      )
    ) {
      return json(
        {
          error:
            'One or more uploaded files are invalid.'
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

    const created = [];

    for (
      const file
      of normalizedFiles
    ) {
      const token =
        crypto.randomUUID();

      const response =
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/commission_deliveries`,
          {
            method:
              'POST',

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

                storage_path:
                  file.storagePath,

                original_name:
                  file.originalName,

                file_size:
                  Math.round(
                    file.fileSize
                  ),

                delivery_token:
                  token
              })
          }
        );

      const rows =
        await response
          .json()
          .catch(
            () => []
          );

      if (
        !response.ok ||
        !rows?.[0]?.id
      ) {
        await deleteCommissionDeliveries(
          env,
          created.map(
            item => item.id
          )
        );

        throw new Error(
          Array.isArray(rows)
            ? 'Could not save the commission delivery.'
            : rows?.message ||
              rows?.error ||
              'Could not save the commission delivery.'
        );
      }

      created.push({
        ...rows[0],
        token
      });
    }

    const links =
      created.map(
        item => ({
          name:
            item.original_name,

          url:
            `${url.origin}/api/commission-download?token=${encodeURIComponent(
              item.token
            )}`
        })
      );

    try {
      await sendCommissionDeliveryEmail(
        env,
        {
          to:
            commission.email,

          customerName:
            commission.name,

          projectType:
            commission.project_type,

          note,

          links
        }
      );
    } catch (error) {
      await deleteCommissionDeliveries(
        env,
        created.map(
          item => item.id
        )
      );

      throw error;
    }

    const now =
      new Date()
        .toISOString();

    await patchCommissionDeliveries(
      env,
      created.map(
        item => item.id
      ),
      {
        emailed_at:
          now
      }
    );

    await patchCommissionRequest(
      env,
      commissionId,
      {
        status:
          'completed'
      }
    );

    return json({
      ok:
        true,

      delivered:
        created.length
    });
  } catch (error) {
    return json(
      {
        error:
          safeMessage(error)
      },
      500
    );
  }
}


async function commissionDownload(
  env,
  url
) {
  try {
    assertServerConfig(env);

    const token =
      String(
        url.searchParams.get(
          'token'
        ) ||
        ''
      );

    if (!isUuid(token)) {
      return new Response(
        'This commission download link is invalid.',
        {
          status:
            400,

          headers: {
            'content-type':
              'text/plain; charset=utf-8',

            'cache-control':
              'no-store'
          }
        }
      );
    }

    const rows =
      await supabaseRest(
        env,
        `commission_deliveries?delivery_token=eq.${encodeURIComponent(
          token
        )}&revoked_at=is.null&select=id,storage_path,original_name&limit=1`
      );

    const delivery =
      rows[0];

    if (!delivery) {
      return new Response(
        'This commission download is no longer available.',
        {
          status:
            404,

          headers: {
            'content-type':
              'text/plain; charset=utf-8',

            'cache-control':
              'no-store'
          }
        }
      );
    }

    const signedUrl =
      await createCommissionSignedDownload(
        env,
        delivery.storage_path
      );

    await fetch(
      `${env.SUPABASE_URL}/rest/v1/commission_deliveries?id=eq.${encodeURIComponent(
        delivery.id
      )}`,
      {
        method:
          'PATCH',

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
            last_downloaded_at:
              new Date()
                .toISOString()
          })
      }
    ).catch(() => null);

    return Response.redirect(
      signedUrl,
      302
    );
  } catch (error) {
    return new Response(
      'We could not prepare this commission download. Please reply to your delivery email for help.',
      {
        status:
          500,

        headers: {
          'content-type':
            'text/plain; charset=utf-8',

          'cache-control':
            'no-store'
        }
      }
    );
  }
}


async function sendCommissionDeliveryEmail(
  env,
  {
    to,
    customerName,
    projectType,
    note,
    links
  }
) {
  const safeName =
    cleanText(
      customerName,
      100
    ) ||
    'there';

  const safeProject =
    cleanText(
      projectType,
      180
    ) ||
    'commission';

  const textLines = [
    `Hi ${safeName},`,
    '',
    'Your AFKProbably commission is finished and ready to download.',
    '',
    ...(note
      ? [
          note,
          ''
        ]
      : []),
    ...links.flatMap(
      link => [
        `${link.name}:`,
        link.url,
        ''
      ]
    ),
    'These delivery links stay usable; each click creates a fresh secure download.',
    '',
    'If you have any questions, reply to this email.',
    '',
    '— AFKProbably Commissions'
  ];

  const linkHtml =
    links.map(
      link => `
        <p style="margin:12px 0">
          <a
            href="${escapeHtml(link.url)}"
            style="display:inline-block;padding:12px 18px;border-radius:999px;background:#6b20df;color:#fff;text-decoration:none;font-weight:700"
          >
            Download ${escapeHtml(link.name)}
          </a>
        </p>
      `
    ).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#24123a">
      <p>Hi ${escapeHtml(safeName)},</p>

      <p>
        Your AFKProbably commission is finished and ready to download.
      </p>

      ${note
        ? `<p style="white-space:pre-wrap">${escapeHtml(note)}</p>`
        : ''}

      ${linkHtml}

      <p style="font-size:13px;color:#725d80">
        These delivery links stay usable; each click creates a fresh secure download.
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
        `Your AFKProbably commission is ready — ${safeProject}`,

      text:
        textLines.join('\n'),

      html
    }
  );
}


async function createCommissionSignedDownload(
  env,
  storagePath
) {
  const encodedPath =
    String(storagePath)
      .split('/')
      .map(
        encodeURIComponent
      )
      .join('/');

  const response =
    await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/sign/mesh-files/${encodedPath}`,
      {
        method:
          'POST',

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
      'Could not create commission download link.'
    );
  }

  return `${env.SUPABASE_URL}/storage/v1${data.signedURL}${
    data.signedURL.includes('?')
      ? '&'
      : '?'
  }download=1`;
}


async function patchCommissionDeliveries(
  env,
  ids,
  patch
) {
  for (const id of ids) {
    const response =
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/commission_deliveries?id=eq.${encodeURIComponent(
          id
        )}`,
        {
          method:
            'PATCH',

          headers:
            serviceHeaders(
              env,
              {
                'content-type':
                  'application/json'
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
        `Could not update commission delivery: ${await response.text()}`
      );
    }
  }
}


async function deleteCommissionDeliveries(
  env,
  ids
) {
  for (const id of ids) {
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/commission_deliveries?id=eq.${encodeURIComponent(
        id
      )}`,
      {
        method:
          'DELETE',

        headers:
          serviceHeaders(
            env
          )
      }
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
      )}&select=id,name,email,project_type,status,quote_total_cents,deposit_cents&limit=1`
    );


  return (
    rows[0] ||
    null
  );
}


async function getCommissionPayments(
  env,
  commissionId
) {

  return supabaseRest(
    env,
    `commission_payments?commission_id=eq.${encodeURIComponent(
      commissionId
    )}&select=id,commission_id,payment_type,label,amount_cents,status,stripe_checkout_session_id,stripe_checkout_url,paid_at,emailed_at,created_at&order=created_at.desc`
  );
}


async function patchCommissionRequest(
  env,
  id,
  patch
) {

  const response =
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/commission_requests?id=eq.${encodeURIComponent(
        id
      )}`,
      {
        method:
          'PATCH',

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


  if (
    !response.ok
  ) {

    throw new Error(
      `Could not update commission request: ${await response.text()}`
    );

  }
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
        method:
          'PATCH',

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


  if (
    !response.ok
  ) {

    throw new Error(
      `Could not update commission payment: ${await response.text()}`
    );

  }
}


async function sendDepositEmail(
  env,
  {
    to,
    customerName,
    totalCents,
    depositCents,
    remainingCents,
    checkoutUrl
  }
) {

  const safeName =
    cleanText(
      customerName,
      100
    ) ||
    'there';


  const total =
    formatMoney(
      totalCents
    );


  const deposit =
    formatMoney(
      depositCents
    );


  const remaining =
    formatMoney(
      remainingCents
    );


  const text = [

    `Hi ${safeName},`,

    '',

    'Your AFKProbably commission has been approved.',

    '',

    `Commission total: ${total}`,

    `Deposit due now: ${deposit}`,

    `Remaining balance after deposit: ${remaining}`,

    '',

    'A deposit is required to begin your commission.',

    '',

    `Pay your deposit securely with Stripe: ${checkoutUrl}`,

    '',

    remainingCents >
      0
      ? `The remaining ${remaining} will be due when your commission is ready.`
      : 'This deposit covers the full commission price.',

    '',

    'If you have any questions, reply to this email.',

    '',

    '— AFKProbably Commissions'

  ].join(
    '\n'
  );


  const html = `
    <div
      style="
        font-family:
          Arial,
          sans-serif;
        line-height:
          1.6;
        color:
          #24123a;
      "
    >

      <p>
        Hi ${escapeHtml(
          safeName
        )},
      </p>


      <p>
        Your AFKProbably commission has been approved.
      </p>


      <div
        style="
          padding:
            16px;
          border-radius:
            14px;
          background:
            #f5efff;
          margin:
            20px 0;
        "
      >

        <p
          style="
            margin:
              0
              0
              6px;
          "
        >
          <strong>
            Commission total:
          </strong>

          ${escapeHtml(
            total
          )}
        </p>


        <p
          style="
            margin:
              0
              0
              6px;
          "
        >
          <strong>
            Deposit due now:
          </strong>

          ${escapeHtml(
            deposit
          )}
        </p>


        <p
          style="
            margin:
              0;
          "
        >
          <strong>
            Remaining balance:
          </strong>

          ${escapeHtml(
            remaining
          )}
        </p>

      </div>


      <p>
        A deposit is required to begin your commission.
      </p>


      <p
        style="
          margin:
            24px
            0;
        "
      >

        <a
          href="${escapeHtml(
            checkoutUrl
          )}"
          style="
            display:
              inline-block;
            padding:
              13px
              20px;
            border-radius:
              999px;
            background:
              #6b20df;
            color:
              #fff;
            text-decoration:
              none;
            font-weight:
              700;
          "
        >
          Pay ${escapeHtml(
            deposit
          )} deposit
        </a>

      </p>


      <p>

        ${
          remainingCents >
            0
            ? `The remaining <strong>${escapeHtml(
                remaining
              )}</strong> will be due when your commission is ready.`
            : 'This deposit covers the full commission price.'
        }

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
        `AFKProbably commission deposit — ${deposit} due`,

      text,

      html
    }
  );
}


async function sendFinalPaymentEmail(
  env,
  {
    to,
    customerName,
    totalCents,
    depositCents,
    amountCents,
    checkoutUrl
  }
) {

  const safeName =
    cleanText(
      customerName,
      100
    ) ||
    'there';


  const total =
    formatMoney(
      totalCents
    );


  const deposit =
    formatMoney(
      depositCents
    );


  const finalAmount =
    formatMoney(
      amountCents
    );


  const text = [

    `Hi ${safeName},`,

    '',

    'Your AFKProbably commission is ready for the final payment.',

    '',

    `Commission total: ${total}`,

    `Deposit paid: ${deposit}`,

    `Final balance due: ${finalAmount}`,

    '',

    `Pay the final balance securely with Stripe: ${checkoutUrl}`,

    '',

    'If you have any questions, reply to this email.',

    '',

    '— AFKProbably Commissions'

  ].join(
    '\n'
  );


  const html = `
    <div
      style="
        font-family:
          Arial,
          sans-serif;
        line-height:
          1.6;
        color:
          #24123a;
      "
    >

      <p>
        Hi ${escapeHtml(
          safeName
        )},
      </p>


      <p>
        Your AFKProbably commission is ready for the final payment.
      </p>


      <div
        style="
          padding:
            16px;
          border-radius:
            14px;
          background:
            #f5efff;
          margin:
            20px 0;
        "
      >

        <p
          style="
            margin:
              0
              0
              6px;
          "
        >
          <strong>
            Commission total:
          </strong>

          ${escapeHtml(
            total
          )}
        </p>


        <p
          style="
            margin:
              0
              0
              6px;
          "
        >
          <strong>
            Deposit paid:
          </strong>

          ${escapeHtml(
            deposit
          )}
        </p>


        <p
          style="
            margin:
              0;
          "
        >
          <strong>
            Final balance due:
          </strong>

          ${escapeHtml(
            finalAmount
          )}
        </p>

      </div>


      <p
        style="
          margin:
            24px
            0;
        "
      >

        <a
          href="${escapeHtml(
            checkoutUrl
          )}"
          style="
            display:
              inline-block;
            padding:
              13px
              20px;
            border-radius:
              999px;
            background:
              #6b20df;
            color:
              #fff;
            text-decoration:
              none;
            font-weight:
              700;
          "
        >
          Pay ${escapeHtml(
            finalAmount
          )} final balance
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
        `AFKProbably final commission payment — ${finalAmount} due`,

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


  if (
    !apiKey
  ) {

    throw new Error(
      'RESEND_API_KEY is missing.'
    );

  }


  if (
    !to ||
    !/^\S+@\S+\.\S+$/.test(
      String(
        to
      )
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
        method:
          'POST',

        headers: {
          authorization:
            `Bearer ${apiKey}`,

          'content-type':
            'application/json'
        },

        body:
          JSON.stringify(
            {
              from,

              to: [
                String(
                  to
                )
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
            }
          )
      }
    );


  const raw =
    await response
      .text();


  if (
    !response.ok
  ) {

    throw new Error(
      `Commission email failed (${response.status}): ${raw}`
    );

  }


  let result =
    null;


  try {

    result =
      raw
        ? JSON.parse(
            raw
          )
        : null;

  } catch {}


  if (
    !result?.id
  ) {

    throw new Error(
      `Commission email was not confirmed by Resend: ${
        raw ||
        'empty response'
      }`
    );

  }


  return result.id;
}


async function requireAdmin(
  request,
  env
) {

  const authorization =
    request.headers.get(
      'authorization'
    ) ||
    '';


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


  if (
    !response.ok
  ) {

    return null;

  }


  const user =
    await response
      .json();


  return String(
    user.email ||
    ''
  ).toLowerCase() ===
    String(
      env.ADMIN_EMAIL ||
      ''
    ).toLowerCase()
    ? user
    : null;
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
    await response
      .json();


  if (
    !response.ok
  ) {

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


function stripeSecretKey(
  env
) {

  const mode =
    String(
      env.STRIPE_MODE ||
      'live'
    )
      .trim()
      .toLowerCase() ===
      'test'
      ? 'test'
      : 'live';


  const key =
    mode ===
      'test'
      ? String(
          env.STRIPE_SECRET_KEY_TEST ||
          ''
        ).trim()
      : String(
          env.STRIPE_SECRET_KEY ||
          ''
        ).trim();


  if (
    !key
  ) {

    throw new Error(
      mode ===
        'test'
        ? 'Stripe test mode is selected, but STRIPE_SECRET_KEY_TEST is missing.'
        : 'Stripe live mode is selected, but STRIPE_SECRET_KEY is missing.'
    );

  }


  return key;
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


function cleanText(
  value,
  max
) {

  return String(
    value ||
    ''
  )
    .trim()
    .slice(
      0,
      max
    );
}


function formatMoney(
  cents
) {

  return `$${(
    Number(
      cents ||
      0
    ) /
    100
  ).toFixed(2)}`;
}


function escapeHtml(
  value
) {

  return String(
    value ??
    ''
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


function isUuid(
  value
) {

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value ||
    ''
  );
}


function safeMessage(
  error
) {

  return error instanceof
    Error
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

      headers: {
        'content-type':
          'application/json; charset=utf-8',

        'cache-control':
          'no-store'
      }
    }
  );
}
