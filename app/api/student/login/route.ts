import { createHash } from "node:crypto";
import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const normalizeNickname = (value: unknown) =>
  String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
const nicknameKey = (classId: string, nickname: string) =>
  `${classId}_${createHash("sha256").update(nickname).digest("hex")}`;

export async function POST(request: Request) {
  try {
    const { classCode, nickname, password } = await request.json();
    const code = String(classCode ?? "").trim().toUpperCase();
    const normalized = normalizeNickname(nickname);
    const secret = String(password ?? "");
    if (!code || !normalized || !secret) return NextResponse.json({ error: "학급 코드, 닉네임, 비밀번호를 입력하세요." }, { status: 400 });
    const classes = await adminDb().collection("classes").where("code", "==", code).limit(1).get();
    if (classes.empty) return NextResponse.json({ error: "로그인 정보를 확인하세요." }, { status: 401 });
    const classId = classes.docs[0].id;
    const aliasRef = adminDb().doc(`studentAliases/${nicknameKey(classId, normalized)}`);
    const alias = await aliasRef.get();
    const data = alias.data();
    const lockedUntil = data?.lockedUntil?.toDate?.() as Date | undefined;
    if (!alias.exists || (lockedUntil && lockedUntil.getTime() > Date.now())) {
      return NextResponse.json({ error: lockedUntil ? "로그인 시도가 많아 잠시 후 다시 시도하세요." : "로그인 정보를 확인하세요." }, { status: 401 });
    }
    const valid = await compare(secret, data?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    if (!valid) {
      const attempts = Number(data?.failedAttempts ?? 0) + 1;
      await aliasRef.update({ failedAttempts: attempts >= 5 ? 0 : attempts, lockedUntil: attempts >= 5 ? new Date(Date.now() + 10 * 60_000) : null });
      return NextResponse.json({ error: "로그인 정보를 확인하세요." }, { status: 401 });
    }
    await aliasRef.update({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() });
    const token = await adminAuth().createCustomToken(data!.uid, { student: true, classId });
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "학생 로그인에 실패했습니다." }, { status: 500 });
  }
}
