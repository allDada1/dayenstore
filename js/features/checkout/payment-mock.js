(function () {
  const sp = new URLSearchParams(location.search);
  const orderId = Number(sp.get("id") || 0);

  const info = document.getElementById("payOrderInfo");
  const payBtn = document.getElementById("payBtn");
  const msg = document.getElementById("payMsg");
  const statusBox = document.getElementById("payStatus");
  const statusText = document.getElementById("payStatusText");
  const summary = document.getElementById("paySummary");
  const totalEl = document.getElementById("payTotal");
  const delivEl = document.getElementById("payDelivery");
  const contEl = document.getElementById("payContacts");
  const badgeEl = document.getElementById("payStatusBadge");
  const goOrder = document.getElementById("payGoOrder");

  const fields = {
    cardNumber: document.getElementById("cardNumber"),
    cardName: document.getElementById("cardName"),
    cardExpiry: document.getElementById("cardExpiry"),
    cardCvv: document.getElementById("cardCvv"),
  };
  const preview = {
    number: document.getElementById("cardPreviewNumber"),
    name: document.getElementById("cardPreviewName"),
    expiry: document.getElementById("cardPreviewExpiry"),
    cvv: document.getElementById("cardPreviewCvv"),
    brand: document.getElementById("cardBrand"),
    card: document.getElementById("cardVisual"),
  };

  function money(n) { return Number(n || 0).toLocaleString("ru-RU") + " ₸"; }
  function setMsg(t) { if (msg) msg.textContent = t || ""; }
  function setBusy(b) {
    if (payBtn) payBtn.disabled = !!b;
    if (statusBox) statusBox.hidden = !b;
  }
  function getMethod() {
    const el = document.querySelector('input[name="pay"]:checked');
    return el ? String(el.value || "card") : "card";
  }
  function setMethodSelected() {
    document.querySelectorAll(".payMethod").forEach((lab) => lab.classList.remove("is-selected"));
    const checked = document.querySelector('input[name="pay"]:checked');
    checked?.closest(".payMethod")?.classList.add("is-selected");
    const method = getMethod();
    document.querySelectorAll(".payPane").forEach((pane) => pane.classList.toggle("is-active", pane.dataset.pane === method));
  }
  function setOrderLink() {
    if (goOrder) goOrder.href = orderId > 0 ? `orders.html#order-${orderId}` : "orders.html";
    const later = document.getElementById("payLaterBtn");
    if (later) later.href = orderId > 0 ? `orders.html#order-${orderId}` : "orders.html";
  }

  async function loadOrder() {
    if (!orderId) {
      setMsg("Некорректный id заказа.");
      if (info) info.textContent = "Заказ: —";
      return null;
    }

    const res = await MarketAPI.apiFetch(`/api/orders/${orderId}`);
    if (!res.ok) {
      setMsg(res.status === 401 ? "Нужно войти в аккаунт." : "Не удалось загрузить заказ.");
      return null;
    }

    const data = await res.json().catch(() => null);
    const order = data?.order || null;
    if (!order) {
      setMsg("Данные заказа не найдены.");
      return null;
    }

    if (info) info.textContent = `Заказ: #${order.id}`;
    if (summary) summary.hidden = false;
    if (totalEl) totalEl.textContent = money(order.total);
    if (delivEl) delivEl.textContent = money(order.delivery_price || 0);
    if (contEl) contEl.textContent = [order.delivery_city, order.delivery_address, order.phone].filter(Boolean).join(" • ") || "—";
    if (badgeEl) badgeEl.textContent = String(order.status || "created");

    if (String(order.status || "").toLowerCase() === "paid") {
      if (payBtn) payBtn.disabled = true;
      setMsg("Этот заказ уже оплачен. Можно открыть его в истории заказов.");
    }

    return order;
  }

  function digits(value) { return String(value || "").replace(/\D+/g, ""); }
  function formatCardNumber(value) {
    return digits(value).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }
  function formatExpiry(value) {
    const d = digits(value).slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  }
  function detectBrand(number) {
    const d = digits(number);
    if (/^4/.test(d)) return "VISA";
    if (/^5[1-5]/.test(d)) return "MC";
    if (/^220[0-4]/.test(d)) return "MIR";
    return "CARD";
  }
  function updatePreview() {
    const number = formatCardNumber(fields.cardNumber?.value || "");
    const name = String(fields.cardName?.value || "").trim().toUpperCase();
    const expiry = formatExpiry(fields.cardExpiry?.value || "");
    const cvv = digits(fields.cardCvv?.value || "").slice(0, 3);
    if (preview.number) preview.number.textContent = number || "•••• •••• •••• ••••";
    if (preview.name) preview.name.textContent = name || "YOUR NAME";
    if (preview.expiry) preview.expiry.textContent = expiry || "MM/YY";
    if (preview.cvv) preview.cvv.textContent = cvv || "•••";
    if (preview.brand) preview.brand.textContent = detectBrand(number);
  }
  function validateCard() {
    const number = digits(fields.cardNumber?.value || "");
    const name = String(fields.cardName?.value || "").trim();
    const expiry = formatExpiry(fields.cardExpiry?.value || "");
    const cvv = digits(fields.cardCvv?.value || "");
    if (number.length < 16) return "Проверь номер карты.";
    if (name.length < 3) return "Укажи имя держателя.";
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return "Проверь срок действия карты.";
    if (cvv.length !== 3) return "Проверь CVV.";
    return "";
  }

  document.querySelectorAll('input[name="pay"]').forEach((el) => {
    el.addEventListener("change", setMethodSelected);
  });
  fields.cardNumber?.addEventListener("input", () => {
    fields.cardNumber.value = formatCardNumber(fields.cardNumber.value);
    updatePreview();
  });
  fields.cardName?.addEventListener("input", updatePreview);
  fields.cardExpiry?.addEventListener("input", () => {
    fields.cardExpiry.value = formatExpiry(fields.cardExpiry.value);
    updatePreview();
  });
  fields.cardCvv?.addEventListener("input", () => {
    fields.cardCvv.value = digits(fields.cardCvv.value).slice(0, 3);
    updatePreview();
  });
  fields.cardCvv?.addEventListener("focus", () => preview.card?.classList.add("is-flipped"));
  fields.cardCvv?.addEventListener("blur", () => preview.card?.classList.remove("is-flipped"));

  payBtn?.addEventListener("click", async () => {
    setMsg("");
    const method = getMethod();

    if (!MarketAPI.getToken()) {
      location.href = "login.html";
      return;
    }
    if (!orderId) {
      setMsg("Некорректный id заказа.");
      return;
    }
    if (method === "card") {
      const err = validateCard();
      if (err) {
        setMsg(err);
        return;
      }
    }

    setBusy(true);
    if (statusText) statusText.textContent = "Пожалуйста, не закрывайте страницу";

    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const res = await MarketAPI.apiFetch(`/api/orders/${orderId}/pay`, {
        method: "POST",
        body: JSON.stringify({ method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        setMsg("Ошибка оплаты: " + (data?.error || res.status));
        return;
      }

      if (badgeEl) badgeEl.textContent = "paid";
      window.UI?.toast?.("Оплата принята", "success");
      location.href = `order-success.html?id=${orderId}`;
    } catch (err) {
      setBusy(false);
      setMsg(String(err?.message || err || "Ошибка оплаты"));
    }
  });

  setOrderLink();
  setMethodSelected();
  updatePreview();
  loadOrder();
})();
