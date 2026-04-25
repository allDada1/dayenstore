// js/ui/ui.js
(function () {

  function ensureContainer() {
    let c = document.getElementById("toastContainer");
    if (!c) {
      c = document.createElement("div");
      c.id = "toastContainer";
      c.style.position = "fixed";
      c.style.right = "20px";
      c.style.bottom = "20px";
      c.style.zIndex = "9999";
      c.style.display = "flex";
      c.style.flexDirection = "column";
      c.style.gap = "10px";
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(message, type = "info") {
    const container = ensureContainer();

    const t = document.createElement("div");
    t.textContent = message;

    t.style.padding = "10px 14px";
    t.style.borderRadius = "8px";
    t.style.fontSize = "14px";
    t.style.color = "#fff";
    t.style.minWidth = "180px";
    t.style.boxShadow = "0 4px 10px rgba(0,0,0,.2)";
    t.style.opacity = "0";
    t.style.transform = "translateY(10px)";
    t.style.transition = "all .2s";

    if (type === "success") t.style.background = "#2ecc71";
    else if (type === "error") t.style.background = "#e74c3c";
    else t.style.background = "#333";

    container.appendChild(t);

    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(10px)";
      setTimeout(() => t.remove(), 200);
    }, 3000);
  }

  function loading(show = true) {
    let l = document.getElementById("globalLoader");

    if (show) {
      if (!l) {
        l = document.createElement("div");
        l.id = "globalLoader";

        l.style.position = "fixed";
        l.style.inset = "0";
        l.style.background = "rgba(0,0,0,.4)";
        l.style.display = "flex";
        l.style.alignItems = "center";
        l.style.justifyContent = "center";
        l.style.zIndex = "9998";

        const spinner = document.createElement("div");
        spinner.style.width = "40px";
        spinner.style.height = "40px";
        spinner.style.border = "4px solid #ccc";
        spinner.style.borderTop = "4px solid #fff";
        spinner.style.borderRadius = "50%";
        spinner.style.animation = "spin 1s linear infinite";

        l.appendChild(spinner);
        document.body.appendChild(l);

        const style = document.createElement("style");
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
    } else {
      if (l) l.remove();
    }
  }

  window.UI = {
    toast,
    loading
  };

})();