(function(){
  const REGISTRY = new WeakMap();

  function esc(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function getLabel(select){
    const opt = select.options[select.selectedIndex];
    return opt ? opt.textContent : 'Выбрать';
  }

  function isDisabledOption(opt){
    return !!opt.disabled;
  }

  function closeAll(except){
    document.querySelectorAll('.ns.is-open').forEach(root => {
      if (root !== except) root.classList.remove('is-open');
    });
  }

  function syncFromSelect(select){
    const ui = REGISTRY.get(select);
    if (!ui) return;
    ui.value.textContent = getLabel(select);
    ui.root.classList.toggle('is-disabled', !!select.disabled);
    ui.list.querySelectorAll('.ns__option').forEach((node) => {
      const selected = node.dataset.value === String(select.value);
      node.classList.toggle('is-selected', selected);
      node.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  function renderOptions(select, list){
    const items = Array.from(select.options).map(opt => {
      const disabled = isDisabledOption(opt);
      return `<button class="ns__option${disabled ? ' is-disabled' : ''}" type="button" role="option" data-value="${esc(opt.value)}" aria-selected="false" ${disabled ? 'disabled' : ''}>${esc(opt.textContent)}</button>`;
    }).join('');
    list.innerHTML = items || '<div class="ns__empty">Нет вариантов</div>';
  }

  function open(root){
    if (root.classList.contains('is-disabled')) return;
    closeAll(root);
    root.classList.add('is-open');
    const selected = root.querySelector('.ns__option.is-selected');
    if (selected) selected.scrollIntoView({block:'nearest'});
  }

  function bind(select){
    if (REGISTRY.has(select)) return REGISTRY.get(select).root;

    select.classList.add('is-native-hidden');
    select.setAttribute('data-native-hidden', '1');

    const root = document.createElement('div');
    root.className = 'ns';
    root.setAttribute('data-enhanced-select', '1');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ns__trigger input';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const value = document.createElement('span');
    value.className = 'ns__value';
    const icon = document.createElement('span');
    icon.className = 'ns__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '▾';
    trigger.append(value, icon);

    const panel = document.createElement('div');
    panel.className = 'ns__panel';
    panel.setAttribute('role', 'listbox');

    const list = document.createElement('div');
    list.className = 'ns__list';
    panel.appendChild(list);

    select.insertAdjacentElement('afterend', root);
    root.append(trigger, panel);

    const ui = { root, trigger, value, panel, list };
    REGISTRY.set(select, ui);

    function rebuild(){
      renderOptions(select, list);
      syncFromSelect(select);
    }

    trigger.addEventListener('click', () => {
      if (root.classList.contains('is-open')) {
        root.classList.remove('is-open');
      } else {
        open(root);
      }
      trigger.setAttribute('aria-expanded', root.classList.contains('is-open') ? 'true' : 'false');
    });

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.ns__option');
      if (!btn || btn.disabled) return;
      const newValue = btn.dataset.value ?? '';
      if (select.value !== newValue) {
        select.value = newValue;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncFromSelect(select);
      root.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    });

    select.addEventListener('change', () => syncFromSelect(select));

    const obs = new MutationObserver(() => rebuild());
    obs.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'label', 'value', 'selected'] });

    rebuild();
    return root;
  }

  function initAll(scope){
    (scope || document).querySelectorAll('select[data-nice-select], select.js-nice-select').forEach(bind);
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ns')) closeAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  window.NiceSelect = {
    init: bind,
    initAll,
    refresh(select){
      if (!select) return;
      if (!REGISTRY.has(select)) bind(select);
      syncFromSelect(select);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll());
  } else {
    initAll();
  }
})();
