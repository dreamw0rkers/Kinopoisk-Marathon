// Флаги состояния
let isProcessing = false;
let isSkipping = false;
let pausedByTabSwitch = false;
let pausedByUser = false;
let lastScanTime = 0;

// 1. Оранжевые Toast-уведомления с защитой от переполнения DOM
function showToast(message) {
  const targetParent = document.fullscreenElement 
                    || document.querySelector('[class*="PlayerContainer"]') 
                    || document.querySelector('[class*="styles_player"]')
                    || document.body;

  let toastContainer = document.getElementById('kp-marathon-toast-container');
  
  if (!toastContainer || !targetParent.contains(toastContainer)) {
    if (toastContainer) toastContainer.remove();

    toastContainer = document.createElement('div');
    toastContainer.id = 'kp-marathon-toast-container';
    toastContainer.style.cssText = `
      position: absolute;
      top: 20px;
      right: 30px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    targetParent.appendChild(toastContainer);
  }

  while (toastContainer.children.length >= 3) {
    toastContainer.firstElementChild.remove();
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: #ff7b00;
    color: #000000;
    border: 1px solid #ff7b00;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
  `;
  toast.textContent = `🍿 ${message}`;

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

// 2. Отслеживание ручной паузы пользователя
function attachVideoListeners(video) {
  if (video.dataset.kpListenersAttached) return;
  video.dataset.kpListenersAttached = 'true';

  video.addEventListener('pause', () => {
    if (!document.hidden && !pausedByTabSwitch) {
      pausedByUser = true;
    }
  });

  video.addEventListener('play', () => {
    if (!document.hidden) {
      pausedByUser = false;
      pausedByTabSwitch = false;
    }
  });
}

// 3. Умная авто-пауза при смене вкладки
document.addEventListener('visibilitychange', () => {
  if (!chrome.runtime?.id) return;

  chrome.storage.local.get(['autoPause'], (res) => {
    if (chrome.runtime.lastError || !res || !res.autoPause) return;

    const video = document.querySelector('video');
    if (!video) return;

    attachVideoListeners(video);

    if (document.hidden) {
      if (!video.paused) {
        video.pause();
        pausedByTabSwitch = true;
      }
    } else {
      if (pausedByTabSwitch && !pausedByUser) {
        video.play().catch(() => {});
        pausedByTabSwitch = false;
        showToast('Продолжаем просмотр');
      } else {
        pausedByTabSwitch = false;
      }
    }
  });
});

// 4. Безопасное обновление счётчика (атомарная операция)
function incrementSkippedCount() {
  chrome.storage.local.get(['skippedCount'], (result) => {
    if (chrome.runtime.lastError) return;
    const current = (result && result.skippedCount) || 0;
    chrome.storage.local.set({ skippedCount: current + 1 });
  });
}

// 5. Основная логика авто-пропуска
function skipEverything() {
  if (isSkipping || !chrome.runtime?.id) return;

  chrome.storage.local.get(['isEnabled'], (res) => {
    if (chrome.runtime.lastError || !res || res.isEnabled === false) return;

    const selectors = [
      'button.styles_button__rKMKL',
      'button.styles_orange__wqBiD',
      'button.styles_gray__bkeMR',
      'button[class*="styles_button"]',
      'button[data-tid="component"]',
      '[data-test-id="skip-button"]',
      '[data-test-id="next-episode-button"]',
      'button[aria-label*="Пропустить"]',
      'button[aria-label*="Следующая"]'
    ];

    const processedButtons = new Set();

    for (const selector of selectors) {
      if (isSkipping) break;

      const buttons = document.querySelectorAll(selector);

      for (const btn of buttons) {
        if (isSkipping || processedButtons.has(btn)) continue;
        processedButtons.add(btn);

        const btnText = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
        const isSkipOrNext = btnText.includes('пропустить') || btnText.includes('следующая серия');
        
        // ИСПРАВЛЕНИЕ: Полная и точная проверка видимости
        const style = window.getComputedStyle(btn);
        const isVisible = (btn.offsetWidth > 0 || btn.offsetHeight > 0 || btn.getClientRects().length > 0) &&
                          style.display !== 'none' && style.visibility !== 'hidden';

        if (isVisible && isSkipOrNext) {
          isSkipping = true;

          const actionName = btnText.includes('следующая серия') ? 'Следующая серия' : 'Пропущена заставка';

          btn.click();
          console.log('[Кинопоиск Марафон] Автоклик:', btnText.trim());

          showToast(actionName);
          
          // Обновляем счётчик без потери данных
          incrementSkippedCount();

          // ИСПРАВЛЕНИЕ: Таймер сокращён до 500 мс для мгновенной реакции на новые кнопки
          setTimeout(() => {
            isSkipping = false;
          }, 500);

          break;
        }
      }
    }
  });
}

// 6. Оптимизированный MutationObserver (Троттлинг 300 мс)
const observer = new MutationObserver((mutations) => {
  const isToastMutation = mutations.every((m) => {
    return m.target && (
      m.target.id === 'kp-marathon-toast-container' ||
      (m.target.parentElement && m.target.parentElement.id === 'kp-marathon-toast-container')
    );
  });

  if (isToastMutation) return;

  const now = Date.now();
  if (now - lastScanTime < 300) return;

  if (!isProcessing) {
    isProcessing = true;
    lastScanTime = now;
    requestAnimationFrame(() => {
      skipEverything();
      isProcessing = false;
    });
  }
});

// Инициализация наблюдения
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}