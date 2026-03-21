import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 400 }
      );
    }

    // Fetch profile by login token
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("login_token", token)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check token expiration
    if (new Date(profile.login_token_expires) < new Date()) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 401 }
      );
    }

    // Invalidate token (single-use)
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        login_token: null,
        login_token_expires: null,
      })
      .eq("id", profile.id);

    if (updateError) {
      // Log error, but token might already be used; we still return success
      console.error("Failed to clear token:", updateError);
    }

    // Return success with user data (excluding sensitive fields)
    return NextResponse.json({
      success: true,
      telegramId: profile.telegram_id,
      profile: {
        id: profile.id,
        telegram_id: profile.telegram_id,
        // add other non-sensitive fields if needed
      },
    });
  } catch (error) {
    console.error("Login token verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}