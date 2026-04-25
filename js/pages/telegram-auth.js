(function () {
  const button = document.querySelector('[data-telegram-auth]');
  const msgEl = document.getElementById('loginMsg') || document.getElementById('registerMsg');
  if (!button || !msgEl) return;

  function setMsg(text, isError = false) {
    msgEl.textContent = text || '';
    msgEl.classList.toggle('is-error', !!text && !!isError);
    msgEl.classList.toggle('is-success', !!text && !isError);
  }

  function setLoading(loading) {
    button.disabled = !!loading;
    button.classList.toggle('is-loading', !!loading);
    button.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  function buildSetupText(data, mode) {
    const missing = Array.isArray(data?.missing) ? data.missing : [];
    if (!missing.length) {
      return mode === 'register'
        ? 'Telegram-регистрация почти готова. Когда появится публичный URL сайта, подключим её без переделки дизайна.'
        : 'Telegram-вход почти готов. Когда появится публичный URL сайта, подключим его без переделки дизайна.';
    }

    const map = {
      TELEGRAM_BOT_USERNAME: 'username бота',
      TELEGRAM_BOT_TOKEN: 'token бота',
      TELEGRAM_LOGIN_URL: 'публичный URL сайта',
    };

    const parts = missing.map((key) => map[key] || key);
    return mode === 'register'
      ? `Telegram-регистрация уже подготовлена в коде. Для запуска позже добавь: ${parts.join(', ')}.`
      : `Telegram-вход уже подготовлен в коде. Для запуска позже добавь: ${parts.join(', ')}.`;
  }

  async function loadConfig() {
    const res = await fetch('/api/auth/telegram-config');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'telegram_config_failed');
    }
    return data || {};
  }

  async function onClick() {
    const mode = button.getAttribute('data-telegram-auth') === 'register' ? 'register' : 'login';
    setLoading(true);
    try {
      const config = await loadConfig();

      if (!config?.enabled || !config?.authUrl) {
        setMsg(buildSetupText(config, mode), false);
        return;
      }

      const popup = window.open(
        config.authUrl,
        'telegram_auth',
        'popup=yes,width=520,height=760,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no'
      );

      if (!popup) {
        setMsg('Браузер заблокировал окно Telegram. Разреши popup и попробуй снова.', true);
        return;
      }

      setMsg(mode === 'register'
        ? 'Открыли Telegram для регистрации. После подключения домена сценарий заработает полностью.'
        : 'Открыли Telegram для входа. После подключения домена сценарий заработает полностью.');
    } catch (err) {
      console.error('telegram auth init failed', err);
      setMsg('Не удалось подготовить Telegram-вход.', true);
    } finally {
      setLoading(false);
    }
  }

  button.addEventListener('click', onClick);
})();
