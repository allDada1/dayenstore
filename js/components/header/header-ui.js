// js/components/header-ui.js

(function(){

function createHeaderUI(){

let els = {};

function getEls(){

  return {
    cartBtn: document.getElementById("cartBtn"),
    cartBadge: document.getElementById("cartBadge"),
    profileBtn: document.getElementById("profileBtn"),
    goAdmin: document.getElementById("goAdmin"),
    goAdminCats: document.getElementById("goAdminCats"),
    goProfile: document.getElementById("goProfile"),
    goLogin: document.getElementById("goLogin"),
    goReg: document.getElementById("goReg")
  };

}

function updateUserUI(user){

  if(!els.profileBtn) return;

  const span = els.profileBtn.querySelector("span:last-child");

  if(span){
    span.textContent = user ? "Профиль" : "Войти";
  }

  if(els.goAdmin) els.goAdmin.style.display = (user && user.is_admin) ? "" : "none";
  if(els.goAdminCats) els.goAdminCats.style.display = (user && user.is_admin) ? "" : "none";
  if(els.goProfile) els.goProfile.style.display = user ? "" : "none";
  if(els.goLogin) els.goLogin.style.display = user ? "none" : "";
  if(els.goReg) els.goReg.style.display = user ? "none" : "";

}

function bind(){

  els.cartBtn?.addEventListener("click",()=>{
    location.href = HeaderAuth.isLogged() ? "cart.html" : "login.html";
  });

  els.profileBtn?.addEventListener("click",(e)=>{
    e.preventDefault();
    e.stopPropagation();

    const drop = document.getElementById("userDrop");
    if(!drop) return;

    drop.classList.toggle("is-open");
  });

  document.addEventListener("click",(e)=>{
    const drop = document.getElementById("userDrop");
    if(!drop) return;

    if(!drop.contains(e.target)){
      drop.classList.remove("is-open");
    }
  });

}

async function init(){

  els = getEls();

  bind();

  const user = await HeaderAuth.loadUser();
  updateUserUI(user);

}

return{
  init,
  updateUserUI
};

}

window.HeaderUI = createHeaderUI();

})();