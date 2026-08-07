const toggleState = document.getElementById('toggleState');
const autoPauseState = document.getElementById('autoPauseState');
const resetBtn = document.getElementById('resetBtn');
const skipCount = document.getElementById('skipCount');
const heroCard = document.getElementById('heroCard');
const heroStatusText = document.getElementById('heroStatusText');
const smartPauseCard = document.getElementById('smartPauseCard');
const smartPauseStatusText = document.getElementById('smartPauseStatusText');

function updateHeroVisual(isOn) {
  heroCard.classList.toggle('on', isOn);
  heroStatusText.textContent = isOn ? 'активен · идёт марафон' : 'выключен';
}

function updateSmartPauseVisual(isOn) {
  smartPauseCard.classList.toggle('on', isOn);
  smartPauseStatusText.textContent = isOn ? 'активна' : 'выключена';
}

function animateCount(newValue) {
  const current = parseInt(skipCount.textContent, 10) || 0;
  if (current === newValue) return;
  
  const start = current;
  const diff = newValue - start;
  const duration = 300;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    skipCount.textContent = Math.round(start + diff * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Загрузка сохранённых настроек
chrome.storage.local.get(['isEnabled', 'autoPause', 'skippedCount'], (res) => {
  const isOn = res.isEnabled === undefined ? true : res.isEnabled;
  toggleState.checked = isOn;
  updateHeroVisual(isOn);
  
  autoPauseState.checked = res.autoPause === true;
  updateSmartPauseVisual(autoPauseState.checked);
  
  skipCount.textContent = res.skippedCount || 0;

  // Снимаем блокировку анимаций
  heroCard.style.transition = '';
  heroCard.style.animation = '';
  document.body.classList.remove('no-transition');
});

// Сохранение «Режима марафона»
toggleState.addEventListener('change', () => {
  chrome.storage.local.set({ isEnabled: toggleState.checked });
  updateHeroVisual(toggleState.checked);
});

// Сохранение «Умной паузы» + обновление статуса
autoPauseState.addEventListener('change', () => {
  chrome.storage.local.set({ autoPause: autoPauseState.checked });
  updateSmartPauseVisual(autoPauseState.checked);
});

// Сброс счётчика
resetBtn.addEventListener('click', () => {
  chrome.storage.local.set({ skippedCount: 0 });
  animateCount(0);
});

// Синхронизация счётчика в реальном времени
chrome.storage.onChanged.addListener((changes) => {
  if (changes.skippedCount) {
    animateCount(changes.skippedCount.newValue || 0);
  }
});