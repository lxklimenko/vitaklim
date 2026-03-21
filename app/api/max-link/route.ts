import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { token, maxUserId } = await req.json();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("max_link_token", token)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Invalid token" });
  }

  await supabase
    .from("profiles")
    .update({
      max_user_id: maxUserId,
      max_link_token: null,
    })
    .eq("id", profile.id);

  return NextResponse.json({ success: true });
}