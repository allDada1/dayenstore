(function(){
  if (!window.gsap) return;
  const card = document.querySelector('[data-auth-panel="card"]');
  const reveals = document.querySelectorAll('[data-auth-reveal]');
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  if (card) tl.from(card, { y: 26, opacity: 0, duration: .52 });
  if (reveals.length) tl.from(reveals, { y: 18, opacity: 0, duration: .38, stagger: .05 }, '-=.3');
})();
