import { NextResponse } from "next/server";
// Импортируем официальную библиотеку
import { Bot } from '@maxhub/max-bot-api';

// Инициализируем бота
const bot = new Bot(process.env.MAX_BOT_TOKEN!);

bot.command('start', async (ctx: any) => {
  const senderName = ctx.message?.sender?.first_name || 'друг';
  console.log(`✅ Webhook поймал команду /start от: ${senderName}`);
  
  await ctx.reply(`Привет, ${senderName}! ✨ Мы взломали систему через Webhook! 🚀🍌`);
});

// ИСПРАВЛЕНИЕ 1: Используем правильное название события 'message_created'
bot.on('message_created', async (ctx: any) => {
  const text = ctx.message?.body?.text;
  if (text && text !== '/start') {
    await ctx.reply(`Ты написал: ${text}. Бот на связи!`);
  }
});

export async function POST(req: Request) {
  try {
    const update = await req.json();
    console.log("MAX ВХОДЯЩИЙ ВЕБХУК:", update?.message?.body?.text);

    // ИСПРАВЛЕНИЕ 2: Обходим TypeScript защиту (bot as any), чтобы дернуть скрытый метод
    await (bot as any).handleUpdate(update);

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error("MAX ERROR ВНУТРИ NEXT.JS:", e);
    return NextResponse.json({ ok: false });
  }
}