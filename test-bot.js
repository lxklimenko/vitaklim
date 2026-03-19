import { Bot } from '@maxhub/max-bot-api';

const bot = new Bot('f9LHodD0cOLMc8UCrC62G1ec2CypSZR1hYdu5-DRyPm3Er_LKh5BjR-6NnnWiQqkDeviNqkKrxBsDsa-SK4V');

bot.command('start', (ctx) => {
  // Вытаскиваем имя безопасным способом (прямо из объекта message)
  const senderName = ctx.message?.sender?.first_name || 'друг';
  
  console.log(`✅ Команда получена от: ${senderName}`);
  
  // Отправляем ответ! SDK само подставит правильный chat_id и структуру
  return ctx.reply(`Привет, ${senderName}! ✨ SDK работает идеально!`);
});

bot.start();
console.log("🚀 Тестовый бот запущен. Жду команду /start...");