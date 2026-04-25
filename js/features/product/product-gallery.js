// js/features/product-gallery.js

(function () {
  function createProductGalleryFeature() {
    let deps = null;
    let images = [];
    let activeIndex = 0;
    let modalIndex = 0;

    function el() {
      return deps?.els || {};
    }

    function escapeHtml(v) {
      return deps?.escapeHtml ? deps.escapeHtml(v) : String(v ?? "");
    }

    function productTitle() {
      return deps?.getProduct?.()?.title || "Товар";
    }

    function renderHero() {
      const elements = el();
      const src = images[activeIndex] || "";

      if (!elements.heroBox) return;

      if (src) {
        elements.heroBox.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(productTitle())}" />`;
      } else {
        elements.heroBox.innerHTML = `<div class="ph">Нет изображения</div>`;
      }

      if (elements.galleryPrev) elements.galleryPrev.disabled = images.length <= 1;
      if (elements.galleryNext) elements.galleryNext.disabled = images.length <= 1;
    }

    function renderThumbs() {
      const elements = el();
      if (!elements.thumbs) return;

      if (!images.length) {
        elements.thumbs.innerHTML = `<div class="thumb is-active"><div class="ph">Нет фото</div></div>`;
        return;
      }

      elements.thumbs.innerHTML = images.map((src, i) => `
        <button class="thumb${i === activeIndex ? " is-active" : ""}" type="button" data-i="${i}" aria-label="Фото ${i + 1}">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(productTitle() + " " + (i + 1))}" />
        </button>
      `).join("");

      elements.thumbs.querySelectorAll(".thumb").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeIndex = Number(btn.dataset.i || 0);
          renderHero();
          renderThumbs();
        });
      });
    }

    function setImages(nextImages) {
      images = Array.isArray(nextImages) ? nextImages : [];
      activeIndex = 0;
      renderHero();
      renderThumbs();
    }

    function prev() {
      if (images.length <= 1) return;
      activeIndex = (activeIndex - 1 + images.length) % images.length;
      renderHero();
      renderThumbs();
    }

    function next() {
      if (images.length <= 1) return;
      activeIndex = (activeIndex + 1) % images.length;
      renderHero();
      renderThumbs();
    }

    function renderModal() {
      const modal = document.getElementById("galleryModal");
      const modalImg = document.getElementById("galleryImageModal");
      const modalThumbs = document.getElementById("galleryThumbsModal");
      if (!modal || !modalImg || !modalThumbs || !images.length) return;

      modalImg.src = images[modalIndex];
      modalImg.alt = `${productTitle()} ${modalIndex + 1}`;

      modalThumbs.innerHTML = images.map((src, i) => `
        <img src="${escapeHtml(src)}" alt="${escapeHtml(productTitle() + " " + (i + 1))}" class="${i === modalIndex ? "active" : ""}" data-i="${i}">
      `).join("");

      modalThumbs.querySelectorAll("img").forEach((img) => {
        img.onclick = () => {
          modalIndex = Number(img.dataset.i || 0);
          renderModal();
        };
      });
    }

    function open(index) {
      const modal = document.getElementById("galleryModal");
      if (!modal) return;
      modalIndex = Number(index || 0);
      modal.classList.remove("hidden");
      renderModal();
    }

    function close() {
      const modal = document.getElementById("galleryModal");
      if (modal) modal.classList.add("hidden");
    }

    function bind() {
      const elements = el();
      const closeBtn = document.getElementById("galleryClose");
      const prevBtn = document.getElementById("galleryPrevModal");
      const nextBtn = document.getElementById("galleryNextModal");
      const modal = document.getElementById("galleryModal");

      elements.galleryPrev?.addEventListener("click", prev);
      elements.galleryNext?.addEventListener("click", next);
      elements.heroBox?.addEventListener("click", () => open(activeIndex));

      closeBtn?.addEventListener("click", close);

      prevBtn && (prevBtn.onclick = () => {
        modalIndex = (modalIndex - 1 + images.length) % images.length;
        renderModal();
      });

      nextBtn && (nextBtn.onclick = () => {
        modalIndex = (modalIndex + 1) % images.length;
        renderModal();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" && (!modal || modal.classList.contains("hidden"))) prev();
        if (e.key === "ArrowRight" && (!modal || modal.classList.contains("hidden"))) next();

        if (!modal || modal.classList.contains("hidden")) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft" && prevBtn) prevBtn.onclick();
        if (e.key === "ArrowRight" && nextBtn) nextBtn.onclick();
      });
    }

    function init(options) {
      deps = options || {};
      bind();
    }

    return {
      init,
      setImages,
      renderHero,
      renderThumbs,
      open,
      close
    };
  }

  window.ProductGalleryFeature = createProductGalleryFeature();
})();