import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  console.log("🔥 MAX WEBHOOK HIT")

  return new Response(
    JSON.stringify({
      messages: [{ text: "🔥 WORKING" }]
    }),
    { headers: { "Content-Type": "application/json" } }
  )
}