export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-gray-200">
      <h1 className="text-3xl font-bold mb-8 text-yellow-500">Политика конфиденциальности</h1>
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-sm text-gray-400">Дата публикации: 06.03.2026 г.</p>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">1. КАКИЕ ДАННЫЕ МЫ СОБИРАЕМ</h2>
          <p>Мы собираем ваш Telegram ID, промпты и изображения-референсы исключительно для работы сервиса...</p>
          {/* Вставь сюда текст политики */}
        </section>

        <section className="mt-8">
          <p>По вопросам удаления данных пишите: @AlexCosh1</p>
        </section>
      </div>
    </div>
  );
}