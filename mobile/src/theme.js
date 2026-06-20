// Единая тема оформления приложения (зелёно-лазурная палитра).
export const colors = {
  primary: '#32A33A',       // кнопки, чат, акценты
  primaryDark: '#2D5A30',   // тёмный конец градиента, шапки
  primaryLight: '#60C067',  // светлый конец градиента
  primarySoft: '#e8f6ea',   // светлая заливка чипов/бейджей
  accent: '#159A9C',        // лазурный акцент (образцы, бейдж менеджера)
  accentSoft: '#e2f4f4',
  bg: '#f4f7f5',
  card: '#ffffff',
  text: '#1b2420',
  textMuted: '#6b7773',
  border: '#e2e8e4',
  success: '#1f8a3b',
  successSoft: '#e6f4ea',
  warning: '#9a6700',
  warningSoft: '#fff8e1',
  danger: '#cf3b3b',
  dangerSoft: '#fdeded',
  white: '#ffffff',
};

// Основной градиент (зелёно-лазурный)
export const gradient = ['#60C067', '#2D5A30'];

export const spacing = (n) => n * 4;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const shadow = {
  shadowColor: '#11261a',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

// Цвета статусов заказа
export const statusColors = {
  NEW: { bg: '#e7f2ff', fg: '#1f6f8b' },
  INVOICE_ISSUED: { bg: colors.warningSoft, fg: colors.warning },
  PAID: { bg: colors.successSoft, fg: colors.success },
  SHIPPED: { bg: colors.primarySoft, fg: colors.primary },
  DELIVERED: { bg: colors.primarySoft, fg: colors.primaryDark },
  COMPLETED: { bg: colors.successSoft, fg: colors.success },
  CANCELLED: { bg: colors.dangerSoft, fg: colors.danger },
};
