export async function GET() {
  try {
    const res = await fetch("https://platform-api.max.ru/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": process.env.MAX_BOT_TOKEN!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: "https://klex.pro/api/max"
      })
    });

    const data = await res.text();

    return new Response(data);
  } catch (e) {
    return new Response("ERROR: " + String(e));
  }
}