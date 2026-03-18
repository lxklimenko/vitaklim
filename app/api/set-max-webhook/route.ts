export async function GET() {
  const res = await fetch("https://api.max.ru/bot/setWebhook", {
    method: "POST",
    headers: {
      "Authorization": "ТВОЙ_ТОКЕН",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: "https://klex.pro/api/max"
    })
  });

  const data = await res.text();

  return new Response(data);
}