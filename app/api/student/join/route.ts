import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (user.firebase?.sign_in_provider !== "anonymous") return NextResponse.json({ error: "익명 학생 계정만 참여할 수 있습니다." }, { status: 403 });
    const { classCode, nickname } = await request.json();
    const code = String(classCode ?? "").trim().toUpperCase();
    const name = String(nickname ?? "").trim().slice(0, 20);
    if (!code || !name) return NextResponse.json({ error: "학급 코드와 이름을 입력하세요." }, { status: 400 });
    const classes = await adminDb().collection("classes").where("code", "==", code).limit(1).get();
    if (classes.empty) return NextResponse.json({ error: "등록된 학급을 찾을 수 없습니다." }, { status: 404 });
    const classDoc = classes.docs[0];
    const ref = adminDb().doc(`students/${user.uid}`);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.classId !== classDoc.id) return NextResponse.json({ error: "이미 다른 학급에 등록된 학생입니다." }, { status: 409 });
    await ref.set({ uid: user.uid, classId: classDoc.id, nickname: name, createdAt: existing.exists ? existing.data()?.createdAt : new Date(), updatedAt: new Date() }, { merge: true });
    await adminDb().doc(`studentProgress/${user.uid}`).set({ studentId: user.uid, classId: classDoc.id, completed: [], currentChapter: 1, updatedAt: new Date() }, { merge: true });
    return NextResponse.json({ classId: classDoc.id, className: classDoc.data().name });
  } catch {
    return NextResponse.json({ error: "학생 인증에 실패했습니다." }, { status: 401 });
  }
}
