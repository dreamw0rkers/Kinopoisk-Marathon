const toggleState = document.getElementById('toggleState');
const autoPauseState = document.getElementById('autoPauseState');
const resetBtn = document.getElementById('resetBtn');
const skipCount = document.getElementById('skipCount');

// Загрузка сохранённых настроек
chrome.storage.local.get(['isEnabled', 'autoPause', 'skippedCount'], (res) => {
  toggleState.checked = res.isEnabled !== false;
  autoPauseState.checked = res.autoPause === true;
  skipCount.textContent = res.skippedCount || 0;
});

// Сохранение «Режима марафона»
toggleState.addEventListener('change', () => {
  chrome.storage.local.set({ isEnabled: toggleState.checked });
});

// Сохранение «Паузы при уходе с вкладки»
autoPauseState.addEventListener('change', () => {
  chrome.storage.local.set({ autoPause: autoPauseState.checked });
});

// Сброс счётчика
resetBtn.addEventListener('click', () => {
  chrome.storage.local.set({ skippedCount: 0 });
  skipCount.textContent = 0;
});

// Синхронизация счётчика в реальном времени
chrome.storage.onChanged.addListener((changes) => {
  if (changes.skippedCount) {
    skipCount.textContent = changes.skippedCount.newValue;
  }
});