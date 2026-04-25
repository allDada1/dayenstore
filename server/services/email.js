function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createEmailService() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  const appBaseUrl = String(process.env.APP_BASE_URL || 'http://localhost:3000').trim().replace(/\/$/, '');

  async function sendViaResend({ to, subject, html, text }) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.message || data?.error || `resend_http_${res.status}`;
      throw new Error(message);
    }
    return data;
  }

  async function sendPasswordResetEmail({ to, name, resetUrl }) {
    const safeName = escapeHtml(name || 'пользователь');
    const safeUrl = escapeHtml(resetUrl);
    const subject = 'Сброс пароля — Store';
    const text = [
      `Здравствуйте, ${name || 'пользователь'}!`,
      '',
      'Вы запросили сброс пароля для аккаунта Store.',
      `Откройте ссылку, чтобы задать новый пароль: ${resetUrl}`,
      '',
      'Если вы не запрашивали сброс, просто проигнорируйте это письмо.',
      'Ссылка действует ограниченное время.',
    ].join('\n');

    const html = `
      <div style="margin:0;padding:24px;background:#0b1220;color:#eaf1ff;font-family:Arial,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:28px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:linear-gradient(180deg,#111827,#0f172a);">
          <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#95b8ff;margin-bottom:12px;">Store</div>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;">Сброс пароля</h1>
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#d7e2ff;">Здравствуйте, ${safeName}. Вы запросили сброс пароля для аккаунта Store.</p>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#c8d6ff;">Нажмите на кнопку ниже, чтобы задать новый пароль. Ссылка действует ограниченное время.</p>
          <a href="${safeUrl}" style="display:inline-block;padding:14px 18px;border-radius:14px;background:linear-gradient(135deg,#6fa7ff,#8d7dff);color:#fff;text-decoration:none;font-weight:700;">Сбросить пароль</a>
          <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#91a4d2;">Если кнопка не открывается, скопируйте ссылку вручную:<br><span style="word-break:break-all;color:#dce7ff;">${safeUrl}</span></p>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#91a4d2;">Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
        </div>
      </div>`;

    if (!apiKey || !from) {
      console.log('[auth:reset-email:dev]', { to, resetUrl, mode: 'console_fallback' });
      return { ok: true, mode: 'console_fallback' };
    }

    const data = await sendViaResend({ to, subject, html, text });
    return { ok: true, mode: 'resend', data };
  }

  return {
    appBaseUrl,
    sendPasswordResetEmail,
  };
}

module.exports = { createEmailService };
