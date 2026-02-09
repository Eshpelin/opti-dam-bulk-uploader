import { NextResponse } from "next/server";
import { grantPermission } from "@/lib/cmp-client";
import type { AccessorType, AccessType } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetType, targetId, accessorId, accessorType, accessType } = body as {
      targetType: "assets" | "folders";
      targetId: string;
      accessorId: string;
      accessorType: AccessorType;
      accessType: AccessType;
    };

    if (!targetType || !targetId || !accessorId || !accessorType || !accessType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await grantPermission(targetType, targetId, accessorId, accessorType, accessType);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to grant permission";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
