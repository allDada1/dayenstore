// js/features/product-reviews.js

(function () {
  function createProductReviewsFeature() {
    function escapeHtml(v) {
      if (window.MarketUtils?.escapeHtml) return window.MarketUtils.escapeHtml(v);
      return String(v ?? "");
    }

    function getApi() {
      try {
        if (typeof MarketAPI !== "undefined" && MarketAPI) return MarketAPI;
      } catch {}
      try {
        if (window.MarketAPI) return window.MarketAPI;
      } catch {}
      return null;
    }

    function getToken() {
      const api = getApi();
      try {
        if (api?.getToken) return api.getToken() || "";
      } catch {}
      return localStorage.getItem("market_token") || localStorage.getItem("token") || "";
    }

    function setFormState(info) {
      const formEl = document.getElementById("reviewForm");
      const noteEl = document.getElementById("reviewGateNote");
      const sendBtn = document.getElementById("sendReview");
      const ratingEl = document.getElementById("reviewRating");
      const commentEl = document.getElementById("reviewComment");
      if (!formEl || !noteEl || !sendBtn || !ratingEl || !commentEl) return;

      const isAuthed = !!getToken();
      let canReview = false;
      let message = "";

      if (!isAuthed) {
        message = "Войдите в аккаунт, чтобы оставить отзыв.";
      } else if (info?.can_review || info?.canReview) {
        canReview = true;
        message = "Вы можете оставить отзыв, потому что уже купили этот товар.";
      } else if ((info?.reason || info?.error) === "already_reviewed") {
        message = "Вы уже оставили отзыв на этот товар.";
      } else if ((info?.reason || info?.error) === "not_purchased") {
        message = "Отзывы доступны только после покупки и получения товара.";
      } else {
        message = "Оставить отзыв можно после покупки.";
      }

      noteEl.textContent = message;
      formEl.classList.toggle("is-disabled", !canReview);
      sendBtn.disabled = !canReview;
      ratingEl.disabled = !canReview;
      commentEl.disabled = !canReview;
    }

    async function load(productId) {
      const res = await fetch(`/api/reviews/${productId}`);
      if (!res.ok) return;

      const data = await res.json().catch(() => ({}));
      const rows = Array.isArray(data?.items) ? data.items : [];
      const reviewsEl = document.getElementById("reviewsList");
      if (!reviewsEl) return;

      reviewsEl.innerHTML = rows.length ? rows.map(r => `
        <div class="review">
          <div class="reviewRating">${"⭐".repeat(Number(r.rating || 0))}</div>
          <div class="reviewText">${escapeHtml(r.comment || "")}</div>
          <div class="reviewAuthor">— ${escapeHtml(r.name || "Пользователь")}</div>
        </div>
      `).join("") : `<div class="review review--empty">Пока нет отзывов. Будьте первым покупателем, кто оставит отзыв.</div>`;
    }

    async function loadPermission(productId) {
      try {
        const token = getToken();
        if (!token) {
          setFormState(null);
          return;
        }

        const api = getApi();
        const res = api?.apiFetch
          ? await api.apiFetch(`/api/reviews/${productId}/can-review`)
          : await fetch(`/api/reviews/${productId}/can-review`, {
              headers: { Authorization: `Bearer ${token}` }
            });

        const data = await res.json().catch(() => ({}));
        console.log("can-review response:", data);
        setFormState(data);
      } catch (err) {
        console.error("loadPermission error:", err);
        setFormState(null);
      }
    }

    function bind(getProductId) {
      document.getElementById("sendReview")?.addEventListener("click", async () => {
        const rating = Number(document.getElementById("reviewRating")?.value || 0);
        const comment = document.getElementById("reviewComment")?.value || "";
        const productId = Number(getProductId?.() || 0);
        const api = getApi();

        const res = api?.apiFetch
          ? await api.apiFetch("/api/reviews", {
              method: "POST",
              body: { product_id: productId, rating, comment }
            })
          : await fetch("/api/reviews", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(getToken() ? { Authorization: "Bearer " + getToken() } : {})
              },
              body: JSON.stringify({ product_id: productId, rating, comment })
            });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (data.error === "already_reviewed") {
            UI.toast("Вы уже оставляли отзыв", "error");
            await loadPermission(productId);
            return;
          }
          if (data.error === "not_purchased") {
            UI.toast("Оставить отзыв можно только после покупки", "error");
            await loadPermission(productId);
            return;
          }

          UI.toast("Ошибка отправки", "error");
          return;
        }

        const commentEl = document.getElementById("reviewComment");
        if (commentEl) commentEl.value = "";
        UI.toast("Отзыв добавлен", "success");
        await load(productId);
        await loadPermission(productId);
      });
    }

    return {
      load,
      bind,
      loadPermission
    };
  }

  window.ProductReviewsFeature = createProductReviewsFeature();
})();
