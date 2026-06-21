import { Platform } from 'react-native';

// Веб-фикс мобильной раскладки: на мобильных браузерах высота 100vh включает
// область за системными панелями, из-за чего нижнее меню «проваливается» и обрезается.
// Сбрасываем отступы body и задаём контейнеру динамическую высоту (100dvh).
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = [
    'html, body { height: 100%; margin: 0; padding: 0; }',
    '#root { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }',
  ].join('\n');
  document.head.appendChild(style);
}
