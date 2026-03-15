export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { createClient } from "@/app/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  // В Next.js 15 параметры НУЖНО ждать (await)
  const { id: userId } = await params;
  
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  // Защита админа
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', authUser?.id)
    .single();

  if (!profile?.is_admin) notFound();

  // Получаем данные юзера
  const { data: user } = await supabaseAdmin
    .from("admin_users_view")
    .select("*")
    .eq("id", userId)
    .single();

  if (!user) return <div className="p-20 text-white">Пользователь не найден</div>;

  // Сегодняшние генерации
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: todayGen } = await supabaseAdmin
    .from("generations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", today.toISOString());

  // Последние работы
  const { data: generations } = await supabaseAdmin
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Генерируем временные подписанные ссылки для изображений (срок действия 1 час)
  const generationsWithSignedUrls = await Promise.all((generations || []).map(async (g) => {
    if (!g.image_url) return g;

    // Извлекаем имя файла из URL (отбрасываем параметры, если есть)
    let fileName: string | undefined;
    try {
      // Пытаемся получить путь из полного URL
      const urlObj = new URL(g.image_url);
      const pathParts = urlObj.pathname.split('/');
      fileName = pathParts[pathParts.length - 1];
    } catch {
      // Если не URL, то, возможно, это просто имя файла
      fileName = g.image_url.split('/').pop()?.split('?')[0];
    }

    if (!fileName) return g;

    const { data } = await supabaseAdmin
      .storage
      .from('generations') // Убедитесь, что имя бакета совпадает с вашим проектом
      .createSignedUrl(fileName, 3600); // 3600 секунд = 1 час

    return { ...g, signedUrl: data?.signedUrl };
  }));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10">
      <Link href="/admin/users" className="text-white/40 hover:text-white mb-6 inline-block">← Назад к списку</Link>
      
      <h1 className="text-4xl font-bold mb-10">
        {user.telegram_first_name} <span className="text-white/20 text-2xl">@{user.telegram_username}</span>
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <Card title="Баланс" value={`${user.balance} 🍌`} />
        <Card title="Сегодня" value={todayGen || 0} />
        <Card title="Всего ИИ" value={user.generations || 0} />
        <Card title="Потрачено" value={`${user.spent || 0} 🍌`} />
      </div>

      <div className="bg-[#141414] border border-white/10 rounded-3xl p-8">
        <h2 className="text-xl font-bold mb-8 text-white/60 uppercase tracking-widest">Последние генерации</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {generationsWithSignedUrls?.map((g: any) => (
            <div key={g.id} className="aspect-square relative group">
              {g.signedUrl ? (
                <img src={g.signedUrl} className="w-full h-full object-cover rounded-xl" alt="" />
              ) : (
                <div className="w-full h-full bg-white/5 rounded-xl flex items-center justify-center text-xs text-white/20">Нет фото</div>
              )}
              <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition p-4 text-[10px] overflow-hidden rounded-xl">
                {g.prompt}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
      <div className="text-white/40 text-xs uppercase mb-2 tracking-tighter">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}