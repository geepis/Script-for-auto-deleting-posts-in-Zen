(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function visible(el) {
    return !!el && el.offsetParent !== null;
  }

  function fire(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      el.dispatchEvent(new MouseEvent(type, opts));
    });
    return true;
  }

  function findMenuButton() {
    const buttons = [...document.querySelectorAll('button')].filter(visible);

    const exact = buttons.find(b =>
      /действ|ещ[её]|more|меню/i.test(
        (b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')
      )
    );
    if (exact) return exact;

    const byClass = buttons.find(b =>
      /dropdown|action|menu|more/i.test(b.className || '')
    );
    if (byClass) return byClass;

    const iconOnly = buttons.find(b => {
      const txt = (b.textContent || '').trim();
      const aria = (b.getAttribute('aria-label') || '').trim();
      const hasSvg = !!b.querySelector('svg,use');
      return hasSvg && !txt && !/Удалить|Отмена/.test(txt + ' ' + aria);
    });
    if (iconOnly) return iconOnly;

    return null;
  }

  function findDeleteItem() {
    return [...document.querySelectorAll('li.Menu-Item, [role="menuitem"], button, span, div')]
      .find(el => visible(el) && el.textContent.trim() === 'Удалить');
  }

  function findConfirmBtn() {
    return document.querySelector('button.editor--dialog__confirmButton-3I') ||
      [...document.querySelectorAll('button')]
        .find(b => visible(b) && b.textContent.trim() === 'Удалить' && b.closest('[role="dialog"], .Modal-Content'));
  }

  let count = 0;
  const limit = 200;

  while (count < limit) {
    const menuBtn = findMenuButton();
    console.log('menuBtn =', menuBtn);

    if (!menuBtn) {
      console.log('Стоп: кнопка меню поста не найдена');
      break;
    }

    menuBtn.scrollIntoView({ block: 'center' });
    await wait(500);
    fire(menuBtn);
    await wait(800);

    const del = findDeleteItem();
    console.log('deleteItem =', del);

    if (!del) {
      console.log('Стоп: пункт "Удалить" не найден');
      break;
    }

    fire(del);
    await wait(900);

    const confirmBtn = findConfirmBtn();
    console.log('confirmBtn =', confirmBtn);

    if (!confirmBtn) {
      console.log('Стоп: подтверждение не найдено');
      break;
    }

    fire(confirmBtn);
    count++;
    console.log('Удалён пост №' + count);

    await wait(2500);
  }

  console.log('Готово. Всего удалено:', count);
})();
