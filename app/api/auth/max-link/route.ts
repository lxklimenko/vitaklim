import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/app/lib/supabase-admin"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  const { userId } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: "No userId" }, { status: 400 })
  }

  const token = crypto.randomUUID()

  await supabaseAdmin
    .from("profiles")
    .update({
      login_token: token,
      login_token_expires: new Date(Date.now() + 5 * 60 * 1000),
    })
    .eq("id", userId)

  return NextResponse.json({
    url: `https://max.ru/id234607306390_bot?start=${token}`
  })
}