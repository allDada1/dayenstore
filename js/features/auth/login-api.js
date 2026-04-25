const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const btn     = document.getElementById("loginSubmit");
const msg     = document.getElementById("loginMsg");

function setMsg(text, type = "") {
  if (!msg) return;
  msg.textContent = text || "";
  msg.classList.remove("is-error", "is-success");
  if (type) msg.classList.add(type);
}

btn?.addEventListener("click", async (e) => {
  e.preventDefault();
  setMsg("");

  const email = String(emailEl?.value || "").trim().toLowerCase();
  const password = String(passEl?.value || "");

  if (!email || !password) {
    setMsg("Заполни email и пароль.", "is-error");
    return;
  }

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const text =
      data.error === "bad_credentials"
        ? "Неверный email или пароль."
        : data.error === "bad_email"
        ? "Проверь email."
        : data.error === "bad_password"
        ? "Введи пароль."
        : "Не удалось войти. Попробуй ещё раз.";

    setMsg(text, "is-error");
    return;
  }

  if (window.Auth) {
    Auth.setToken(data.token || "");
    Auth.setSession(data.user || null);
  } else {
    MarketAPI.setToken(data.token || "");
    localStorage.setItem("market_session", JSON.stringify(data.user || {}));
  }

  location.href = "profile.html";
});