(() => {

  const cfg = window.AFK_CONFIG || {};

  const authCard =
    document.getElementById('libraryAuth');

  const libraryView =
    document.getElementById('libraryView');

  const loginForm =
    document.getElementById('libraryLoginForm');

  const createAccountBtn =
    document.getElementById('createAccountBtn');

  const resendConfirmationBtn =
    document.getElementById('resendConfirmationBtn');

  const forgotPasswordBtn =
    document.getElementById('forgotPasswordBtn');

  const passwordResetCard =
    document.getElementById('passwordResetCard');

  const passwordResetForm =
    document.getElementById('passwordResetForm');

  const newPasswordInput =
    document.getElementById('newPassword');

  const confirmNewPasswordInput =
    document.getElementById('confirmNewPassword');

  const passwordResetMessage =
    document.getElementById('passwordResetMessage');

  const adminAccessBtn =
    document.getElementById('adminAccessBtn');

  const authMessage =
    document.getElementById('libraryAuthMessage');

  const emailInput =
    document.getElementById('libraryEmail');

  const passwordInput =
    document.getElementById('libraryPassword');

  const grid =
    document.getElementById('libraryGrid');

  const empty =
    document.getElementById('libraryEmpty');

  const emailLabel =
    document.getElementById('libraryEmailLabel');

  const signOutBtn =
    document.getElementById('librarySignOut');

  const marketingOptIn =
    document.getElementById('marketingOptIn');

  const libraryMarketingOptIn =
    document.getElementById('libraryMarketingOptIn');

  const marketingPreferenceMessage =
    document.getElementById('marketingPreferenceMessage');


  /*
    ADMIN EMAIL

    Only this account gets the Admin Dashboard button.
  */

  const adminEmail =
    String(
      cfg.ADMIN_EMAIL ||
      'admin@afkprobably.com'
    )
      .trim()
      .toLowerCase();


  /*
    SUPABASE CONFIG CHECK
  */

  if (
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    !window.supabase
  ) {

    authMessage.textContent =
      'Account login is not configured yet.';

    return;
  }


  const sb =
    window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );


  /*
    WHERE EMAIL CONFIRMATIONS RETURN
  */

  const confirmationRedirect =
    `${window.location.origin}/library.html`;

  const passwordResetRedirect =
    `${window.location.origin}/library.html?reset=1`;

  let passwordRecoveryMode =
    new URLSearchParams(window.location.search)
      .get('reset') === '1';

  let currentUserId = null;
  let currentAccessToken = '';


  /*
    BOOT
  */

  async function boot() {

    const {
      data: {
        session
      }
    } =
      await sb.auth.getSession();


    if (passwordRecoveryMode && session) {
      showPasswordReset();
    } else {
      await renderSession(session);
    }


    sb.auth.onAuthStateChange(
      async (event, nextSession) => {

        if (event === 'PASSWORD_RECOVERY') {
          passwordRecoveryMode = true;
          showPasswordReset();
          return;
        }

        if (passwordRecoveryMode && nextSession) {
          showPasswordReset();
          return;
        }

        await renderSession(nextSession);

      }
    );

  }


  /*
    SIGNED IN / SIGNED OUT VIEW
  */

  async function renderSession(session) {

    const signedIn =
      Boolean(session);


    passwordResetCard.hidden = true;

    authCard.hidden =
      signedIn;


    libraryView.hidden =
      !signedIn;


    /*
      Hide Admin button by default.
    */

    adminAccessBtn.hidden = true;


    if (!signedIn) {
      currentUserId = null;
      currentAccessToken = '';
      return;
    }

    currentUserId = session.user?.id || null;
    currentAccessToken = session.access_token || '';


    const currentEmail =
      String(
        session.user?.email || ''
      )
        .trim()
        .toLowerCase();


    emailLabel.textContent =
      session.user?.email || '';


    /*
      ADMIN BUTTON ONLY APPEARS
      FOR YOUR ADMIN ACCOUNT.
    */

    if (
      currentEmail === adminEmail
    ) {

      adminAccessBtn.hidden = false;

    }


    await Promise.all([
      loadLibrary(session.access_token),
      loadMarketingPreference()
    ]);

  }


  /*
    LOAD PURCHASED PRODUCTS
  */

  async function loadLibrary(token) {

    grid.innerHTML =
      '<p>Loading your purchases…</p>';


    empty.hidden = true;


    const response =
      await fetch(
        '/api/library',
        {
          headers: {
            authorization:
              `Bearer ${token}`
          },

          cache:
            'no-store'
        }
      );


    const data =
      await response.json()
        .catch(() => ({}));


    if (!response.ok) {

      grid.innerHTML =
        `<p>${
          escapeHtml(
            data.error ||
            'Could not load your library.'
          )
        }</p>`;

      return;
    }


    const purchases =
      data.purchases || [];


    if (!purchases.length) {

      grid.innerHTML = '';

      empty.hidden = false;

      return;
    }


    grid.innerHTML =
      purchases
        .map(item => {

          const product =
            item.product || {};


          const image =
            product.images?.[0]
              ?.public_url;


          const downloads =
            item.hasFiles
              ? `

                <button
                  class="download-button library-bundle-download"
                  type="button"
                  data-product-id="${escapeAttr(product.id || '')}"
                  data-license-type="${escapeAttr(item.licenseType || 'personal')}"
                  data-file-name="${escapeAttr(item.bundleName || 'AFKProbably-download.zip')}"
                >
                  Download ZIP
                </button>

              `
              : '';


          return `

            <article class="library-card">

              <div class="library-card-image">

                ${
                  image
                    ? `

                      <img
                        src="${escapeAttr(image)}"
                        alt="${escapeAttr(product.name || '')}"
                      >

                    `
                    : `

                      <img
                        class="placeholder-moon"
                        src="assets/moon-mark.png"
                        alt=""
                      >

                    `
                }

              </div>


              <div class="library-card-body">

                ${
                  product.category
                    ? `

                      <p class="card-category">
                        ${escapeHtml(product.category)}
                      </p>

                    `
                    : ''
                }


                <h2>
                  ${
                    escapeHtml(
                      product.name ||
                      'Purchased mesh'
                    )
                  }
                </h2>


                <span class="owned-pill">

                  ${
                    capitalize(
                      item.licenseType
                    )
                  } license · Owned

                </span>


                <div class="library-downloads">

                  ${
                    downloads ||
                    '<p>No files are attached to this mesh yet.</p>'
                  }

                </div>


                <a
                  class="secondary-link"
                  href="product.html?id=${
                    encodeURIComponent(
                      product.id || ''
                    )
                  }"
                >
                  View product
                </a>

              </div>

            </article>

          `;

        })
        .join('');

  }


  grid.addEventListener(
    'click',
    async event => {
      const button =
        event.target.closest('.library-bundle-download');

      if (!button) return;

      if (!currentAccessToken) {
        alert('Please sign in again before downloading.');
        return;
      }

      const productId = button.dataset.productId;
      const fileName =
        button.dataset.fileName ||
        'AFKProbably-download.zip';

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Preparing ZIP…';

      try {
        const response = await fetch(
          `/api/library-download?product_id=${encodeURIComponent(productId)}`,
          {
            headers: {
              authorization: `Bearer ${currentAccessToken}`
            },
            cache: 'no-store'
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Could not create the ZIP download.');
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } catch (error) {
        alert(error.message || String(error));
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  );


  /*
    MARKETING EMAIL PREFERENCE
  */

  async function loadMarketingPreference() {

    if (!libraryMarketingOptIn) return;

    libraryMarketingOptIn.disabled = true;
    marketingPreferenceMessage.textContent = '';

    const { data, error } =
      await sb
        .from('newsletter_subscribers')
        .select('subscribed')
        .eq('user_id', currentUserId)
        .maybeSingle();

    libraryMarketingOptIn.disabled = false;

    if (error) {
      marketingPreferenceMessage.textContent =
        'Email preferences are not available until the newsletter database upgrade is installed.';
      return;
    }

    libraryMarketingOptIn.checked = Boolean(data?.subscribed);

  }


  libraryMarketingOptIn?.addEventListener(
    'change',
    async () => {

      const desired = libraryMarketingOptIn.checked;
      libraryMarketingOptIn.disabled = true;
      marketingPreferenceMessage.textContent = 'Saving…';

      const { error } =
        await sb.rpc('set_newsletter_preference', {
          desired
        });

      libraryMarketingOptIn.disabled = false;

      if (error) {
        libraryMarketingOptIn.checked = !desired;
        marketingPreferenceMessage.textContent = error.message;
        return;
      }

      marketingPreferenceMessage.textContent =
        desired
          ? 'You’re subscribed to new print and shop updates.'
          : 'You’re unsubscribed from promotional emails.';

    }
  );


  /*
    PASSWORD RECOVERY VIEW
  */

  function showPasswordReset() {

    authCard.hidden = true;
    libraryView.hidden = true;
    passwordResetCard.hidden = false;
    passwordResetMessage.textContent = '';

    setTimeout(() => {
      newPasswordInput.focus();
    }, 0);

  }


  /*
    SIGN IN
  */

  loginForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      authMessage.textContent =
        'Signing in…';


      const email =
        emailInput.value
          .trim();


      const password =
        passwordInput.value;


      const {
        error
      } =
        await sb.auth
          .signInWithPassword({
            email,
            password
          });


      if (error) {

        /*
          Give a clearer message for unconfirmed accounts.
        */

        if (
          String(error.message)
            .toLowerCase()
            .includes(
              'email not confirmed'
            )
        ) {

          authMessage.textContent =
            'Your email has not been confirmed yet. Click “Resend confirmation email” below.';

          return;
        }


        authMessage.textContent =
          error.message;

        return;
      }


      authMessage.textContent = '';

    }
  );


  /*
    FORGOT PASSWORD
  */

  forgotPasswordBtn.addEventListener(
    'click',
    async () => {

      const email =
        emailInput.value.trim();

      if (!email) {
        authMessage.textContent =
          'Enter your email address first, then click “Forgot password?”.';
        emailInput.focus();
        return;
      }

      forgotPasswordBtn.disabled = true;
      authMessage.textContent =
        'Sending password reset email…';

      const { error } =
        await sb.auth.resetPasswordForEmail(
          email,
          {
            redirectTo:
              passwordResetRedirect
          }
        );

      forgotPasswordBtn.disabled = false;

      if (error) {
        authMessage.textContent = error.message;
        return;
      }

      authMessage.textContent =
        'If an AFKProbably account exists for that email, a password reset link has been sent. Check your inbox and spam folder.';

    }
  );


  /*
    SAVE NEW PASSWORD
  */

  passwordResetForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();

      const newPassword =
        newPasswordInput.value;

      const confirmedPassword =
        confirmNewPasswordInput.value;

      if (newPassword.length < 6) {
        passwordResetMessage.textContent =
          'Your new password must be at least 6 characters.';
        return;
      }

      if (newPassword !== confirmedPassword) {
        passwordResetMessage.textContent =
          'The two passwords do not match.';
        return;
      }

      const submitButton =
        passwordResetForm.querySelector('button[type="submit"]');

      submitButton.disabled = true;
      passwordResetMessage.textContent =
        'Saving your new password…';

      const { error } =
        await sb.auth.updateUser({
          password: newPassword
        });

      submitButton.disabled = false;

      if (error) {
        passwordResetMessage.textContent = error.message;
        return;
      }

      passwordRecoveryMode = false;
      passwordResetMessage.textContent =
        'Password updated. Opening your library…';

      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${window.location.hash || ''}`
      );

      const { data: { session } } =
        await sb.auth.getSession();

      newPasswordInput.value = '';
      confirmNewPasswordInput.value = '';

      await renderSession(session);

    }
  );


  /*
    CREATE ACCOUNT
  */

  createAccountBtn.addEventListener(
    'click',
    async () => {

      const email =
        emailInput.value
          .trim();


      const password =
        passwordInput.value;


      if (
        !email ||
        password.length < 6
      ) {

        authMessage.textContent =
          'Enter your email and a password of at least 6 characters first.';

        return;
      }


      authMessage.textContent =
        'Creating account…';


      const {
        data,
        error
      } =
        await sb.auth.signUp({

          email,

          password,

          options: {

            emailRedirectTo:
              confirmationRedirect,

            data: {
              marketing_opt_in:
                Boolean(marketingOptIn?.checked)
            }

          }

        });


      if (error) {

        authMessage.textContent =
          error.message;

        return;
      }


      if (data.session) {

        authMessage.textContent =
          'Account created. You are signed in.';

      } else {

        authMessage.textContent =
          'Account created! Check your email and click the confirmation link, then come back and sign in.';

      }

    }
  );


  /*
    RESEND CONFIRMATION EMAIL
  */

  resendConfirmationBtn
    .addEventListener(
      'click',
      async () => {

        const email =
          emailInput.value
            .trim();


        if (!email) {

          authMessage.textContent =
            'Enter your email address first.';

          emailInput.focus();

          return;
        }


        resendConfirmationBtn.disabled =
          true;


        authMessage.textContent =
          'Sending a fresh confirmation email…';


        const {
          error
        } =
          await sb.auth.resend({

            type:
              'signup',

            email,

            options: {

              emailRedirectTo:
                confirmationRedirect

            }

          });


        resendConfirmationBtn.disabled =
          false;


        if (error) {

          authMessage.textContent =
            error.message;

          return;
        }


        authMessage.textContent =
          'Fresh confirmation email sent. Check your inbox and spam folder.';

      }
    );


  /*
    SIGN OUT
  */

  signOutBtn.addEventListener(
    'click',
    async () => {

      adminAccessBtn.hidden = true;

      await sb.auth.signOut();

    }
  );


  /*
    HELPERS
  */

  function capitalize(
    value = ''
  ) {

    return value
      ? value[0].toUpperCase() +
          value.slice(1)
      : '';

  }


  function escapeHtml(
    value = ''
  ) {

    return String(value)
      .replace(
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

          })[ch]
      );

  }


  function escapeAttr(
    value = ''
  ) {

    return escapeHtml(value);

  }


  boot();

})();
