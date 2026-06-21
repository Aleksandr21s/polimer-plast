import { Platform } from 'react-native';

// Веб-фикс мобильной раскладки: на мобильных браузерах высота 100vh включает
// область за системными панелями, из-за чего нижнее меню «проваливается» и обрезается.
// Сбрасываем отступы body и задаём контейнеру динамическую высоту (100dvh).
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = [
    'html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }',
    // Фиксированная (не min-) высота: корень ровно по экрану, не «вырастает» вниз
    // за край. Внутренний скролл (каталог и т.п.) остаётся у списков.
    '#root { display: flex; flex-direction: column; height: 100vh; height: 100dvh; overflow: hidden; }',
  ].join('\n');
  document.head.appendChild(style);
}
