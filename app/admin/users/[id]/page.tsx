export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/app/lib/supabase-admin";

export default async function AdminUserPage({ params }: any) {
  const supabase = supabaseAdmin;
  const userId = params.id;

  // Получаем данные пользователя из специального view
  const { data: user } = await supabase
    .from("admin_users_view")
    .select("*")
    .eq("id", userId)
    .single();

  // Если пользователь не найден – показываем заглушку
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-10">
        User not found
      </div>
    );
  }

  // Запрос количества генераций за сегодня (с учётом таймзоны)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: todayGenerations } = await supabase
    .from("generations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", today.toISOString());

  // Последние 20 генераций пользователя
  const { data: generations } = await supabase
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10">
      <h1 className="text-3xl font-bold mb-10">
        @{user.telegram_username || user.telegram_first_name || "User"}
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        <Card title="Balance" value={`${user.balance || 0} 🍌`} />
        <Card title="Generations today" value={todayGenerations || 0} />
        <Card title="Total generations" value={user.generations || 0} />
        <Card title="Spent bananas" value={`${user.spent || 0} 🍌`} />
      </div>

      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl mb-6">Last generations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {generations?.map(
            (g: any) =>
              g.image_url && (
                <img
                  key={g.id}
                  src={g.image_url}
                  className="rounded-lg"
                  alt="generation"
                />
              )
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
      <div className="text-white/50 text-sm mb-2">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}