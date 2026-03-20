import 'dotenv/config';
import { Bot } from '@maxhub/max-bot-api';

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command('hello', (ctx) => {
  return ctx.reply('Привет! ✨');
});

bot.start();