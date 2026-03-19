import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/app/lib/supabase-admin"

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("login_token", token)
    .single()

  if (!profile) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  if (new Date(profile.login_token_expires) < new Date()) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 })
  }

  // удаляем токен (одноразовый)
  await supabaseAdmin
    .from("profiles")
    .update({
      login_token: null,
      login_token_expires: null,
    })
    .eq("id", profile.id)

  return NextResponse.json({
  success: true,
  telegramId: profile.telegram_id,
  debug: "NEW VERSION"
})
}