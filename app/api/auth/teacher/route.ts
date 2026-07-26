import { NextResponse } from "next/server";
import { adminAuth, adminDb, allowedTeacher, requireUser } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (user.firebase?.sign_in_provider !== "google.com" || !user.email || user.email_verified !== true || !allowedTeacher(user.email)) {
      return NextResponse.json({ error: "허용된 Google 교사 계정이 아닙니다." }, { status: 403 });
    }
    await adminAuth().setCustomUserClaims(user.uid, { teacher: true });
    await adminDb().doc(`teachers/${user.uid}`).set({ email: user.email, displayName: user.name ?? "", updatedAt: new Date() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "인증에 실패했습니다." }, { status: 401 });
  }
}
