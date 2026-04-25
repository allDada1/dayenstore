(function () {
  function setText(el, text, isError = false) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", !!text && !!isError);
    el.classList.toggle("is-success", !!text && !isError);
  }

  function scorePassword(value) {
    const password = String(value || "");
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (password.length < 6) return { percent: 8, label: "слабый", hint: "Минимум 6 символов.", level: "weak" };
    if (score <= 2) return { percent: 32, label: "слабый", hint: "Добавь длину и цифры.", level: "weak" };
    if (score === 3) return { percent: 58, label: "средний", hint: "Неплохо, но лучше добавить символы.", level: "medium" };
    if (score === 4) return { percent: 78, label: "хороший", hint: "Хороший пароль, можно оставить так.", level: "good" };
    return { percent: 100, label: "отличный", hint: "Сильный пароль.", level: "strong" };
  }

  function bindStrength(input) {
    if (!input) return;
    const fill = document.getElementById("passwordStrengthFill");
    const label = document.getElementById("passwordStrengthLabel");
    const hint = document.getElementById("passwordStrengthHint");
    const update = () => {
      const result = scorePassword(input.value);
      if (fill) {
        fill.style.width = `${result.percent}%`;
        fill.dataset.level = result.level;
      }
      if (label) label.textContent = result.label;
      if (hint) hint.textContent = result.hint;
    };
    input.addEventListener("input", update);
    update();
  }

  document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();

    const selector = btn.getAttribute("data-toggle-password");
    const input = selector ? document.querySelector(selector) : null;
    if (!input) return;

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";

    btn.classList.toggle("is-visible", isHidden);
    btn.setAttribute("aria-pressed", String(isHidden));
    btn.setAttribute("aria-label", isHidden ? "Скрыть пароль" : "Показать пароль");
  });
});

  bindStrength(document.getElementById("password") || document.getElementById("resetPassword"));

  document.querySelectorAll("[data-provider]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const provider = btn.getAttribute("data-provider");
      if (provider === "telegram") return;
      const msg = document.getElementById("loginMsg") || document.getElementById("registerMsg");
      const label = provider === "google" ? "Google" : provider;
      setText(msg, `Вход через ${label} подключим позже.`);
    });
  });

  const forgotSubmit = document.getElementById("forgotSubmit");
  forgotSubmit?.addEventListener("click", async () => {
    const email = String(document.getElementById("forgotEmail")?.value || "").trim().toLowerCase();
    const msg = document.getElementById("forgotMsg");
    if (!email.includes("@")) {
      setText(msg, "Введи корректный email.", true);
      return;
    }
    setText(msg, "Отправляем письмо...");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setText(msg, data.error === "bad_email" ? "Email некорректный." : "Не удалось отправить письмо.", true);
        return;
      }
      setText(msg, data.message || "Если аккаунт существует, письмо уже отправлено.");
    } catch {
      setText(msg, "Не удалось отправить письмо.", true);
    }
  });

  const resetSubmit = document.getElementById("resetSubmit");
  resetSubmit?.addEventListener("click", async () => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    const password = String(document.getElementById("resetPassword")?.value || "");
    const confirm = String(document.getElementById("resetPasswordConfirm")?.value || "");
    const msg = document.getElementById("resetMsg");

    if (!token) {
      setText(msg, "Ссылка для сброса неполная или устарела.", true);
      return;
    }
    if (password.length < 6) {
      setText(msg, "Пароль минимум 6 символов.", true);
      return;
    }
    if (password !== confirm) {
      setText(msg, "Пароли не совпадают.", true);
      return;
    }

    setText(msg, "Сохраняем новый пароль...");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setText(msg, data.error === "bad_or_expired_token" ? "Ссылка уже истекла или недействительна." : "Не удалось обновить пароль.", true);
        return;
      }
      setText(msg, data.message || "Пароль обновлён.");
      setTimeout(() => { window.location.href = "login.html"; }, 1200);
    } catch {
      setText(msg, "Не удалось обновить пароль.", true);
    }
  });
})();
