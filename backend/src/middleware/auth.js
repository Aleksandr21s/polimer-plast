import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { prisma } from '../prismaClient.js';

// Достаёт пользователя из JWT (Authorization: Bearer <token>).
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    // Токен из заголовка Authorization или из query (?token=) — для прямых ссылок на скачивание файлов.
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

    const payload = jwt.verify(token, config.jwtSecret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { company: true },
    });
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

// Ограничение доступа по ролям: requireRole('MANAGER')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}
