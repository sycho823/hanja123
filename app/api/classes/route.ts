import { NextResponse } from "next/server";
import { adminDb, requireTeacher } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher(request);
    const { name, grade, code } = await request.json();
    const cleanCode = String(code ?? "").trim().toUpperCase();
    if (!name || !cleanCode || !/^[A-Z0-9-]{4,12}$/.test(cleanCode)) return NextResponse.json({ error: "학급 정보를 확인하세요." }, { status: 400 });
    const duplicate = await adminDb().collection("classes").where("code", "==", cleanCode).limit(1).get();
    if (!duplicate.empty) return NextResponse.json({ error: "이미 사용 중인 학급 코드입니다." }, { status: 409 });
    const ref = adminDb().collection("classes").doc();
    await ref.set({ name: String(name).slice(0, 30), grade: Number(grade), code: cleanCode, teacherUid: teacher.uid, createdAt: new Date() });
    return NextResponse.json({ id: ref.id, name, grade: Number(grade), code: cleanCode });
  } catch {
    return NextResponse.json({ error: "교사 권한이 필요합니다." }, { status: 403 });
  }
}

export async function GET(request: Request) {
  try {
    const teacher = await requireTeacher(request);
    const classes = await adminDb().collection("classes").where("teacherUid", "==", teacher.uid).get();
    const result = await Promise.all(classes.docs.map(async (c) => {
      const students = await adminDb().collection("students").where("classId", "==", c.id).get();
      const rows = await Promise.all(students.docs.map(async (s) => {
        const p = await adminDb().doc(`studentProgress/${s.id}`).get();
        return { uid: s.id, nickname: s.data().nickname, completed: p.data()?.completed?.length ?? 0, currentChapter: p.data()?.currentChapter ?? 1, updatedAt: p.data()?.updatedAt?.toDate?.()?.toISOString?.() ?? "" };
      }));
      return { id: c.id, ...c.data(), students: rows };
    }));
    return NextResponse.json({ classes: result });
  } catch {
    return NextResponse.json({ error: "교사 권한이 필요합니다." }, { status: 403 });
  }
}
