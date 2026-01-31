import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    imageUrl: "https://picsum.photos/512",
  });
}

// добавим GET для теста
export async function GET() {
  return NextResponse.json({
    imageUrl: "https://picsum.photos/512",
  });
}
