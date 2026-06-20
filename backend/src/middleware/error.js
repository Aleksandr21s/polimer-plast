// Обёртка для async-обработчиков: ловит ошибки и передаёт в errorHandler.
export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Класс ошибки приложения с HTTP-статусом.
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Маршрут не найден' });
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: 'Ошибка валидации', details: err.issues });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Запись с такими данными уже существует' });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}
