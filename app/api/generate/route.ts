import { NextResponse } from "next/server";

export async function POST() {
  console.log("API WORKS");
  return NextResponse.json({ ok: true });
}
