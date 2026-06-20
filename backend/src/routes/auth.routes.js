import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prismaClient.js';
import { asyncH, AppError } from '../middleware/error.js';
import { authenticate, signToken } from '../middleware/auth.js';

const router = Router();

// Очищает строку от пробелов/дефисов; пустую строку превращает в undefined.
const clean = (v) => {
  if (v == null) return undefined;
  const s = String(v).replace(/[\s-]/g, '');
  return s === '' ? undefined : s;
};
// Необязательное поле из цифр: пустое — пропускается, иначе проверяется с понятным сообщением.
const digitsOpt = (re, msg) => z.preprocess(clean, z.string().regex(re, msg).optional());

const companySchema = z.object({
  name: z.string().min(2, 'Укажите наименование организации'),
  orgForm: z.enum(['OOO', 'IP']).default('OOO'),
  inn: z.preprocess(clean, z.string({ required_error: 'Укажите ИНН' }).regex(/^\d{10,12}$/, 'ИНН должен содержать 10 цифр (для ИП — 12)')),
  kpp: digitsOpt(/^\d{9}$/, 'КПП должен содержать 9 цифр (у ИП КПП нет — оставьте пустым)'),
  ogrn: digitsOpt(/^(\d{13}|\d{15})$/, 'ОГРН — 13 цифр (для ИП ОГРНИП — 15 цифр)'),
  legalAddress: z.string().optional().or(z.literal('')),
});

const registerSchema = z.object({
  email: z.string().email('Некорректный e-mail'),
  password: z.string().min(6, 'Пароль не менее 6 символов'),
  firstName: z.string().min(1, 'Укажите имя'),
  lastName: z.string().min(1, 'Укажите фамилию'),
  middleName: z.string().optional().or(z.literal('')),
  position: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  company: companySchema,
});

function publicUser(u) {
  return {
    id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
    middleName: u.middleName, position: u.position, phone: u.phone, role: u.role,
    company: u.company ? { id: u.company.id, name: u.company.name, inn: u.company.inn, discountPercent: Number(u.company.discountPercent) } : null,
  };
}

// Регистрация: компания создаётся (или находится по ИНН) отдельно, пользователь относится к ней.
router.post('/register', asyncH(async (req, res) => {
  const data = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) throw new AppError(409, 'Пользователь с таким e-mail уже существует');

  // Компания: ищем по ИНН, иначе создаём
  let company = await prisma.company.findUnique({ where: { inn: data.company.inn } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: data.company.name,
        orgForm: data.company.orgForm,
        inn: data.company.inn,
        kpp: data.company.kpp || null,
        ogrn: data.company.ogrn || null,
        legalAddress: data.company.legalAddress || null,
      },
    });
  }

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: bcrypt.hashSync(data.password, 10),
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName || null,
      position: data.position || null,
      phone: data.phone || null,
      role: 'CLIENT',
      companyId: company.id,
    },
    include: { company: true },
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

// Вход
router.post('/login', asyncH(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw new AppError(401, 'Неверный e-mail или пароль');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// Текущий пользователь
router.get('/me', authenticate, asyncH(async (req, res) => {
  res.json({ user: publicUser(req.user) });
}));

export default router;
