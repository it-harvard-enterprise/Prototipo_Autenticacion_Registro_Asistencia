import { NextResponse } from "next/server";
import { createCourse } from "@/app/actions/courses";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const result = await createCourse(payload);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
