// js/features/favorites.js

(function () {
  function createFavoritesFeature() {
    let likedIds = new Set();

    function getToken() {
      if (window.MarketUtils?.getToken) {
        return window.MarketUtils.getToken();
      }
      return window.MarketAPI?.getToken?.() || "";
    }

    async function load() {
      likedIds = new Set();

      if (!getToken()) return likedIds;

      try {
        const res = await MarketAPI.apiFetch("/api/favorites");
        if (!res.ok) return likedIds;

        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data?.items) ? data.items : [];
        likedIds = new Set(
          list
            .map(p => Number(p.id))
            .filter(n => Number.isFinite(n))
        );
      } catch {}

      return likedIds;
    }

    async function toggle(productId, btn) {
      if (!getToken()) {
        location.href = "login.html";
        return;
      }

      const id = Number(productId);
      if (!Number.isFinite(id)) return;

      try {
        const res = await MarketAPI.apiFetch(`/api/products/${id}/like`, {
          method: "POST"
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;

        const liked = !!data.liked;

        if (liked) likedIds.add(id);
        else likedIds.delete(id);

        if (btn) {
          btn.classList.toggle("is-active", liked);

          btn.classList.remove("is-bump");
          void btn.offsetWidth;
          btn.classList.add("is-bump");

          setTimeout(() => {
            btn.classList.remove("is-bump");
          }, 600);
        }

        const card = btn?.closest?.(".card");
        const pill = card?.querySelector?.(".card__stat .pillStat");
        if (pill && typeof data.likes !== "undefined") {
          pill.textContent = `♥ ${Number(data.likes) || 0}`;
        }
      } catch (err) {
        console.error(err);
      }
    }

    function getLikedIds() {
      return likedIds;
    }

    function init() {}

    return {
      init,
      load,
      toggle,
      getLikedIds
    };
  }

  window.HomeFavorites = createFavoritesFeature();
})();