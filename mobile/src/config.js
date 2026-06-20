import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Базовый адрес API.
// 1) Явное переопределение через EXPO_PUBLIC_API_URL — для прод/туннеля/защиты
//    (укажите полный адрес с /api, напр. https://xxx.trycloudflare.com/api).
// 2) Веб: хост берётся из адресной строки браузера — так бэкенд доступен и при
//    открытии по IP с телефона (http://<IP>:8090 → API http://<IP>:4000/api),
//    и на localhost при разработке на ПК.
// 3) Нативно (Expo Go/симулятор): хост из Expo (IP машины разработчика), иначе localhost.
function resolveBaseUrl() {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:4000/api`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0] || 'localhost';
  return `http://${host}:4000/api`;
}

export const API_URL = resolveBaseUrl();
