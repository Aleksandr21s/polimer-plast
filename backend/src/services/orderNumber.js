import { prisma } from '../prismaClient.js';

// Человекочитаемый номер заказа: КП-ГГГГ-NNNN
export async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.order.count();
  const seq = String(count + 1).padStart(4, '0');
  let number = `КП-${year}-${seq}`;
  // на случай коллизии — добавить суффикс
  while (await prisma.order.findUnique({ where: { number } })) {
    number = `КП-${year}-${seq}-${Math.floor(Math.random() * 90 + 10)}`;
  }
  return number;
}
