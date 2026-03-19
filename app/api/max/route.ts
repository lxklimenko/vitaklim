import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.json()

  const text = body?.message?.body?.text
  const maxUserId = body?.message?.sender?.id

  if (!text || !maxUserId) {
    return NextResponse.json({ ok: true })
  }

  // ловим /start TOKEN
  const parts = text.split(' ')
  const token = parts[1]

  if (token) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("login_token", token)
      .single()

    if (profile) {
      await supabase
        .from("profiles")
        .update({
          max_id: maxUserId,
          login_token: null,
          login_token_expires: null
        })
        .eq("id", profile.id)

      console.log("MAX LINKED:", profile.id)
    }
  }

  return NextResponse.json({ ok: true })
}