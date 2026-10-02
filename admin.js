(() => {
  const cfg = window.AFK_CONFIG || {};
  const setupPanel = document.getElementById('setupPanel');
  const authPanel = document.getElementById('authPanel');
  const adminPanel = document.getElementById('adminPanel');
  const signOutBtn = document.getElementById('signOutBtn');
  const loginMessage = document.getElementById('loginMessage');
  const productForm = document.getElementById('productForm');
  const listingList = document.getElementById('listingList');
  const saveMessage = document.getElementById('saveMessage');
  const editorTitle = document.getElementById('editorTitle');
  const commissionAdmin = document.getElementById('commissionAdmin');
  const commercialAdmin = document.getElementById('commercialAdmin');
  const commercialPlanForm = document.getElementById('commercialPlanForm');
  const commercialPlanMessage = document.getElementById('commercialPlanMessage');
  const commissionRequestList = document.getElementById('commissionRequestList');

  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes('PASTE_') &&
    !cfg.SUPABASE_ANON_KEY.includes('PASTE_');

  if (!configured) {
    setupPanel.hidden = false;
    return;
  }

  const sb = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  let listings = [];
  let showHiddenListings = false;

  const moneyToCents = value =>
    value === '' ? null : Math.round(Number(value) * 100);

  const centsToMoney = value =>
    value == null ? '' : (Number(value) / 100).toFixed(2);

  const slugify = value =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120);

  const uniquePath = (folder, file) =>
    `${folder}/${crypto.randomUUID()}-${file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    )}`;

  const adminEmail = String(
    cfg.ADMIN_EMAIL || 'admin@afkprobably.com'
  ).toLowerCase();

  async function boot() {
    const {
      data: { session }
    } = await sb.auth.getSession();

    await renderAuth(session);

    sb.auth.onAuthStateChange(async (_event, sessionNow) => {
      await renderAuth(sessionNow);
    });
  }

  async function renderAuth(session) {
    const signedIn = Boolean(session);

    const isAdmin =
      signedIn &&
      String(session.user?.email || '').toLowerCase() === adminEmail;

    authPanel.hidden = isAdmin;
    adminPanel.hidden = !isAdmin;
    commissionAdmin.hidden = !isAdmin;
    commercialAdmin.hidden = !isAdmin;
    signOutBtn.hidden = !signedIn;

    if (!signedIn) {
      loginMessage.textContent =
        'Sign in with your AFKProbably account, then return to this page.';
      return;
    }

    if (!isAdmin) {
      loginMessage.textContent =
        'This account does not have admin access.';
      return;
    }

    loginMessage.textContent = '';

    await loadListings();
    await loadCommissions();
    await loadCommercialPlans();
  }

  signOutBtn.addEventListener('click', () => sb.auth.signOut());

  document
    .getElementById('refreshBtn')
    .addEventListener('click', loadListings);

  document
    .getElementById('resetFormBtn')
    .addEventListener('click', resetForm);

  document
    .getElementById('refreshCommissionsBtn')
    ?.addEventListener('click', loadCommissions);

  function resetForm() {
    productForm.reset();
    document.getElementById('productId').value = '';
    editorTitle.textContent = 'Add a mesh';
    saveMessage.textContent = '';
  }

  async function loadListings() {
    listingList.innerHTML = '<p>Loading…</p>';

    const { data, error } = await sb
      .from('products')
      .select('*, product_images(*)')
      .order('created_at', { ascending: false });

    if (error) {
      listingList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
      return;
    }

    const allListings = data || [];

    listings = showHiddenListings
      ? allListings
      : allListings.filter(item => item.status !== 'hidden');

    const hiddenCount = allListings.filter(
      item => item.status === 'hidden'
    ).length;

    const toggleHtml = `
      <div
        class="listing-visibility-toggle"
        style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap"
      >
        <button
          type="button"
          class="tiny-button"
          id="toggleHiddenListingsBtn"
        >
          ${
            showHiddenListings
              ? 'Hide hidden listings'
              : `Show hidden listings${
                  hiddenCount ? ` (${hiddenCount})` : ''
                }`
          }
        </button>
      </div>
    `;

    if (!listings.length) {
      listingList.innerHTML =
        toggleHtml +
        `<p>${
          showHiddenListings
            ? 'No products yet.'
            : 'No active or draft products yet.'
        }</p>`;

      document
        .getElementById('toggleHiddenListingsBtn')
        ?.addEventListener('click', async () => {
          showHiddenListings = !showHiddenListings;
          await loadListings();
        });

      return;
    }

    listingList.innerHTML =
      toggleHtml +
      listings
        .map(
          item => `
      <article class="listing-item">

        <div class="listing-row">
          <span class="listing-name">
            ${escapeHtml(item.name)}
          </span>

          <span class="status-pill">
            ${escapeHtml(item.status)}
          </span>
        </div>

        <div class="listing-meta">
          Personal ${formatPrice(item.personal_price_cents)}
        </div>

        <div class="listing-buttons">

          <button
            class="tiny-button"
            data-edit="${item.id}"
          >
            Edit
          </button>

          <button
            class="tiny-button danger"
            data-delete="${item.id}"
          >
            Delete
          </button>

        </div>

      </article>
    `
        )
        .join('');

    document
      .getElementById('toggleHiddenListingsBtn')
      ?.addEventListener('click', async () => {
        showHiddenListings = !showHiddenListings;
        await loadListings();
      });

    listingList
      .querySelectorAll('[data-edit]')
      .forEach(btn =>
        btn.addEventListener('click', () =>
          editListing(btn.dataset.edit)
        )
      );

    listingList
      .querySelectorAll('[data-delete]')
      .forEach(btn =>
        btn.addEventListener('click', () =>
          deleteListing(btn.dataset.delete)
        )
      );
  }

  function editListing(id) {
    const item = listings.find(x => x.id === id);

    if (!item) return;

    document.getElementById('productId').value = item.id;
    document.getElementById('name').value = item.name || '';
    document.getElementById('category').value = item.category || '';
    document.getElementById('status').value = item.status || 'draft';

    document.getElementById('personalPrice').value =
      centsToMoney(item.personal_price_cents);

    document.getElementById('description').value =
      item.description || '';

    document.getElementById('printNotes').value =
      item.print_notes || '';

    editorTitle.textContent = `Edit ${item.name}`;

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  async function deleteListing(id) {
    const item = listings.find(x => x.id === id);

    const label = item?.name
      ? `“${item.name}”`
      : 'this listing';

    if (
      !confirm(
        `Remove ${label} from the shop?

If it has never been purchased, it will be deleted permanently.

If a customer has purchased it, it will be hidden instead so their order/download history stays intact.`
      )
    ) {
      return;
    }

    const {
      data: { session }
    } = await sb.auth.getSession();

    if (!session?.access_token) {
      alert(
        'Your admin session expired. Please sign in again.'
      );
      return;
    }

    try {
      const response = await fetch('/api/admin/remove-product', {
        method: 'POST',

        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`
        },

        body: JSON.stringify({
          productId: id
        })
      });

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            'Could not remove this listing.'
        );
      }

      if (result.action === 'hidden') {
        alert(
          'This product has purchase history, so it was hidden from the shop instead of deleting customer order history.'
        );
      }

      await loadListings();

      if (
        document.getElementById('productId').value === id
      ) {
        resetForm();
      }
    } catch (error) {
      alert(error.message || String(error));
    }
  }

  productForm.addEventListener('submit', async e => {
    e.preventDefault();

    saveMessage.textContent = 'Saving…';

    document.getElementById('saveBtn').disabled = true;

    try {
      const existingId =
        document.getElementById('productId').value || null;

      const name =
        document.getElementById('name').value.trim();

      const payload = {
        name,
        slug: slugify(name),

        category:
          document
            .getElementById('category')
            .value.trim() || null,

        status:
          document.getElementById('status').value,

        personal_price_cents:
          moneyToCents(
            document.getElementById('personalPrice').value
          ),

        description:
          document
            .getElementById('description')
            .value.trim() || null,

        print_notes:
          document
            .getElementById('printNotes')
            .value.trim() || null,

        updated_at:
          new Date().toISOString()
      };

      let product;

      if (existingId) {
        const { data, error } = await sb
          .from('products')
          .update(payload)
          .eq('id', existingId)
          .select()
          .single();

        if (error) throw error;

        product = data;
      } else {
        const { data, error } = await sb
          .from('products')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        product = data;

        document.getElementById('productId').value =
          product.id;
      }

      const imageFiles = [
        ...document.getElementById('imageFiles').files
      ];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];

        const path = uniquePath(product.id, file);

        const upload = await sb.storage
          .from('product-images')
          .upload(path, file, {
            upsert: false
          });

        if (upload.error) {
          throw upload.error;
        }

        const { data: pub } = sb.storage
          .from('product-images')
          .getPublicUrl(path);

        const { error: imageRowError } = await sb
          .from('product_images')
          .insert({
            product_id: product.id,
            storage_path: path,
            public_url: pub.publicUrl,
            sort_order: i
          });

        if (imageRowError) {
          throw imageRowError;
        }
      }

      const meshFiles = [
        ...document.getElementById('meshFiles').files
      ];

      for (const file of meshFiles) {
        const path = uniquePath(product.id, file);

        const upload = await sb.storage
          .from('mesh-files')
          .upload(path, file, {
            upsert: false
          });

        if (upload.error) {
          throw upload.error;
        }

        const { error: meshRowError } = await sb
          .from('product_files')
          .insert({
            product_id: product.id,
            storage_path: path,
            original_name: file.name,
            file_size: file.size
          });

        if (meshRowError) {
          throw meshRowError;
        }
      }

      saveMessage.textContent = 'Saved ✓';

      document.getElementById('imageFiles').value = '';
      document.getElementById('meshFiles').value = '';

      await loadListings();
    } catch (err) {
      saveMessage.textContent =
        err.message || String(err);
    } finally {
      document.getElementById('saveBtn').disabled =
        false;
    }
  });

  async function loadCommercialPlans() {
    if (!commercialAdmin) return;

    const { data, error } = await sb
      .from('commercial_license_plans')
      .select('*');

    if (error) {
      commercialPlanMessage.textContent =
        error.code === '42P01'
          ? 'Run supabase/commercial-license-upgrade.sql first.'
          : error.message;

      return;
    }

    const byType = Object.fromEntries(
      (data || []).map(row => [
        row.plan_type,
        row
      ])
    );

    document.getElementById(
      'monthlyCommercialPrice'
    ).value =
      centsToMoney(
        byType.monthly?.price_cents
      );

    document.getElementById(
      'lifetimeCommercialPrice'
    ).value =
      centsToMoney(
        byType.lifetime?.price_cents
      );

    document.getElementById(
      'monthlyCommercialActive'
    ).value =
      String(
        byType.monthly?.active !== false
      );

    document.getElementById(
      'lifetimeCommercialActive'
    ).value =
      String(
        byType.lifetime?.active !== false
      );
  }

  commercialPlanForm?.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      commercialPlanMessage.textContent =
        'Saving…';

      const rows = [
        {
          plan_type: 'monthly',

          price_cents:
            moneyToCents(
              document.getElementById(
                'monthlyCommercialPrice'
              ).value
            ),

          active:
            document.getElementById(
              'monthlyCommercialActive'
            ).value === 'true',

          updated_at:
            new Date().toISOString()
        },

        {
          plan_type: 'lifetime',

          price_cents:
            moneyToCents(
              document.getElementById(
                'lifetimeCommercialPrice'
              ).value
            ),

          active:
            document.getElementById(
              'lifetimeCommercialActive'
            ).value === 'true',

          updated_at:
            new Date().toISOString()
        }
      ];

      if (
        rows.some(
          row =>
            row.price_cents != null &&
            row.price_cents < 50
        )
      ) {
        commercialPlanMessage.textContent =
          'Prices must be at least $0.50.';

        return;
      }

      const { error } = await sb
        .from('commercial_license_plans')
        .upsert(rows, {
          onConflict: 'plan_type'
        });

      commercialPlanMessage.textContent =
        error
          ? error.message
          : 'Saved ✓';
    }
  );

  async function loadCommissions() {
    if (
      !commissionAdmin ||
      !commissionRequestList
    ) {
      return;
    }

    commissionAdmin.hidden = false;

    commissionRequestList.innerHTML =
      '<p class="commission-empty">Loading…</p>';

    const { data, error } = await sb
      .from('commission_requests')
      .select('*, commission_payments(*)')
      .order('created_at', {
        ascending: false
      });

    if (error) {
      commissionRequestList.innerHTML =
        `<p class="commission-empty">${
          error.code === '42P01'
            ? 'Run the commission payments SQL first.'
            : escapeHtml(error.message)
        }</p>`;

      return;
    }

    const rows = data || [];

    if (!rows.length) {
      commissionRequestList.innerHTML =
        '<p class="commission-empty">No commission requests yet.</p>';

      return;
    }

    const statuses = [
      'new',
      'reviewing',
      'quoted',
      'accepted',
      'declined',
      'completed'
    ];

    commissionRequestList.innerHTML =
      rows
        .map(
          item => `
      <article class="commission-request">

        <div class="commission-request-head">

          <div>
            <h3>
              ${escapeHtml(item.name)}
              ·
              ${escapeHtml(item.project_type)}
            </h3>

            <div class="commission-request-meta">

              <span>
                ${escapeHtml(item.email)}
              </span>

              ${
                item.budget
                  ? `<span>${escapeHtml(item.budget)}</span>`
                  : ''
              }

              ${
                item.desired_deadline
                  ? `<span>Deadline ${escapeHtml(
                      item.desired_deadline
                    )}</span>`
                  : ''
              }

            </div>
          </div>

          <select
            data-commission-status="${item.id}"
            aria-label="Commission status"
          >

            ${statuses
              .map(
                status => `
              <option
                value="${status}"
                ${
                  status === item.status
                    ? 'selected'
                    : ''
                }
              >
                ${status}
              </option>
            `
              )
              .join('')}

          </select>

        </div>

        <p>
          ${escapeHtml(item.description)}
        </p>

        ${
          item.reference_links
            ? `
          <a
            href="${escapeHtml(
              item.reference_links
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open reference link
          </a>
        `
            : ''
        }

        <div
          style="margin-top:18px;padding-top:16px;border-top:1px solid rgba(78,30,120,.14)"
        >
          <p class="eyebrow" style="margin-bottom:8px">MESSAGE CUSTOMER</p>

          <label style="display:block;margin-bottom:8px">
            Subject
            <input
              type="text"
              data-commission-subject="${item.id}"
              value="${escapeHtml(`AFKProbably commission — ${item.project_type || item.name}`)}"
              maxlength="180"
              style="width:100%;margin-top:6px"
            >
          </label>

          <label style="display:block">
            Message
            <textarea
              data-commission-message="${item.id}"
              rows="5"
              maxlength="5000"
              placeholder="Write your message to ${escapeHtml(item.name)}…"
              style="width:100%;margin-top:6px"
            ></textarea>
          </label>

          <div class="listing-buttons" style="margin-top:10px">
            <button
              class="tiny-button"
              type="button"
              data-email-commission="${item.id}"
            >
              Email customer
            </button>
          </div>
        </div>

        <div
          style="margin-top:18px;padding-top:16px;border-top:1px solid rgba(78,30,120,.14)"
        >
          <p class="eyebrow" style="margin-bottom:8px">PAYMENT REQUEST</p>

          <div style="display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:10px">
            <label>
              Description
              <input
                type="text"
                data-payment-label="${item.id}"
                placeholder="50% commission deposit"
                maxlength="180"
                style="width:100%;margin-top:6px"
              >
            </label>

            <label>
              Amount ($)
              <input
                type="number"
                data-payment-amount="${item.id}"
                min="0.50"
                step="0.01"
                placeholder="75.00"
                style="width:100%;margin-top:6px"
              >
            </label>
          </div>

          <div class="listing-buttons" style="margin-top:10px">
            <button
              class="tiny-button"
              type="button"
              data-payment-commission="${item.id}"
            >
              Create &amp; email payment link
            </button>
          </div>

          <div style="margin-top:12px">
            ${
              (item.commission_payments || []).length
                ? [...item.commission_payments]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map(payment => `
                      <div
                        style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:9px 0;border-top:1px solid rgba(78,30,120,.10)"
                      >
                        <div>
                          <strong>${escapeHtml(payment.label || 'Commission payment')}</strong>
                          <div class="commission-request-meta">
                            <span>${formatPrice(payment.amount_cents)}</span>
                            <span>${escapeHtml(String(payment.status || 'unpaid').toUpperCase())}</span>
                          </div>
                        </div>
                        ${
                          payment.status !== 'paid' && payment.stripe_checkout_url
                            ? `<a class="tiny-button" href="${escapeHtml(payment.stripe_checkout_url)}" target="_blank" rel="noopener noreferrer">Open checkout</a>`
                            : payment.status === 'paid'
                              ? '<strong>Paid ✓</strong>'
                              : ''
                        }
                      </div>
                    `)
                    .join('')
                : '<p class="commission-empty" style="margin:6px 0 0">No payment requests yet.</p>'
            }
          </div>
        </div>

        <div
          class="listing-buttons"
          style="margin-top:18px"
        >

          <button
            class="tiny-button danger"
            type="button"
            data-delete-commission="${item.id}"
          >
            Delete request
          </button>

        </div>

      </article>
    `
        )
        .join('');

    commissionRequestList
      .querySelectorAll(
        '[data-commission-status]'
      )
      .forEach(select =>
        select.addEventListener(
          'change',
          async () => {
            const {
              error: updateError
            } = await sb
              .from('commission_requests')
              .update({
                status: select.value
              })
              .eq(
                'id',
                select.dataset
                  .commissionStatus
              );

            if (updateError) {
              alert(
                updateError.message
              );
            }
          }
        )
      );

    commissionRequestList
      .querySelectorAll('[data-email-commission]')
      .forEach(button => {
        button.addEventListener('click', async () => {
          const id = button.dataset.emailCommission;

          const subject = commissionRequestList
            .querySelector(`[data-commission-subject="${id}"]`)
            ?.value.trim() || '';

          const message = commissionRequestList
            .querySelector(`[data-commission-message="${id}"]`)
            ?.value.trim() || '';

          if (!message) {
            alert('Write a message first.');
            return;
          }

          button.disabled = true;
          button.textContent = 'Sending…';

          try {
            await callAdminApi('/api/admin/commission-email', {
              commissionId: id,
              subject,
              message
            });

            alert('Email sent to the customer.');

            const messageBox = commissionRequestList
              .querySelector(`[data-commission-message="${id}"]`);

            if (messageBox) {
              messageBox.value = '';
            }
          } catch (error) {
            alert(error.message || String(error));
          } finally {
            button.disabled = false;
            button.textContent = 'Email customer';
          }
        });
      });

    commissionRequestList
      .querySelectorAll('[data-payment-commission]')
      .forEach(button => {
        button.addEventListener('click', async () => {
          const id = button.dataset.paymentCommission;

          const label = commissionRequestList
            .querySelector(`[data-payment-label="${id}"]`)
            ?.value.trim() || '';

          const amountValue = commissionRequestList
            .querySelector(`[data-payment-amount="${id}"]`)
            ?.value || '';

          const amountCents = Math.round(Number(amountValue) * 100);

          if (!label) {
            alert(
              'Add a payment description, such as “50% commission deposit”.'
            );
            return;
          }

          if (
            !Number.isInteger(amountCents) ||
            amountCents < 50
          ) {
            alert(
              'Enter a payment amount of at least $0.50.'
            );
            return;
          }

          if (
            !confirm(
              `Create and email a ${formatPrice(
                amountCents
              )} payment request?`
            )
          ) {
            return;
          }

          button.disabled = true;
          button.textContent = 'Creating…';

          try {
            const result = await callAdminApi(
              '/api/admin/commission-payment',
              {
                commissionId: id,
                label,
                amountCents
              }
            );

            alert(
              `Payment request emailed to the customer for ${formatPrice(
                result.amountCents
              )}.`
            );

            await loadCommissions();
          } catch (error) {
            alert(error.message || String(error));
            button.disabled = false;
            button.textContent =
              'Create & email payment link';
          }
        });
      });

    commissionRequestList
      .querySelectorAll(
        '[data-delete-commission]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          async () => {
            const id =
              button.dataset
                .deleteCommission;

            if (
              !confirm(
                'Delete this commission request permanently?'
              )
            ) {
              return;
            }

            button.disabled = true;
            button.textContent =
              'Deleting…';

            const {
              error: deleteError
            } = await sb
              .from(
                'commission_requests'
              )
              .delete()
              .eq('id', id);

            if (deleteError) {
              alert(
                deleteError.message
              );

              button.disabled =
                false;

              button.textContent =
                'Delete request';

              return;
            }

            await loadCommissions();
          }
        );
      });
  }

  async function callAdminApi(path, body) {
    const {
      data: { session }
    } = await sb.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        'Your admin session expired. Please sign in again.'
      );
    }

    const response = await fetch(path, {
      method: 'POST',

      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`
      },

      body: JSON.stringify(body)
    });

    const result = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error ||
          'Request failed.'
      );
    }

    return result;
  }

  function formatPrice(cents) {
    return cents == null
      ? '—'
      : `$${(
          Number(cents) / 100
        ).toFixed(2)}`;
  }

  function escapeHtml(value = '') {
    return String(value).replace(
      /[&<>'"]/g,
      ch =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#039;',
          '"': '&quot;'
        }[ch])
    );
  }

  boot();
})();
