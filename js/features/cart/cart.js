// js/features/cart.js

(function(){

function createCartFeature(){

let deps = null;

const Utils = window.MarketUtils || {};
const Cart = window.MarketStorage;

function getEls(){
  return deps?.els || {};
}

function updateBadge(){

  const els = getEls();
  const badge = els.cartBadge;

  if(!badge) return;

  if(Utils.updateCartBadge){
    Utils.updateCartBadge(badge,{hideWhenZero:true});
    return;
  }

  const count = Cart?.getCartCount?.() || 0;

  badge.hidden = count<=0;
  badge.textContent = String(count);

}

function bumpBadge(){

  const badge = getEls().cartBadge;
  if(!badge) return;

  badge.classList.remove("is-bump");
  void badge.offsetWidth;

  badge.classList.add("is-bump");

  setTimeout(()=>{
    badge.classList.remove("is-bump");
  },560);

}

function animateToCart(fromEl){

  const els = getEls();
  const badge = els.cartBtn || els.cartBadge;

  if(!fromEl || !badge){
    bumpBadge();
    return;
  }

  const from = fromEl.getBoundingClientRect();
  const to = badge.getBoundingClientRect();

  const dot = document.createElement("div");
  dot.className = "flyCartDot";

  dot.style.left = `${from.left + from.width/2}px`;
  dot.style.top = `${from.top + from.height/2}px`;

  document.body.appendChild(dot);

  dot.animate([
    {transform:"translate(-50%,-50%) scale(1)",opacity:1},
    {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(.35)`,opacity:.25}
  ],{
    duration:560,
    easing:"cubic-bezier(.2,.8,.2,1)"
  }).finished.finally(()=>{
    dot.remove();
    bumpBadge();
  });

}

function add(productId){

  const els = getEls();

  if(Utils.addToCart){
    Utils.addToCart(productId,1,els.cartBadge,{hideWhenZero:true});
  }
  else if(Cart?.addToCart){
    Cart.addToCart(productId,1);
    updateBadge();
  }

  if(window.UI){
    UI.toast("Товар добавлен в корзину","success");
  }

}

function init(options){

  deps = options || {};

  updateBadge();

  window.addEventListener("market:cart-changed", updateBadge);
window.addEventListener("market:auth-changed", updateBadge);

window.addEventListener("storage", (e) => {
  const key = String(e.key || "");
  const baseKey = Cart?.CART_KEY || "market_cart";
  if (key === baseKey || key.startsWith(baseKey + "__")) {
    updateBadge();
  }
});

}

return{
  init,
  add,
  updateBadge,
  animateToCart
};

}

window.HomeCart = createCartFeature();

})();