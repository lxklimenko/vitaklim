import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    imageUrl: "https://picsum.photos/512",
  });
}
