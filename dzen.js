(async () => {
  const CONFIG = {
    DRY_RUN: false,            // Для теста ставим "true", боевой режим "false" (For testing, set to "true"; for production mode, "false")
    MAX_DELETE: 500,
    OPEN_MENU_DELAY: 800,
    OPEN_DIALOG_DELAY: 900,
    AFTER_DELETE_DELAY: 2200,
    BETWEEN_ROWS_DELAY: 900,
    SCROLL_STEP: 1200,
    SCROLL_DELAY: 1500,
    MAX_IDLE: 8
  };

  const state = window.__dzenDelete = {
    stop: false,
    deleted: 0,
    processed: new Set(),
    idle: 0
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = (...args) => console.log('[DZEN-DELETE]', ...args);

  function visible(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }

  function click(el) {
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    el.click();
    return true;
  }

  function getRows() {
    return [...document.querySelectorAll('tr[aria-label="Публикация"]')].filter(visible);
  }

  function getRowId(row) {
    const editLink = row.querySelector('a[href*="/edit"]');
    if (editLink) {
      const href = editLink.getAttribute('href') || '';
      const m = href.match(/\/([a-f0-9]{12,})\/edit/i);
      if (m) return m[1];
      return href;
    }

    const statLink = row.querySelector('a[href*="publicationId="]');
    if (statLink) {
      const href = statLink.getAttribute('href') || '';
      const m = href.match(/publicationId=([a-f0-9]+)/i);
      if (m) return m[1];
      return href;
    }

    const pubLink = row.querySelector('a[href^="/a/"]');
    if (pubLink) return pubLink.getAttribute('href');

    return row.innerText.trim().slice(0, 120);
  }

  function getTitle(row) {
    return row.querySelector('h2')?.innerText?.trim() || '(без заголовка)';
  }

  function getMenuButton(row) {
    return row.querySelector('button[aria-label="Меню публикации"]');
  }

  function getOpenDropdown() {
    return [...document.querySelectorAll('div.editor--base-dropdown-v2__rootElement-18')]
      .find(visible) || null;
  }

  function getDeleteButtonFromOpenMenu() {
    const menu = getOpenDropdown();
    if (!menu) return null;
    return [...menu.querySelectorAll('button[aria-label="Удалить"]')].find(visible) || null;
  }

  function getDeleteDialog() {
    return [...document.querySelectorAll('div.editor--dialog__root-12')]
      .find(visible) || null;
  }

  function getConfirmDeleteButton() {
    const dialog = getDeleteDialog();
    if (!dialog) return null;
    return [...dialog.querySelectorAll('button')]
      .find(btn => visible(btn) && btn.innerText.trim() === 'Удалить') || null;
  }

  function getCancelDialogButton() {
    const dialog = getDeleteDialog();
    if (!dialog) return null;
    return [...dialog.querySelectorAll('button')]
      .find(btn => visible(btn) && btn.innerText.trim() === 'Отмена') || null;
  }

  async function closeStuff() {
    const cancel = getCancelDialogButton();
    if (cancel) {
      click(cancel);
      await sleep(300);
      return;
    }

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true
    }));

    await sleep(300);
  }

  async function processRow(row) {
    const id = getRowId(row);
    const title = getTitle(row);

    if (state.processed.has(id)) return false;
    state.processed.add(id);

    const menuBtn = getMenuButton(row);
    if (!menuBtn) {
      log('Нет кнопки меню:', id, title);
      return false;
    }

    log('Публикация:', id, '|', title);

    click(menuBtn);
    await sleep(CONFIG.OPEN_MENU_DELAY);

    const deleteBtn = getDeleteButtonFromOpenMenu();
    if (!deleteBtn) {
      log('Не найден пункт "Удалить":', id);
      await closeStuff();
      return false;
    }

    log('Нашел "Удалить":', id);

    if (CONFIG.DRY_RUN) {
      log('DRY RUN, не удаляю:', id);
      await closeStuff();
      return true;
    }

    click(deleteBtn);
    await sleep(CONFIG.OPEN_DIALOG_DELAY);

    const confirmBtn = getConfirmDeleteButton();
    if (!confirmBtn) {
      log('Не найдена кнопка подтверждения:', id);
      await closeStuff();
      return false;
    }

    click(confirmBtn);
    state.deleted += 1;
    log('Удалено:', state.deleted, '|', id, '|', title);

    await sleep(CONFIG.AFTER_DELETE_DELAY);
    return true;
  }

  async function scrollMore() {
    const beforeY = window.scrollY;
    const beforeH = document.documentElement.scrollHeight;

    window.scrollBy({ top: CONFIG.SCROLL_STEP, behavior: 'instant' });
    await sleep(CONFIG.SCROLL_DELAY);

    return window.scrollY !== beforeY || document.documentElement.scrollHeight !== beforeH;
  }

  log('Старт. Остановка: window.__dzenDelete.stop = true');
  log('DRY_RUN =', CONFIG.DRY_RUN);

  while (!state.stop && state.deleted < CONFIG.MAX_DELETE) {
    const rows = getRows();
    let acted = false;

    for (const row of rows) {
      if (state.stop || state.deleted >= CONFIG.MAX_DELETE) break;

      try {
        const ok = await processRow(row);
        if (ok) acted = true;
      } catch (e) {
        console.error('[DZEN-DELETE] Ошибка на строке:', e);
        await closeStuff();
      }

      await sleep(CONFIG.BETWEEN_ROWS_DELAY);
    }

    if (state.stop || state.deleted >= CONFIG.MAX_DELETE) break;

    if (!acted) {
      const moved = await scrollMore();
      if (!moved) state.idle++;
      else state.idle = 0;

      if (state.idle >= CONFIG.MAX_IDLE) {
        log('Похоже, новых строк больше нет. Стоп.');
        break;
      }
    } else {
      state.idle = 0;
    }
  }

  log('Готово. Удалено:', state.deleted);
})();
