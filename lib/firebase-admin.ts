import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function app() {
  if (getApps()[0]) return getApps()[0];
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());

export async function requireUser(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("UNAUTHENTICATED");
  return adminAuth().verifyIdToken(header.slice(7), true);
}

export async function requireTeacher(request: Request) {
  const decoded = await requireUser(request);
  if (!decoded.teacher) throw new Error("FORBIDDEN");
  return decoded;
}

export function allowedTeacher(email?: string) {
  const allowed = (process.env.ALLOWED_TEACHER_EMAILS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowed.includes(email.toLowerCase()));
}
