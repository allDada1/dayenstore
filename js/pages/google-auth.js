(function () {
  const loginMsg = document.getElementById('loginMsg');
  const registerMsg = document.getElementById('registerMsg');
  const msgEl = loginMsg || registerMsg;
  const button = document.getElementById('googleLoginButton') || document.getElementById('googleRegisterButton');
  if (!button) return;

  let busy = false;
  let tokenClient = null;
  let googleClientId = '';

function ensureVisibleGoogleButton() {
  if (!button) return;
  if (button.dataset.googleUiReady === 'true') return;
  button.dataset.googleUiReady = 'true';
  if (!button.querySelector('.authGoogleVisual')) {
    button.innerHTML = `
      <span class="authGoogleVisual" aria-hidden="true">
        <span class="authGoogleVisual__icon">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="#4285F4" d="M22 12.27c0-.82-.07-1.61-.21-2.36H12v4.48h5.61c-.24 1.29-.97 2.38-2.05 3.11v2.58h3.32c1.94-1.79 3.12-4.43 3.12-7.81Z"/>
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.32-2.58c-.92.62-2.09.98-3.29.98-2.53 0-4.68-1.71-5.45-4.01H3.12v2.66A9.996 9.996 0 0 0 12 22Z"/>
            <path fill="#FBBC05" d="M6.55 13.95A5.996 5.996 0 0 1 6.24 12c0-.68.12-1.34.31-1.95V7.39H3.12A9.996 9.996 0 0 0 2 12c0 1.62.39 3.15 1.12 4.61l3.43-2.66Z"/>
            <path fill="#EA4335" d="M12 6.04c1.47 0 2.78.51 3.82 1.5l2.86-2.86C16.95 3.07 14.69 2 12 2A9.996 9.996 0 0 0 3.12 7.39l3.43 2.66c.77-2.3 2.92-4.01 5.45-4.01Z"/>
          </svg>
        </span>
        <span class="authGoogleVisual__text">Войти через Google</span>
      </span>`;
  }
}

  function setMsg(text, isError = false) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.classList.toggle('is-error', !!text && !!isError);
    msgEl.classList.toggle('is-success', !!text && !isError);
  }

  function setBusy(nextBusy) {
    busy = !!nextBusy;
    button.classList.toggle('is-loading', busy);
    button.classList.toggle('is-disabled', busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');

    if ('disabled' in button) {
      button.disabled = busy;
    }

    if (busy) {
      button.setAttribute('data-google-busy', 'true');
    } else {
      button.removeAttribute('data-google-busy');
    }
  }

  async function getConfig() {
    const res = await fetch('/api/auth/google-config');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.clientId) throw new Error(data?.error || 'google_not_configured');
    return data;
  }

  async function waitForGoogle(timeoutMs = 10000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (window.google?.accounts?.oauth2 || window.google?.accounts?.id) {
        return window.google;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    throw new Error('google_sdk_not_loaded');
  }

  async function applyAuthResult(data) {
    if (window.Auth) {
      window.Auth.setToken(data.token || '');
      window.Auth.setSession(data.user || null);
    } else if (window.MarketAPI) {
      window.MarketAPI.setToken(data.token || '');
      localStorage.setItem('market_session', JSON.stringify(data.user || {}));
    }

    setMsg('Вход через Google выполнен.');
    window.location.href = 'profile.html';
  }

  async function sendGoogleAuthPayload(payload) {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorText = data?.error === 'google_not_configured'
        ? 'Google вход ещё не настроен на сервере.'
        : data?.error === 'google_email_not_verified'
          ? 'Google-аккаунт должен иметь подтверждённый email.'
          : 'Не удалось войти через Google.';
      throw new Error(errorText);
    }

    return data;
  }

  function ensureButtonAccessibility() {
    if (button.tagName !== 'BUTTON') {
      button.setAttribute('role', 'button');
      button.setAttribute('tabindex', button.getAttribute('tabindex') || '0');
    }
  }

  async function initTokenClient() {
    const config = await getConfig();
    googleClientId = String(config.clientId || '').trim();
    if (!googleClientId) throw new Error('google_not_configured');

    const google = await waitForGoogle();
    if (!google.accounts?.oauth2?.initTokenClient) {
      throw new Error('google_oauth_popup_unavailable');
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: 'openid email profile',
      callback: async (response) => {
        try {
          if (response?.error) {
            if (response.error === 'popup_closed_by_user' || response.error === 'access_denied') {
              setMsg('');
              return;
            }
            throw new Error('Не удалось войти через Google.');
          }

          const accessToken = String(response?.access_token || '').trim();
          if (!accessToken) {
            throw new Error('Google не вернул токен для входа.');
          }

          setMsg('Проверяем Google-вход...');
          const data = await sendGoogleAuthPayload({ access_token: accessToken });
          await applyAuthResult(data);
        } catch (err) {
          console.error('google auth failed', err);
          setMsg(err?.message || 'Не удалось войти через Google.', true);
        } finally {
          setBusy(false);
        }
      },
      error_callback: (error) => {
        console.warn('google popup error', error);
        if (error?.type === 'popup_closed' || error?.type === 'popup_closed_by_user') {
          setMsg('');
        } else if (error?.type === 'popup_failed_to_open') {
          setMsg('Браузер заблокировал окно Google. Разреши всплывающее окно и попробуй снова.', true);
        } else {
          setMsg('Не удалось открыть Google-вход.', true);
        }
        setBusy(false);
      },
    });
  }

  async function startGoogleLogin() {
    if (busy) return;

    try {
      setBusy(true);
      setMsg('');

      if (!tokenClient) {
        await initTokenClient();
      }

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      console.error('google init failed', err);
      const message = err?.message === 'google_not_configured'
        ? 'Google вход пока не настроен на сервере.'
        : err?.message === 'google_sdk_not_loaded'
          ? 'Google Identity Services не загрузился.'
          : 'Google вход пока недоступен.';
      setMsg(message, true);
      setBusy(false);
    }
  }

  function attachEvents() {
    button.addEventListener('click', startGoogleLogin);
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      startGoogleLogin();
    });
  }

  async function init() {
    ensureVisibleGoogleButton();
    ensureButtonAccessibility();
    attachEvents();

    try {
      await initTokenClient();
    } catch (err) {
      console.warn('google preinit skipped', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
