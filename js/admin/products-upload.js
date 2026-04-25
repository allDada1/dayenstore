(function initAdminProductsUpload() {
  const shared = window.AdminProductsShared;
  const { ui, state, setNote, esc, token } = shared;

  async function uploadImage(file) {
    const t = token() || localStorage.getItem("market_token") || localStorage.getItem("token") || "";
    if (!t) throw new Error("no_token");
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/uploads/image?token=" + encodeURIComponent(t), {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "X-Market-Token": t },
      body: fd
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "unknown");
    return data.url;
  }

  function setProductImages(images) {
    state.currentProductImages = Array.from(new Set((images || []).map(v => String(v || "").trim()).filter(Boolean)));
    if (!ui.imageGrid || !ui.imageUrlText) return;
    if (!state.currentProductImages.length) {
      ui.imageGrid.innerHTML = "";
      ui.imageUrlText.textContent = "Фото не выбраны";
      return;
    }
    ui.imageUrlText.textContent = `Загружено фото: ${state.currentProductImages.length}`;
    ui.imageGrid.innerHTML = state.currentProductImages.map((url, idx) => `
      <div class="imageChip ${idx === 0 ? 'is-cover' : ''}" data-idx="${idx}">
        <img src="${esc(url)}" alt="" />
        <div class="imageChip__actions">
          <button class="smallBtn" type="button" data-image-act="cover">Обложка</button>
          <button class="smallBtn" type="button" data-image-act="left">←</button>
          <button class="smallBtn" type="button" data-image-act="right">→</button>
          <button class="smallBtn" type="button" data-image-act="del">Удалить</button>
        </div>
      </div>`).join("");
  }

  function getProductImagesFromRow(p) {
    const imgs = Array.isArray(p?.images) ? p.images.filter(Boolean) : [];
    return imgs.length ? imgs : (p?.image_url ? [p.image_url] : []);
  }

  async function addProductFiles(files) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    for (const file of list) {
      setNote(ui.prodNote, "Загрузка фото…");
      const url = await uploadImage(file);
      state.currentProductImages.push(url);
      setProductImages(state.currentProductImages);
    }
    setNote(ui.prodNote, "Фото загружены ✅");
  }

  function bindProductUpload() {
    ui.pickFilesBtn?.addEventListener("click", () => ui.fileInput?.click());
    ui.clearImagesBtn?.addEventListener("click", () => setProductImages([]));

    ui.fileInput?.addEventListener("change", async () => {
      const files = ui.fileInput.files;
      if (!files?.length) return;
      try {
        await addProductFiles(files);
      } catch (e) {
        console.error(e);
        setNote(ui.prodNote, "Ошибка загрузки фото");
      } finally {
        ui.fileInput.value = "";
      }
    });

    ui.uploadBox?.addEventListener("dragover", (e) => {
      e.preventDefault();
      ui.uploadBox.classList.add("drag");
    });
    ui.uploadBox?.addEventListener("dragleave", () => ui.uploadBox.classList.remove("drag"));
    ui.uploadBox?.addEventListener("drop", async (e) => {
      e.preventDefault();
      ui.uploadBox.classList.remove("drag");
      const files = e.dataTransfer.files;
      if (!files?.length) return;
      try {
        await addProductFiles(files);
      } catch (err) {
        console.error(err);
        setNote(ui.prodNote, "Ошибка загрузки фото");
      }
    });

    document.addEventListener("click", (e) => {
      const act = e.target?.dataset?.imageAct;
      if (!act) return;
      const chip = e.target.closest('.imageChip');
      const idx = Number(chip?.dataset?.idx);
      if (!Number.isFinite(idx)) return;
      if (act === 'del') state.currentProductImages.splice(idx, 1);
      if (act === 'cover' && idx > 0) {
        const [item] = state.currentProductImages.splice(idx, 1);
        state.currentProductImages.unshift(item);
      }
      if (act === 'left' && idx > 0) {
        [state.currentProductImages[idx - 1], state.currentProductImages[idx]] = [state.currentProductImages[idx], state.currentProductImages[idx - 1]];
      }
      if (act === 'right' && idx < state.currentProductImages.length - 1) {
        [state.currentProductImages[idx + 1], state.currentProductImages[idx]] = [state.currentProductImages[idx], state.currentProductImages[idx + 1]];
      }
      setProductImages(state.currentProductImages);
    });
  }

  window.AdminProductsUpload = {
    uploadImage,
    setProductImages,
    getProductImagesFromRow,
    addProductFiles,
    bindProductUpload,
  };
})();
