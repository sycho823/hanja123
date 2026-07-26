import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: "hanja-byeolgok-test", firestore: { rules: fs.readFileSync("firestore.rules", "utf8") } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes/c1"), { teacherUid: "teacher-a", code: "TEST1", name: "테스트반" });
    await setDoc(doc(db, "classes/c2"), { teacherUid: "teacher-b", code: "TEST2", name: "다른반" });
    await setDoc(doc(db, "students/student-a"), { uid: "student-a", classId: "c1", nickname: "학생A" });
    await setDoc(doc(db, "students/student-b"), { uid: "student-b", classId: "c2", nickname: "학생B" });
    await setDoc(doc(db, "studentProgress/student-a"), { studentId: "student-a", classId: "c1", completed: [], currentChapter: 1 });
    await setDoc(doc(db, "studentProgress/student-b"), { studentId: "student-b", classId: "c2", completed: [], currentChapter: 1 });
  });
});
after(async () => env?.cleanup());

test("학생은 자기 기록을 읽고 허용된 진도만 수정한다", async () => {
  const db = env.authenticatedContext("student-a", { firebase: { sign_in_provider: "anonymous" } }).firestore();
  await assertSucceeds(getDoc(doc(db, "studentProgress/student-a")));
  await assertSucceeds(updateDoc(doc(db, "studentProgress/student-a"), { completed: ["一"], currentChapter: 1 }));
  await assertFails(updateDoc(doc(db, "studentProgress/student-a"), { classId: "c2" }));
});

test("학생은 다른 학생 기록을 읽거나 수정할 수 없다", async () => {
  const db = env.authenticatedContext("student-a").firestore();
  await assertFails(getDoc(doc(db, "studentProgress/student-b")));
  await assertFails(updateDoc(doc(db, "studentProgress/student-b"), { completed: ["一"] }));
});

test("교사는 담당 학급만 읽을 수 있고 클라이언트 쓰기는 못 한다", async () => {
  const db = env.authenticatedContext("teacher-a", { teacher: true }).firestore();
  await assertSucceeds(getDoc(doc(db, "studentProgress/student-a")));
  await assertFails(getDoc(doc(db, "studentProgress/student-b")));
  await assertFails(updateDoc(doc(db, "studentProgress/student-a"), { completed: ["一"] }));
});

test("교사 claim 없는 사용자는 학급 전체를 볼 수 없다", async () => {
  const db = env.authenticatedContext("teacher-a").firestore();
  await assertFails(getDoc(doc(db, "studentProgress/student-a")));
  assert.ok(true);
});
