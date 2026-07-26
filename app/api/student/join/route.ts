import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/firebase-admin";

const normalizeNickname = (value: unknown) =>
  String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
const nicknameKey = (classId: string, nickname: string) =>
  `${classId}_${createHash("sha256").update(nickname).digest("hex")}`;

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (user.firebase?.sign_in_provider !== "anonymous") return NextResponse.json({ error: "새 학생은 익명 Firebase 계정으로 등록해야 합니다." }, { status: 403 });
    const { classCode, nickname, password } = await request.json();
    const code = String(classCode ?? "").trim().toUpperCase();
    const displayName = String(nickname ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 20);
    const normalized = normalizeNickname(displayName);
    const secret = String(password ?? "");
    if (!/^[A-Z0-9-]{4,12}$/.test(code) || displayName.length < 2 || secret.length < 6 || secret.length > 72) {
      return NextResponse.json({ error: "학급 코드, 2자 이상의 닉네임, 6자 이상의 비밀번호를 확인하세요." }, { status: 400 });
    }
    const classes = await adminDb().collection("classes").where("code", "==", code).limit(1).get();
    if (classes.empty) return NextResponse.json({ error: "등록된 학급을 찾을 수 없습니다." }, { status: 404 });
    const classDoc = classes.docs[0];
    const studentRef = adminDb().doc(`students/${user.uid}`);
    const aliasRef = adminDb().doc(`studentAliases/${nicknameKey(classDoc.id, normalized)}`);
    const progressRef = adminDb().doc(`studentProgress/${user.uid}`);
    const passwordHash = await hash(secret, 12);
    await adminDb().runTransaction(async (transaction) => {
      const [student, alias] = await Promise.all([transaction.get(studentRef), transaction.get(aliasRef)]);
      if (student.exists) throw new Error("ALREADY_REGISTERED");
      if (alias.exists) throw new Error("DUPLICATE_NICKNAME");
      const now = new Date();
      transaction.create(aliasRef, { uid: user.uid, classId: classDoc.id, nickname: displayName, normalizedNickname: normalized, passwordHash, failedAttempts: 0, createdAt: now });
      transaction.create(studentRef, { uid: user.uid, classId: classDoc.id, nickname: displayName, createdAt: now, updatedAt: now });
      transaction.create(progressRef, { studentId: user.uid, classId: classDoc.id, completed: [], currentChapter: 1, updatedAt: now });
    });
    return NextResponse.json({ classId: classDoc.id, className: classDoc.data().name, nickname: displayName });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_NICKNAME") return NextResponse.json({ error: "이 학급에서 이미 사용 중인 닉네임입니다." }, { status: 409 });
    if (error instanceof Error && error.message === "ALREADY_REGISTERED") return NextResponse.json({ error: "이미 등록된 학생 계정입니다." }, { status: 409 });
    return NextResponse.json({ error: "학생 등록에 실패했습니다." }, { status: 401 });
  }
}
