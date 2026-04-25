(function () {
  const U = window.MarketUtils;
  const KEY = "market_support_chat";

  const box = document.getElementById("chatBox");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearChatBtn");
  const quickBtns = document.querySelectorAll("[data-chat-quick]");
  const heroCount = document.getElementById("chatCountHero");

  function load() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function escapeText(value) {
    return U ? U.escapeHtml(value) : String(value ?? "");
  }

  function ensureWelcome(list) {
    if (list.length) return list;
    return [{
      me: false,
      text: "Здравствуйте! Опишите проблему в одном сообщении или выберите одну из быстрых тем выше.",
      ts: Date.now(),
    }];
  }

  function render() {
    const list = ensureWelcome(load());
    save(list);
    if (heroCount) heroCount.textContent = String(list.length);
    if (!box) return;

    box.innerHTML = list.map((m) => `
      <div class="msg ${m.me ? "msg--me" : ""}">
        <div class="msg__meta">${m.me ? "Вы" : "Поддержка"} • ${fmtTime(m.ts)}</div>
        <div>${escapeText(m.text)}</div>
      </div>
    `).join("");

    box.scrollTop = box.scrollHeight;
  }

  function botReply(userText) {
    const lower = String(userText || "").toLowerCase();
    if (lower.includes("оплат")) {
      return "Понял. Проверьте страницу оплаты и напишите, на каком шаге возникла ошибка. Если есть скрин — лучше сразу приложить его в форме проблемы.";
    }
    if (lower.includes("аккаун") || lower.includes("войти") || lower.includes("логин")) {
      return "Понял. Для проблем со входом уточните: страница не открывается, пароль не подходит или после входа вас выбрасывает из аккаунта?";
    }
    if (lower.includes("товар") || lower.includes("карточк")) {
      return "Понял. Укажите ссылку на товар и коротко напишите, что именно отображается неправильно: цена, фото, описание, наличие или кнопки.";
    }
    if (lower.includes("корзин") || lower.includes("заказ")) {
      return "Понял. Проверьте, добавляется ли товар повторно после обновления страницы. Если проблема остаётся, можно сразу оформить обращение через форму.";
    }
    return "Принято ✅ Если нужно, укажите страницу, шаги воспроизведения и приложите скрин — так будет проще разобраться.";
  }

  function pushMessage(text) {
    const t = String(text || "").trim();
    if (!t) return;

    const list = ensureWelcome(load()).filter((m, idx) => !(idx === 0 && !m.me && m.text.includes("Здравствуйте!")));
    list.push({ me: true, text: t, ts: Date.now() });
    save(list);
    render();

    setTimeout(() => {
      const list2 = ensureWelcome(load()).filter((m, idx) => !(idx === 0 && !m.me && m.text.includes("Здравствуйте!")));
      list2.push({ me: false, text: botReply(t), ts: Date.now() });
      save(list2);
      render();
    }, 350);
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      pushMessage(input && input.value);
      if (input) {
        input.value = "";
        input.focus();
      }
    });
  }

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        pushMessage(input.value);
        input.value = "";
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem(KEY);
      render();
    });
  }

  quickBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.dataset.chatQuick || "";
      if (input) input.value = text;
      pushMessage(text);
      if (input) input.value = "";
    });
  });

  render();
})();
