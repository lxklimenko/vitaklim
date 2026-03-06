export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-gray-200">
      <h1 className="text-3xl font-bold mb-8 text-yellow-500">Публичная оферта KLEX.PRO</h1>
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-sm text-gray-400">Дата публикации: 06.03.2026 г.</p>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">1. ОБЩИЕ ПОЛОЖЕНИЯ</h2>
          <p>Данный документ является официальным предложением ИП Клименко А.А. (Исполнитель) для любого лица (Пользователь)...</p>
          {/* Вставь сюда полный текст оферты, который мы подготовили ранее */}
        </section>

        {/* Добавь остальные разделы аналогично */}
        
        <section className="bg-gray-800 p-6 rounded-lg mt-12">
          <h2 className="text-xl font-semibold mb-4 text-yellow-500">Реквизиты Исполнителя</h2>
          <p>ИП Клименко А.А.</p>
          <p>ИНН: 234607306390</p>
          <p>Email: lxkimenko@gmail.com</p>
        </section>
      </div>
    </div>
  );
}