import { NextResponse } from "next/server";
import { Bot } from '@maxhub/max-bot-api';

// ❗ токен бери из env (а не хардкод)
const bot = new Bot(process.env.MAX_BOT_TOKEN!);

// команда /start
bot.command('start', async (ctx: any) => {
  const senderName = ctx.message?.sender?.first_name || 'друг';
  
  console.log(`START от: ${senderName}`);
  
  await ctx.reply(`Привет, ${senderName}! 🚀`);
});

// любое сообщение
bot.on('message_created', async (ctx: any) => {
  const text = ctx.message?.body?.text;

  if (text && text !== '/start') {
    await ctx.reply(`Ты написал: ${text}`);
  }
});

export async function POST(req: Request) {
  try {
    const update = await req.json();

    console.log("MAX UPDATE:", update);

    // 🔥 ключевая магия
    await (bot as any).handleUpdate(update);

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error("MAX ERROR:", e);
    return NextResponse.json({ ok: false });
  }
}

// чтобы MAX проверял endpoint
export async function GET() {
  return NextResponse.json({ status: "ok" });
}