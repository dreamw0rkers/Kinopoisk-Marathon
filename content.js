let isProcessing = false;
let isSkipping = false;
let pausedByTabSwitch = false; // Флаг: ставило ли именно расширение паузу

// 1. Оранжевые Toast-уведомления (работают везде, включая Fullscreen)
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
    transform: translateY(10px);
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
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

// 2. Умная авто-пауза при смене вкладки
document.addEventListener('visibilitychange', () => {
  if (!chrome.runtime || !chrome.runtime.id) return;

  chrome.storage.local.get(['autoPause'], (res) => {
    if (!res.autoPause) return;

    const video = document.querySelector('video');
    if (!video) return;

    if (document.hidden) {
      // Пользователь ушёл с вкладки
      if (!video.paused) {
        video.pause();
        pausedByTabSwitch = true;
      }
    } else {
      // Пользователь вернулся на вкладку
      if (pausedByTabSwitch) {
        video.play().catch(() => {});
        pausedByTabSwitch = false;
        showToast('Продолжаем просмотр');
      }
    }
  });
});

// 3. Основная логика пропуска
function skipEverything() {
  if (isSkipping || !chrome.runtime || !chrome.runtime.id) return;

  chrome.storage.local.get(['isEnabled'], (res) => {
    if (chrome.runtime.lastError || res.isEnabled === false) return;

    const selectors = [
      'button.styles_button__rKMKL',
      'button.styles_orange__wqBiD',
      'button.styles_gray__bkeMR',
      'button[class*="styles_button"]',
      'button[data-tid="component"]',
      '[data-test-id="skip-button"]',
      '[data-test-id="next-episode-button"]'
    ];

    selectors.forEach((selector) => {
      const buttons = document.querySelectorAll(selector);

      buttons.forEach((btn) => {
        if (isSkipping) return;

        const btnText = btn.textContent ? btn.textContent.toLowerCase() : '';
        const isSkipOrNext = btnText.includes('пропустить') || btnText.includes('следующая серия');
        const isVisible = btn.offsetParent !== null;

        if (isVisible && isSkipOrNext) {
          isSkipping = true;

          const actionName = btnText.includes('следующая серия') ? 'Следующая серия' : 'Пропущена заставка';

          btn.click();
          console.log('[Кинопоиск Марафон] Автоклик:', btnText.trim());

          showToast(actionName);

          chrome.storage.local.get(['skippedCount'], (result) => {
            if (chrome.runtime.lastError) return;
            const currentCount = result.skippedCount || 0;
            chrome.storage.local.set({ skippedCount: currentCount + 1 });
          });

          setTimeout(() => {
            isSkipping = false;
          }, 2500);
        }
      });
    });
  });
}

// 4. MutationObserver
const observer = new MutationObserver(() => {
  if (!isProcessing) {
    isProcessing = true;
    requestAnimationFrame(() => {
      skipEverything();
      isProcessing = false;
    });
  }
});

observer.observe(document.body, { childList: true, subtree: true });
skipEverything();