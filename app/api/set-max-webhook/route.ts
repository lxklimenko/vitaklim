export async function GET() {
  try {
    const res = await fetch("https://api.max.ru/bot/setWebhook", {
      method: "POST",
      headers: {
        "Authorization": "f9LHodD0cOLMc8UCrC62G1ec2CypSZR1hYdu5-DRyPm3Er_LKh5BjR-6NnnWiQqkDeviNqkKrxBsDsa-SK4V",
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