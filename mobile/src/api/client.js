import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const TOKEN_KEY = 'pp_token';

let inMemoryToken = null;

export async function setToken(token) {
  inMemoryToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}
export async function loadToken() {
  inMemoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  return inMemoryToken;
}
export function getToken() {
  return inMemoryToken;
}

async function request(path, { method = 'GET', body, isForm } = {}) {
  const headers = {};
  if (inMemoryToken) headers.Authorization = `Bearer ${inMemoryToken}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, 'Нет связи с сервером. Проверьте, что бэкенд запущен.');
  }

  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }

  if (!res.ok) {
    const message = (data && data.error) || `Ошибка ${res.status}`;
    throw new ApiError(res.status, message, data?.details);
  }
  return data;
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, formData) => request(p, { method: 'POST', body: formData, isForm: true }),
  fileUrl: (path) => `${API_URL.replace(/\/api$/, '')}${path}`,
  // Ссылка на защищённый файл с токеном (для прямого скачивания через браузер)
  authedFileUrl: (path) => {
    const base = `${API_URL.replace(/\/api$/, '')}${path}`;
    return inMemoryToken ? `${base}${path.includes('?') ? '&' : '?'}token=${inMemoryToken}` : base;
  },
};
