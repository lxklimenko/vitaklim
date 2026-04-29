import Link from 'next/link';
import { ArrowLeft, Zap, Sparkles, Crown, Image } from 'lucide-react';

const MODELS = [
  {
    name: 'Nano Banano 2',
    desc: 'Быстрая генерация для простых задач',
    price: 10,
    badge: 'NEW',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    icon: <Zap size={20} />,
    iconColor: 'from-blue-400 to-cyan-500',
  },
  {
    name: 'Nano Banana Pro',
    desc: 'Детализация и интеллект для сложных задач',
    price: 15,
    badge: 'PRO',
    badgeColor: 'bg-yellow-500/20 text-yellow-400',
    icon: <Sparkles size={20} />,
    iconColor: 'from-yellow-300 to-yellow-500',
  },
  {
    name: 'Nano Banano Pro (4K)',
    desc: 'Бескомпромиссный фотореализм в 4K',
    price: 20,
    badge: '4K',
    badgeColor: 'bg-purple-500/20 text-purple-400',
    icon: <Crown size={20} />,
    iconColor: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Imagen 4 Ultra / DALL-E 3',
    desc: 'Топовые модели Google и OpenAI',
    price: 5,
    badge: 'ULTRA',
    badgeColor: 'bg-green-500/20 text-green-400',
    icon: <Image size={20} />,
    iconColor: 'from-green-400 to-teal-500',
  },
];

const PACKAGES = [
  { amount: 100, bananas: 100, popular: false },
  { amount: 300, bananas: 300, popular: false },
  { amount: 500, bananas: 500, popular: true },
  { amount: 1000, bananas: 1000, popular: false },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 pb-28">

        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition mb-8 text-sm">
          <ArrowLeft size={16} />
          Назад
        </Link>

        <h1 className="text-3xl font-bold mb-2">Тарифы</h1>
        <p className="text-white/50 mb-10">Пополняй баланс и генерируй изображения с помощью лучших ИИ-моделей</p>

        {/* Как работает баланс */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🍌</span>
            <h2 className="text-lg font-semibold">Как работает баланс</h2>
          </div>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <span className="text-white/30 mt-0.5">—</span>
              Валюта сервиса — бананы (🍌). 1 рубль = 1 банан.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/30 mt-0.5">—</span>
              Бананы списываются при каждой генерации — стоимость зависит от модели.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/30 mt-0.5">—</span>
              При ошибке генерации средства автоматически возвращаются.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/30 mt-0.5">—</span>
              Срок действия баланса не ограничен.
            </li>
          </ul>
        </div>

        {/* Пакеты пополнения */}
        <h2 className="text-xl font-semibold mb-4">Пополнение баланса</h2>
        <div className="grid grid-cols-2 gap-3 mb-10">
          {PACKAGES.map(({ amount, bananas, popular }) => (
            <div
              key={amount}
              className={`relative rounded-2xl p-4 border transition ${
                popular
                  ? 'bg-white/10 border-white/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {popular && (
                <span className="absolute -top-2.5 left-4 text-xs bg-white text-black font-semibold px-2 py-0.5 rounded-full">
                  Популярный
                </span>
              )}
              <p className="text-2xl font-bold mb-1">{amount} ₽</p>
              <p className="text-sm text-white/50">{bananas} 🍌</p>
            </div>
          ))}
        </div>

        {/* Стоимость генерации по моделям */}
        <h2 className="text-xl font-semibold mb-4">Стоимость генерации</h2>
        <div className="space-y-3">
          {MODELS.map((model) => (
            <div
              key={model.name}
              className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4"
            >
              <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${model.iconColor} flex items-center justify-center shrink-0`}>
                {model.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium truncate">{model.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${model.badgeColor}`}>
                    {model.badge}
                  </span>
                </div>
                <p className="text-xs text-white/40 truncate">{model.desc}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-lg">{model.price}</p>
                <p className="text-xs text-white/40">🍌 / раз</p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">Частые вопросы</h2>

          {[
            {
              q: 'Как пополнить баланс?',
              a: 'Откройте профиль и нажмите «Пополнить». Оплата через ЮKassa (карта, СБП). Деньги поступят мгновенно.',
            },
            {
              q: 'Средства вернутся, если генерация не удалась?',
              a: 'Да, при любой технической ошибке бананы автоматически возвращаются на баланс.',
            },
            {
              q: 'Есть ли минимальная сумма пополнения?',
              a: 'Минимальная сумма — 50 ₽, максимальная — 10 000 ₽ за одну транзакцию.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="font-medium mb-1.5">{q}</p>
              <p className="text-sm text-white/50">{a}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-white/25">
          По вопросам: <a href="https://t.me/AlexCosh1" className="underline hover:text-white/50">@AlexCosh1</a>
        </p>

      </div>
    </div>
  );
}
