(() => {
  const cfg =
    window.AFK_CONFIG || {};

  const list =
    document.getElementById(
      'commissionRequestList'
    );

  if (
    !list ||
    !window.supabase
  ) {
    return;
  }

  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes(
      'PASTE_'
    ) &&
    !cfg.SUPABASE_ANON_KEY.includes(
      'PASTE_'
    );

  if (!configured) {
    return;
  }

  const sb =
    window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );

  let rowsById =
    new Map();

  let renderQueued =
    false;

  let rendering =
    false;


  function centsToMoney(
    cents
  ) {
    return (
      Number(
        cents || 0
      ) / 100
    ).toFixed(2);
  }


  function formatPrice(
    cents
  ) {
    return `$${centsToMoney(
      cents
    )}`;
  }


  function escapeHtml(
    value = ''
  ) {
    return String(
      value
    ).replace(
      /[&<>'"]/g,
      ch =>
        ({
          '&':
            '&amp;',

          '<':
            '&lt;',

          '>':
            '&gt;',

          "'":
            '&#039;',

          '"':
            '&quot;'
        }[ch])
    );
  }


  function getCommissionId(
    article
  ) {
    return (
      article
        .querySelector(
          '[data-commission-status]'
        )
        ?.dataset
        .commissionStatus ||

      article
        .querySelector(
          '[data-delete-commission]'
        )
        ?.dataset
        .deleteCommission ||

      ''
    );
  }


  function findPaymentBlock(
    article
  ) {
    const headings = [
      ...article.querySelectorAll(
        '.eyebrow'
      )
    ];

    const paymentHeading =
      headings.find(
        node =>
          [
            'PAYMENT REQUEST',
            'COMMISSION PAYMENT'
          ].includes(
            node
              .textContent
              .trim()
              .toUpperCase()
          )
      );

    return (
      paymentHeading
        ?.parentElement ||
      null
    );
  }


  function paymentForType(
    payments,
    type
  ) {
    return [
      ...payments
    ]
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            b.created_at
          ) -
          new Date(
            a.created_at
          )
      )
      .find(
        payment =>
          payment.payment_type ===
            type &&
          payment.status !==
            'cancelled'
      );
  }


  function renderPaymentBlock(
    block,
    item
  ) {
    const payments =
      item.commission_payments ||
      [];

    const depositPayment =
      paymentForType(
        payments,
        'deposit'
      );

    const finalPayment =
      paymentForType(
        payments,
        'final'
      );


    const totalCents =
      Number.isInteger(
        item.quote_total_cents
      )
        ? item.quote_total_cents
        : null;


    const depositCents =
      Number.isInteger(
        item.deposit_cents
      )
        ? item.deposit_cents
        : null;


    const remainingCents =
      totalCents != null &&
      depositCents != null
        ? Math.max(
            totalCents -
              depositCents,
            0
          )
        : null;


    const depositPaid =
      depositPayment
        ?.status ===
      'paid';


    const finalPaid =
      finalPayment
        ?.status ===
      'paid';


    const paidInFull =
      Boolean(
        depositPaid &&
        (
          remainingCents ===
            0 ||
          finalPaid
        )
      );


    const earlierPayments =
      payments.filter(
        payment =>
          ![
            'deposit',
            'final'
          ].includes(
            payment.payment_type
          )
      );


    block.dataset
      .commissionPaymentV2 =
      '1';


    block.innerHTML = `
      <p
        class="eyebrow"
        style="margin-bottom:8px"
      >
        COMMISSION PAYMENT
      </p>

      ${
        !depositPayment
          ? `
            <div
              style="
                display:grid;
                grid-template-columns:
                  minmax(0,1fr)
                  minmax(0,1fr);
                gap:10px;
              "
            >

              <label>

                Total commission price ($)

                <input
                  type="number"
                  data-v2-total="${item.id}"
                  min="0.50"
                  step="0.01"
                  value="${
                    totalCents ==
                    null
                      ? ''
                      : centsToMoney(
                          totalCents
                        )
                  }"
                  placeholder="150.00"
                  style="
                    width:100%;
                    margin-top:6px;
                  "
                >

              </label>


              <label>

                Deposit percentage (%)

                <input
                  type="number"
                  data-v2-deposit-percent="${item.id}"
                  min="1"
                  max="100"
                  step="1"
                  value="${
                    totalCents != null &&
                    depositCents != null &&
                    totalCents > 0
                      ? Math.round(
                          (depositCents / totalCents) * 100
                        )
                      : '50'
                  }"
                  placeholder="50"
                  style="
                    width:100%;
                    margin-top:6px;
                  "
                >

                <div
                  data-v2-deposit-preview="${item.id}"
                  style="
                    margin-top:7px;
                    color:#725d80;
                    font-size:.88rem;
                  "
                >
                  Deposit amount: ${
                    totalCents != null
                      ? formatPrice(
                          Math.round(
                            totalCents *
                            (
                              depositCents != null && totalCents > 0
                                ? depositCents / totalCents
                                : 0.5
                            )
                          )
                        )
                      : '$0.00'
                  }
                </div>

              </label>

            </div>


            <p
              style="
                margin:10px 0 0;
                color:#725d80;
                font-size:.9rem;
              "
            >
              The customer receives the
              deposit link first. The
              final-payment button appears
              after the deposit is paid.
            </p>


            <div
              class="listing-buttons"
              style="margin-top:12px"
            >

              <button
                class="tiny-button"
                type="button"
                data-v2-send-deposit="${item.id}"
              >
                Save price &amp; email deposit
              </button>

            </div>
          `
          : `
            <div
              style="
                padding:12px;
                border-radius:14px;
                background:
                  rgba(
                    117,
                    51,
                    222,
                    .06
                  );
              "
            >

              <div
                style="
                  display:flex;
                  justify-content:
                    space-between;
                  gap:12px;
                "
              >
                <span>
                  Total commission
                </span>

                <strong>
                  ${formatPrice(
                    totalCents
                  )}
                </strong>
              </div>


              <div
                style="
                  display:flex;
                  justify-content:
                    space-between;
                  gap:12px;
                  margin-top:6px;
                "
              >
                <span>
                  Deposit
                </span>

                <strong>
                  ${formatPrice(
                    depositCents
                  )}
                </strong>
              </div>


              <div
                style="
                  display:flex;
                  justify-content:
                    space-between;
                  gap:12px;
                  margin-top:6px;
                "
              >
                <span>
                  Remaining balance
                </span>

                <strong>
                  ${formatPrice(
                    remainingCents
                  )}
                </strong>
              </div>

            </div>


            <div
              style="
                display:flex;
                justify-content:
                  space-between;
                gap:12px;
                align-items:center;
                flex-wrap:wrap;
                margin-top:12px;
              "
            >

              <span>

                Deposit:

                <strong>
                  ${escapeHtml(
                    String(
                      depositPayment
                        .status ||
                      'unpaid'
                    )
                      .toUpperCase()
                  )}
                </strong>

              </span>


              ${
                depositPayment
                  .status !==
                  'paid' &&
                depositPayment
                  .stripe_checkout_url
                  ? `
                    <a
                      class="tiny-button"
                      href="${escapeHtml(
                        depositPayment
                          .stripe_checkout_url
                      )}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open deposit checkout
                    </a>
                  `
                  : ''
              }

            </div>


            ${
              depositPaid &&
              remainingCents >
                0
                ? `
                  <div
                    style="
                      margin-top:14px;
                      padding-top:12px;
                      border-top:
                        1px solid
                        rgba(
                          78,
                          30,
                          120,
                          .10
                        );
                    "
                  >

                    ${
                      finalPayment
                        ? `
                          <div
                            style="
                              display:flex;
                              justify-content:
                                space-between;
                              gap:12px;
                              align-items:
                                center;
                              flex-wrap:
                                wrap;
                            "
                          >

                            <span>

                              Final balance:

                              <strong>
                                ${escapeHtml(
                                  String(
                                    finalPayment
                                      .status ||
                                    'unpaid'
                                  )
                                    .toUpperCase()
                                )}
                              </strong>

                            </span>


                            ${
                              finalPayment
                                .status !==
                                'paid' &&
                              finalPayment
                                .stripe_checkout_url
                                ? `
                                  <a
                                    class="tiny-button"
                                    href="${escapeHtml(
                                      finalPayment
                                        .stripe_checkout_url
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Open final checkout
                                  </a>
                                `
                                : ''
                            }

                          </div>
                        `
                        : `
                          <button
                            class="tiny-button"
                            type="button"
                            data-v2-send-final="${item.id}"
                          >
                            Email final payment link
                            (${formatPrice(
                              remainingCents
                            )})
                          </button>
                        `
                    }

                  </div>
                `
                : ''
            }


            ${
              paidInFull
                ? `
                  <p
                    style="
                      margin:
                        14px
                        0
                        0;
                      font-weight:
                        900;
                      color:
                        #4d1597;
                    "
                  >
                    COMMISSION PAID IN FULL ✓
                  </p>
                `
                : ''
            }
          `
      }


      ${
        earlierPayments.length
          ? `
            <div
              style="margin-top:14px"
            >

              <p
                class="commission-empty"
                style="margin:0 0 6px"
              >
                Earlier payment requests
              </p>


              ${earlierPayments
                .map(
                  payment => `
                    <div
                      style="
                        display:flex;
                        justify-content:
                          space-between;
                        gap:12px;
                        align-items:
                          center;
                        padding:
                          9px
                          0;
                        border-top:
                          1px solid
                          rgba(
                            78,
                            30,
                            120,
                            .10
                          );
                      "
                    >

                      <div>

                        <strong>
                          ${escapeHtml(
                            payment.label ||
                            'Commission payment'
                          )}
                        </strong>


                        <div
                          class="commission-request-meta"
                        >

                          <span>
                            ${formatPrice(
                              payment
                                .amount_cents
                            )}
                          </span>

                          <span>
                            ${escapeHtml(
                              String(
                                payment
                                  .status ||
                                'unpaid'
                              )
                                .toUpperCase()
                            )}
                          </span>

                        </div>

                      </div>

                    </div>
                  `
                )
                .join('')}

            </div>
          `
          : ''
      }
    `;
  }


  async function fetchRows() {

    const {
      data,
      error
    } =
      await sb
        .from(
          'commission_requests'
        )
        .select(
          '*, commission_payments(*)'
        )
        .order(
          'created_at',
          {
            ascending:
              false
          }
        );

    if (error) {
      throw error;
    }


    rowsById =
      new Map(
        (
          data || []
        ).map(
          item => [
            item.id,
            item
          ]
        )
      );
  }


  async function renderAll() {

    if (rendering) {
      return;
    }

    rendering =
      true;


    try {

      const {
        data: {
          session
        }
      } =
        await sb.auth
          .getSession();


      if (!session) {
        return;
      }


      await fetchRows();


      for (
        const article
        of list
          .querySelectorAll(
            '.commission-request'
          )
      ) {

        const id =
          getCommissionId(
            article
          );

        const item =
          rowsById.get(
            id
          );

        const block =
          findPaymentBlock(
            article
          );


        if (
          !item ||
          !block
        ) {
          continue;
        }


        if (
          block.dataset
            .commissionPaymentV2 ===
          '1'
        ) {
          continue;
        }


        renderPaymentBlock(
          block,
          item
        );
      }

    } catch (error) {

      console.error(
        'Commission payment UI:',
        error
      );

    } finally {

      rendering =
        false;

    }
  }


  function scheduleRender() {

    if (renderQueued) {
      return;
    }

    renderQueued =
      true;


    setTimeout(
      async () => {

        renderQueued =
          false;

        await renderAll();

      },
      50
    );
  }


  async function callAdminApi(
    path,
    body
  ) {

    const {
      data: {
        session
      }
    } =
      await sb.auth
        .getSession();


    if (
      !session
        ?.access_token
    ) {
      throw new Error(
        'Your admin session expired. Please sign in again.'
      );
    }


    const response =
      await fetch(
        path,
        {
          method:
            'POST',

          headers: {
            'content-type':
              'application/json',

            authorization:
              `Bearer ${session.access_token}`
          },

          body:
            JSON.stringify(
              body
            )
        }
      );


    const result =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (
      !response.ok
    ) {
      throw new Error(
        result.error ||
        'Request failed.'
      );
    }


    return result;
  }


  list.addEventListener(
    'input',
    event => {
      const totalInput =
        event.target.closest(
          '[data-v2-total]'
        );

      const percentInput =
        event.target.closest(
          '[data-v2-deposit-percent]'
        );

      if (!totalInput && !percentInput) {
        return;
      }

      const id =
        (totalInput?.dataset.v2Total) ||
        (percentInput?.dataset.v2DepositPercent);

      const total = Number(
        list.querySelector(
          `[data-v2-total="${id}"]`
        )?.value || 0
      );

      const percent = Number(
        list.querySelector(
          `[data-v2-deposit-percent="${id}"]`
        )?.value || 0
      );

      const preview =
        list.querySelector(
          `[data-v2-deposit-preview="${id}"]`
        );

      if (preview) {
        const cents =
          Number.isFinite(total) &&
          Number.isFinite(percent)
            ? Math.round(
                total * 100 *
                (percent / 100)
              )
            : 0;

        preview.textContent =
          `Deposit amount: ${formatPrice(
            Math.max(cents, 0)
          )}`;
      }
    }
  );


  list.addEventListener(
    'click',
    async event => {

      const depositButton =
        event.target.closest(
          '[data-v2-send-deposit]'
        );


      if (
        depositButton
      ) {

        const id =
          depositButton
            .dataset
            .v2SendDeposit;


        const totalValue =
          list.querySelector(
            `[data-v2-total="${id}"]`
          )
            ?.value ||
          '';


        const depositPercentValue =
          list.querySelector(
            `[data-v2-deposit-percent="${id}"]`
          )
            ?.value ||
          '';


        const totalCents =
          Math.round(
            Number(
              totalValue
            ) *
            100
          );


        const depositPercent =
          Number(
            depositPercentValue
          );


        const depositCents =
          Math.round(
            totalCents *
            (depositPercent / 100)
          );


        if (
          !Number.isInteger(
            totalCents
          ) ||
          totalCents <
            50
        ) {
          alert(
            'Enter a total commission price of at least $0.50.'
          );

          return;
        }


        if (
          !Number.isFinite(
            depositPercent
          ) ||
          depositPercent < 1 ||
          depositPercent > 100
        ) {
          alert(
            'Enter a deposit percentage between 1% and 100%.'
          );

          return;
        }


        if (
          !Number.isInteger(
            depositCents
          ) ||
          depositCents <
            50
        ) {
          alert(
            'That percentage makes the deposit less than $0.50. Increase the percentage or total price.'
          );

          return;
        }


        const remainingCents =
          totalCents -
          depositCents;


        if (
          !confirm(
            `Email a ${depositPercent}% deposit request for ${formatPrice(
              depositCents
            )}?\n\n` +
            `Total commission: ${formatPrice(
              totalCents
            )}\n` +
            `Remaining balance: ${formatPrice(
              remainingCents
            )}`
          )
        ) {
          return;
        }


        depositButton.disabled =
          true;

        depositButton.textContent =
          'Creating…';


        try {

          await callAdminApi(
            '/api/admin/commission-deposit',
            {
              commissionId:
                id,

              totalCents,

              depositCents
            }
          );


          alert(
            'Deposit payment request emailed to the customer.'
          );


          await fetchRows();


          const article =
            depositButton.closest(
              '.commission-request'
            );


          const block =
            article &&
            findPaymentBlock(
              article
            );


          const item =
            rowsById.get(
              id
            );


          if (
            block &&
            item
          ) {
            renderPaymentBlock(
              block,
              item
            );
          }

        } catch (error) {

          alert(
            error.message ||
            String(
              error
            )
          );


          depositButton.disabled =
            false;


          depositButton.textContent =
            'Save price & email deposit';

        }


        return;
      }


      const finalButton =
        event.target.closest(
          '[data-v2-send-final]'
        );


      if (
        finalButton
      ) {

        const id =
          finalButton
            .dataset
            .v2SendFinal;


        if (
          !confirm(
            'Email the remaining commission balance now?'
          )
        ) {
          return;
        }


        finalButton.disabled =
          true;

        finalButton.textContent =
          'Creating…';


        try {

          const result =
            await callAdminApi(
              '/api/admin/commission-final-payment',
              {
                commissionId:
                  id
              }
            );


          alert(
            `Final payment request emailed for ${formatPrice(
              result.amountCents
            )}.`
          );


          await fetchRows();


          const article =
            finalButton.closest(
              '.commission-request'
            );


          const block =
            article &&
            findPaymentBlock(
              article
            );


          const item =
            rowsById.get(
              id
            );


          if (
            block &&
            item
          ) {
            renderPaymentBlock(
              block,
              item
            );
          }

        } catch (error) {

          alert(
            error.message ||
            String(
              error
            )
          );


          finalButton.disabled =
            false;


          finalButton.textContent =
            'Email final payment link';

        }
      }
    }
  );


  const observer =
    new MutationObserver(
      () => {
        scheduleRender();
      }
    );


  observer.observe(
    list,
    {
      childList:
        true,

      subtree:
        true
    }
  );


  window.addEventListener(
    'load',
    scheduleRender
  );


  scheduleRender();

})();
