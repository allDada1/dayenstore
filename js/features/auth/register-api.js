const nameEl  = document.getElementById("name");
const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const confirmEl = document.getElementById("passwordConfirm");
const btn     = document.getElementById("registerSubmit");
const msg     = document.getElementById("registerMsg");

function setMsg(text, type = "") {
  if (!msg) return;
  msg.textContent = text || "";
  msg.classList.remove("is-error", "is-success");
  if (type) msg.classList.add(type);
}

btn?.addEventListener("click", async (e) => {
  e.preventDefault();
  setMsg("");

  const name = String(nameEl?.value || "").trim();
  const email = String(emailEl?.value || "").trim().toLowerCase();
  const password = String(passEl?.value || "");
  const confirm = String(confirmEl?.value || "");

  if (name.length < 2) {
    setMsg("Имя слишком короткое.", "is-error");
    return;
  }

  if (!email.includes("@")) {
    setMsg("Email некорректный.", "is-error");
    return;
  }

  if (password.length < 6) {
    setMsg("Пароль минимум 6 символов.", "is-error");
    return;
  }

  if (password !== confirm) {
    setMsg("Пароли не совпадают.", "is-error");
    return;
  }

  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const text =
      data.error === "email_taken"
        ? "Аккаунт с таким email уже зарегистрирован."
        : data.error === "bad_name"
        ? "Имя слишком короткое."
        : data.error === "bad_email"
        ? "Email некорректный."
        : data.error === "bad_password"
        ? "Пароль минимум 6 символов."
        : "Не удалось зарегистрироваться. Попробуй ещё раз.";

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