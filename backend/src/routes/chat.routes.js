import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../prismaClient.js';
import { asyncH } from '../middleware/error.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { botReply } from '../services/chatbot.js';
import { llmReply, isOllamaAvailable } from '../services/llm.js';
import { config } from '../config/env.js';

const router = Router();

// Какой движок доступен сейчас (для переключателя в интерфейсе чата)
router.get('/engine-status', authenticate, asyncH(async (_req, res) => {
  res.json({
    defaultProvider: config.llmProvider,
    model: config.ollamaModel,
    ollamaAvailable: await isOllamaAvailable(),
  });
}));

// Отправить сообщение чат-боту
router.post('/', authenticate, asyncH(async (req, res) => {
  const { message, sessionId, engine } = z.object({
    message: z.string().min(1),
    sessionId: z.string().nullish(),
    engine: z.enum(['rules', 'ollama']).nullish(),
  }).parse(req.body);
  const sid = sessionId || randomUUID();

  // Движок: явный выбор из интерфейса, иначе значение по умолчанию из .env (обычно rules).
  const mode = engine || config.llmProvider;

  await prisma.chatMessage.create({ data: { userId: req.user.id, sessionId: sid, role: 'USER', text: message } });

  // Режим «ИИ» — пробуем LLM, при любой ошибке/выключенной Ollama откатываемся на правила.
  let answer;
  if (mode === 'ollama') {
    try {
      answer = await llmReply(message);
    } catch (e) {
      console.error('[chat] LLM недоступна, откат на правила:', e.message);
      answer = await botReply(message);
      answer.engineUsed = 'rules';
      answer.fellBack = true;
    }
  } else {
    answer = await botReply(message);
    answer.engineUsed = 'rules';
  }

  const meta = {};
  if (answer.recommendations?.length) meta.recommendations = answer.recommendations;
  if (answer.engineUsed) meta.engineUsed = answer.engineUsed;

  const botMsg = await prisma.chatMessage.create({
    data: {
      userId: req.user.id, sessionId: sid, role: 'BOT', text: answer.reply, escalated: answer.escalate,
      meta: Object.keys(meta).length ? meta : undefined,
    },
  });

  res.json({
    sessionId: sid,
    reply: answer.reply,
    recommendations: answer.recommendations,
    escalate: answer.escalate,
    intent: answer.intent,
    engineUsed: answer.engineUsed,
    fellBack: answer.fellBack || false,
    messageId: botMsg.id,
  });
}));

// История диалога
router.get('/:sessionId', authenticate, asyncH(async (req, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: req.params.sessionId, userId: req.user.role === 'MANAGER' ? undefined : req.user.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages.map((m) => ({ id: m.id, role: m.role, text: m.text, escalated: m.escalated, meta: m.meta, createdAt: m.createdAt })));
}));

// Передать диалог менеджеру (эскалация)
router.post('/:sessionId/escalate', authenticate, asyncH(async (req, res) => {
  await prisma.chatMessage.create({
    data: { userId: req.user.id, sessionId: req.params.sessionId, role: 'USER', text: '[Запрос передан менеджеру]', escalated: true },
  });
  res.json({ message: 'Обращение передано менеджеру. Он свяжется с вами в ближайшее время.' });
}));

// «Обращение» = сессия с явной эскалацией (клиент нажал «передать менеджеру»).
// answered — менеджер ответил на последнее сообщение клиента (BOT не считается).
function computeAnswered(messages) {
  let lastUserAt = null;
  let lastManagerAt = null;
  for (const m of messages) {
    if (m.role === 'USER') lastUserAt = m.createdAt;
    else if (m.role === 'MANAGER') lastManagerAt = m.createdAt;
  }
  return !!(lastManagerAt && lastUserAt && lastManagerAt >= lastUserAt);
}
// closed — менеджер закрыл обращение: помечаем последнее сообщение-эскалацию
// (role=USER, escalated) флагом meta.resolved (без миграции схемы).
function isClosed(messages) {
  let latestEsc = null;
  for (const m of messages) if (m.role === 'USER' && m.escalated) latestEsc = m;
  return !!(latestEsc && latestEsc.meta && latestEsc.meta.resolved);
}
function sessionStatus(messages) {
  if (isClosed(messages)) return 'closed';
  return computeAnswered(messages) ? 'answered' : 'pending';
}
function statusRank(s) { return s === 'pending' ? 0 : s === 'answered' ? 1 : 2; }

// Список обращений (менеджер) — по сессиям; ожидающие сверху, закрытые снизу
router.get('/manager/escalations', authenticate, requireRole('MANAGER'), asyncH(async (_req, res) => {
  const escalations = await prisma.chatMessage.findMany({
    where: { escalated: true, role: 'USER' },
    select: { sessionId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const escalatedAt = new Map();
  for (const e of escalations) if (!escalatedAt.has(e.sessionId)) escalatedAt.set(e.sessionId, e.createdAt);
  const sessionIds = [...escalatedAt.keys()];
  if (!sessionIds.length) return res.json([]);

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { firstName: true, lastName: true, email: true, company: { select: { name: true } } } } },
  });
  const bySession = new Map();
  for (const m of messages) {
    let s = bySession.get(m.sessionId);
    if (!s) { s = { messages: [], user: null }; bySession.set(m.sessionId, s); }
    s.messages.push(m);
    if (!s.user && m.role === 'USER' && m.user) s.user = m.user;
  }

  const result = sessionIds.map((sid) => {
    const s = bySession.get(sid) || { messages: [], user: null };
    const last = s.messages[s.messages.length - 1] || null;
    const status = sessionStatus(s.messages);
    return {
      sessionId: sid,
      user: s.user,
      escalatedAt: escalatedAt.get(sid),
      lastMessage: last ? { text: last.text, role: last.role, createdAt: last.createdAt } : null,
      answered: status === 'answered',
      closed: status === 'closed',
      status,
    };
  });
  result.sort((a, b) => {
    if (statusRank(a.status) !== statusRank(b.status)) return statusRank(a.status) - statusRank(b.status);
    const at = a.lastMessage?.createdAt || a.escalatedAt;
    const bt = b.lastMessage?.createdAt || b.escalatedAt;
    return new Date(bt) - new Date(at);
  });
  res.json(result);
}));

// Счётчик ожидающих обращений (менеджер) — для бейджа (без закрытых и отвеченных)
router.get('/manager/escalations/count', authenticate, requireRole('MANAGER'), asyncH(async (_req, res) => {
  const escalations = await prisma.chatMessage.findMany({ where: { escalated: true, role: 'USER' }, select: { sessionId: true } });
  const sessionIds = [...new Set(escalations.map((e) => e.sessionId))];
  if (!sessionIds.length) return res.json({ unanswered: 0 });
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: { in: sessionIds } },
    select: { sessionId: true, role: true, escalated: true, meta: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const grouped = new Map();
  for (const m of messages) {
    if (!grouped.has(m.sessionId)) grouped.set(m.sessionId, []);
    grouped.get(m.sessionId).push(m);
  }
  let unanswered = 0;
  for (const sid of sessionIds) if (sessionStatus(grouped.get(sid) || []) === 'pending') unanswered++;
  res.json({ unanswered });
}));

// Ответ менеджера в диалог
router.post('/manager/:sessionId/reply', authenticate, requireRole('MANAGER'), asyncH(async (req, res) => {
  const { message } = z.object({ message: z.string().min(1) }).parse(req.body);
  const { sessionId } = req.params;
  const firstUser = await prisma.chatMessage.findFirst({ where: { sessionId, role: 'USER' }, orderBy: { createdAt: 'asc' } });
  if (!firstUser) return res.status(404).json({ error: 'Сессия не найдена' });
  const msg = await prisma.chatMessage.create({
    data: { userId: firstUser.userId, sessionId, role: 'MANAGER', text: message },
  });
  res.json({ id: msg.id, role: msg.role, text: msg.text, createdAt: msg.createdAt });
}));

// Закрыть обращение (менеджер) — помечаем эскалации сессии как resolved
router.post('/manager/:sessionId/close', authenticate, requireRole('MANAGER'), asyncH(async (req, res) => {
  const { sessionId } = req.params;
  const r = await prisma.chatMessage.updateMany({
    where: { sessionId, role: 'USER', escalated: true },
    data: { meta: { resolved: true, closedAt: new Date().toISOString() } },
  });
  if (!r.count) return res.status(404).json({ error: 'Обращение не найдено' });
  res.json({ ok: true });
}));

// История обращений клиента — его эскалированные диалоги со статусом
router.get('/my/sessions', authenticate, asyncH(async (req, res) => {
  const escalations = await prisma.chatMessage.findMany({
    where: { userId: req.user.id, escalated: true, role: 'USER' },
    select: { sessionId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const escalatedAt = new Map();
  for (const e of escalations) if (!escalatedAt.has(e.sessionId)) escalatedAt.set(e.sessionId, e.createdAt);
  const sessionIds = [...escalatedAt.keys()];
  if (!sessionIds.length) return res.json([]);

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: { in: sessionIds }, userId: req.user.id },
    orderBy: { createdAt: 'asc' },
  });
  const bySession = new Map();
  for (const m of messages) {
    if (!bySession.has(m.sessionId)) bySession.set(m.sessionId, []);
    bySession.get(m.sessionId).push(m);
  }
  const result = sessionIds.map((sid) => {
    const msgs = bySession.get(sid) || [];
    const last = msgs[msgs.length - 1] || null;
    return {
      sessionId: sid,
      escalatedAt: escalatedAt.get(sid),
      lastMessage: last ? { text: last.text, role: last.role, createdAt: last.createdAt } : null,
      status: sessionStatus(msgs),
    };
  });
  result.sort((a, b) => new Date(b.lastMessage?.createdAt || b.escalatedAt) - new Date(a.lastMessage?.createdAt || a.escalatedAt));
  res.json(result);
}));

export default router;
