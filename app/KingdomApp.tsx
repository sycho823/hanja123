"use client";

import { useEffect, useRef, useState } from "react";
import { browserLocalPersistence, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInAnonymously, signInWithCustomToken, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { chapters, allHanja } from "@/data/hanja";
import { expectedStrokes, judgeWriting, type Point } from "@/lib/handwriting";

type Screen = "landing" | "login" | "levels" | "map" | "study" | "teacher";
type Progress = { completed: string[]; currentChapter: number };
type PreviewClass = { name: string; grade: string | number; code: string };
type DashboardClass = PreviewClass & { id: string; students: Array<{ uid: string; nickname: string; completed: number; currentChapter: number; updatedAt: string }> };
const emptyProgress: Progress = { completed: [], currentChapter: 1 };
const mapNodes = [
  { x: 38, y: 47, icon: "🏯" }, { x: 17, y: 20, icon: "🌲" },
  { x: 61, y: 18, icon: "⛩️" }, { x: 78, y: 33, icon: "🏰" },
  { x: 25, y: 76, icon: "🏘️" }, { x: 58, y: 73, icon: "📚" },
  { x: 76, y: 67, icon: "👑" }, { x: 91, y: 48, icon: "🚪" },
];

function WritingBoard({ char, onPass }: { char: string; onPass: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [active, setActive] = useState<Point[] | null>(null);
  const [phase, setPhase] = useState<1 | 2>(1);
  const [showOrder, setShowOrder] = useState(false);
  const [result, setResult] = useState<{ score: number; message: string; passed: boolean } | null>(null);
  const size = 360;
  const paint = (extra?: Point[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = "#d6c7a9"; ctx.lineWidth = 1; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke(); ctx.setLineDash([]);
    if (phase === 1) {
      const expected = expectedStrokes(char, size);
      ctx.strokeStyle = "rgba(64,70,66,.24)"; ctx.lineWidth = 15; ctx.lineCap = "round"; ctx.lineJoin = "round";
      expected.forEach((points, i) => {
        ctx.beginPath(); points.forEach((p, n) => n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
        if (showOrder) {
          ctx.fillStyle = "#c9543b"; ctx.beginPath(); ctx.arc(points[0].x, points[0].y, 11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff9df"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), points[0].x, points[0].y);
        }
      });
    }
    ctx.strokeStyle = "#231d18"; ctx.lineWidth = 13; ctx.lineCap = "round"; ctx.lineJoin = "round";
    [...strokes, ...(extra?.length ? [extra] : [])].forEach((points) => { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); });
  };
  useEffect(() => paint(active ?? undefined));
  const changePhase = (next: 1 | 2) => { setPhase(next); setStrokes([]); setActive(null); setResult(null); setShowOrder(false); };
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * size, y: ((event.clientY - rect.top) / rect.height) * size };
  };
  return <div className="writing-wrap">
    <div className="phase-track"><span className={phase === 1 ? "active" : "done"}><b>1</b> 따라쓰기</span><i>→</i><span className={phase === 2 ? "active" : ""}><b>2</b> 혼자쓰기</span></div>
    <div className="canvas-frame">
      <canvas ref={canvasRef} width={size} height={size}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setActive([point(e)]); setResult(null); }}
        onPointerMove={(e) => active && setActive([...active, point(e)])}
        onPointerUp={() => { if (active?.length) setStrokes([...strokes, active]); setActive(null); }} />
    </div>
    <div className="writing-actions">
      <button className="paper-button" onClick={() => { setStrokes(strokes.slice(0, -1)); setResult(null); }}>한 획 되돌리기</button>
      <button className="paper-button" onClick={() => { setStrokes([]); setResult(null); }}>모두 지우기</button>
      {phase === 1 ? <button className="paper-button" onClick={() => setShowOrder(!showOrder)}>{showOrder ? "획순 숨기기" : "도움 보기 · 획순"}</button> : <button className="paper-button" onClick={() => changePhase(1)}>따라쓰기 다시 보기</button>}
      <button className="gold-button" onClick={() => {
        const judged = judgeWriting(char, strokes, size);
        if (judged.passed && phase === 1) { setResult({ ...judged, message: "따라쓰기 통과! 이제 본보기 없이 혼자 써 봐요." }); setTimeout(() => changePhase(2), 700); }
        else { setResult(judged); if (judged.passed) onPass(judged.score); }
      }}>{phase === 1 ? "따라쓰기 확인" : "혼자쓰기 확인"}</button>
    </div>
    {result && <div className={`judge ${result.passed ? "pass" : "retry"}`}><strong>{result.score}점</strong> {result.message}</div>}
  </div>;
}

export default function KingdomApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [chapterId, setChapterId] = useState(1);
  const [charIndex, setCharIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState<"student" | "teacher">("student");
  const [studentMode, setStudentMode] = useState<"register" | "login">("login");
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [previewClass, setPreviewClass] = useState<PreviewClass | null>(null);
  const [dashboardClasses, setDashboardClasses] = useState<DashboardClass[]>([]);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const mapStageRef = useRef<HTMLElement>(null);
  const mapPointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  useEffect(() => {
    if (!auth) return;
    void setPersistence(auth, browserLocalPersistence);
    return onAuthStateChanged(auth, async (next) => {
    setUser(next);
    if (!next) return;
    const isGoogleTeacher = next.providerData.some((provider) => provider.providerId === "google.com");
    if (isGoogleTeacher) {
      const claims = await next.getIdTokenResult();
      if (claims.claims.teacher === true) {
        const token = await next.getIdToken();
        const response = await fetch("/api/classes", { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const dashboard = await response.json();
          setDashboardClasses(dashboard.classes);
          setPreviewClass(dashboard.classes[0] ?? null);
          setScreen("teacher");
        }
      }
      return;
    }
    if (db) {
      const snap = await getDoc(doc(db, "studentProgress", next.uid));
      if (snap.exists()) {
        setProgress(snap.data() as Progress);
        setScreen("levels");
      }
    }
    });
  }, []);
  const save = async (next: Progress) => { setProgress(next); if (user && db) await setDoc(doc(db, "studentProgress", user.uid), { ...next, updatedAt: serverTimestamp() }, { merge: true }); };
  const complete = async (char: string) => {
    if (progress.completed.includes(char)) return;
    const completed = [...progress.completed, char];
    const chapter = chapters[chapterId - 1];
    const chapterDone = chapter.hanja.every((item) => completed.includes(item.char));
    const currentChapter = chapterDone ? Math.min(8, Math.max(progress.currentChapter, chapterId + 1)) : progress.currentChapter;
    await save({ completed, currentChapter });
  };
  const openChapter = (id: number) => { if (id > progress.currentChapter) return; setChapterId(id); const chapter = chapters[id - 1]; const first = chapter.hanja.findIndex((h) => !progress.completed.includes(h.char)); setCharIndex(first < 0 ? 0 : first); setScreen("study"); };
  const chapter = chapters[chapterId - 1]; const current = chapter.hanja[charIndex];
  const tokenFetch = async (url: string, init: RequestInit = {}) => {
    if (!auth?.currentUser) throw new Error("로그인이 필요합니다.");
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
    const text = await response.text();
    const body = text.startsWith("{") ? JSON.parse(text) : { error: `서버 오류가 발생했습니다. (${response.status})` };
    if (!response.ok) throw new Error(body.error ?? "요청에 실패했습니다.");
    return body;
  };
  const studentJoin = async (form: FormData) => {
    if (!auth) { setProgress(emptyProgress); setScreen("map"); return; }
    try {
      if (auth.currentUser) await signOut(auth);
      const credential = await signInAnonymously(auth);
      await tokenFetch("/api/student/join", { method: "POST", body: JSON.stringify({ classCode: form.get("classCode"), nickname: form.get("nickname"), password: form.get("password") }) });
      setUser(credential.user); setProgress(emptyProgress); setScreen("levels");
    } catch (error) { setNotice(error instanceof Error ? error.message : "학생 등록에 실패했습니다."); }
  };
  const studentLogin = async (form: FormData) => {
    if (!auth) { setProgress(emptyProgress); setScreen("map"); return; }
    try {
      const response = await fetch("/api/student/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classCode: form.get("classCode"), nickname: form.get("nickname"), password: form.get("password") }) });
      const text = await response.text();
      const body = text.startsWith("{") ? JSON.parse(text) : { error: `서버 오류가 발생했습니다. (${response.status})` };
      if (!response.ok) throw new Error(body.error);
      if (auth.currentUser) await signOut(auth);
      const credential = await signInWithCustomToken(auth, body.token);
      setUser(credential.user);
      if (db) { const snap = await getDoc(doc(db, "studentProgress", credential.user.uid)); if (snap.exists()) setProgress(snap.data() as Progress); }
      setScreen("levels");
    } catch (error) { setNotice(error instanceof Error ? error.message : "학생 로그인에 실패했습니다."); }
  };
  const teacherLogin = async () => {
    if (!auth) { setScreen("teacher"); return; }
    try {
      const currentIsGoogle = auth.currentUser?.providerData.some((provider) => provider.providerId === "google.com");
      const credential = currentIsGoogle ? { user: auth.currentUser! } : await signInWithPopup(auth, new GoogleAuthProvider());
      const token = await credential.user.getIdToken();
      const response = await fetch("/api/auth/teacher", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const text = await response.text();
      const body = text.startsWith("{") ? JSON.parse(text) : { error: `서버 오류가 발생했습니다. (${response.status})` };
      if (!response.ok) throw new Error(body.error);
      await credential.user.getIdToken(true);
      const dashboard = await tokenFetch("/api/classes");
      setDashboardClasses(dashboard.classes); if (dashboard.classes[0]) setPreviewClass(dashboard.classes[0]); setScreen("teacher");
    } catch (error) { setNotice(error instanceof Error ? error.message : "교사 로그인에 실패했습니다."); }
  };
  if (screen === "landing") return <main className="landing">
    <div className="hero-copy"><p className="eyebrow">초등 한자 8급 · 50자 모험</p><h1>한자별곡</h1><h2>안개 왕국의 비밀</h2><p>한 글자씩 바르게 써서 검은 안개를 걷고<br/>여덟 왕국을 되찾아 보세요.</p>
      <div className="hero-actions"><button className="gold-button big" onClick={() => {
        if (!user) setScreen("login");
        else if (user.providerData.some((provider) => provider.providerId === "google.com")) setScreen("teacher");
        else setScreen("levels");
      }}>{user ? "계속하기" : "모험 시작"}</button><button className="paper-button big" onClick={() => { setProgress(emptyProgress); setScreen("map"); }}>체험하기</button></div>
      {!isFirebaseConfigured && <small className="dev-badge">현재 체험 모드 · 저장/로그인은 Firebase 연결 후 활성화</small>}
    </div></main>;
  if (screen === "login") return <main className="auth-screen"><section className="panel auth-card"><button className="back" onClick={() => setScreen("landing")}>← 돌아가기</button><h2>왕국 입장소</h2>
    <div className="tabs"><button className={authMode === "student" ? "active" : ""} onClick={() => setAuthMode("student")}>학생</button><button className={authMode === "teacher" ? "active" : ""} onClick={() => setAuthMode("teacher")}>선생님</button></div>
    <p className="muted">{!isFirebaseConfigured ? "로컬 체험 모드입니다. Firebase 연결 후 기록이 안전하게 저장돼요." : authMode === "student" ? "이메일 없이 익명 학생 계정으로 입장해요. 학급 코드는 학급을 찾는 용도로만 사용됩니다." : "학교에서 허용한 Google 계정으로만 로그인할 수 있어요."}</p>
    {authMode === "student" ? <><div className="student-auth-toggle"><button className={studentMode === "login" ? "active" : ""} onClick={() => { setStudentMode("login"); setNotice(""); }}>다시 온 모험가</button><button className={studentMode === "register" ? "active" : ""} onClick={() => { setStudentMode("register"); setNotice(""); }}>새로운 모험가</button></div>
    <form action={studentMode === "register" ? studentJoin : studentLogin}><label>학급 코드<input name="classCode" required minLength={4} maxLength={12} autoCapitalize="characters" placeholder="선생님이 알려준 코드"/></label><label>닉네임<input name="nickname" required minLength={2} maxLength={20} autoComplete="username" placeholder="예: 구름봇"/></label><label>비밀번호<input name="password" type="password" required minLength={6} maxLength={72} autoComplete={studentMode === "login" ? "current-password" : "new-password"} placeholder="6자 이상"/></label>{studentMode === "register" && <small className="form-help">같은 학급에서는 이미 사용 중인 닉네임을 만들 수 없어요. 비밀번호는 암호화해 저장합니다.</small>}<button className="gold-button" type="submit">{!isFirebaseConfigured ? "저장 없이 체험 시작" : studentMode === "register" ? "새 모험가 등록" : "저장된 모험 계속하기"}</button></form></>
    : <button className="google-button" onClick={teacherLogin}><span>G</span> Google 교사 계정으로 로그인</button>}
    {authMode === "teacher" && !isFirebaseConfigured && <button className="preview-link" onClick={() => { setNotice(""); setScreen("teacher"); }}>대시보드 미리보기 →</button>}
    {notice && <p className="error">{notice}</p>}</section></main>;
  if (screen === "teacher") return <main className="teacher-screen"><header className="topbar"><button onClick={() => setScreen("landing")}>한자별곡</button><span>선생님 관리소</span><button onClick={() => { if (auth && user) signOut(auth); setScreen("landing"); }}>나가기</button></header>
    {!previewClass ? <section className="panel class-create"><p className="eyebrow">학급 첫 설정</p><h2>새 학급 등록</h2><p className="muted">미리보기에서 만든 학급은 새로고침하면 사라져요. 실제 연결 후에는 선생님 계정에 저장됩니다.</p>
      <form onSubmit={async (e) => { e.preventDefault(); const form = new FormData(e.currentTarget); const draft = { name: String(form.get("name")), grade: String(form.get("grade")), code: String(form.get("code")).trim().toUpperCase() }; try { if (isFirebaseConfigured && user) { const created = await tokenFetch("/api/classes", { method: "POST", body: JSON.stringify(draft) }); const next = { ...created, students: [] }; setDashboardClasses([...dashboardClasses, next]); setPreviewClass(next); } else setPreviewClass(draft); } catch (error) { setNotice(error instanceof Error ? error.message : "학급 생성에 실패했습니다."); } }}>
        <label>학급 이름<input name="name" required placeholder="예: 햇살반"/></label>
        <label>학년<select name="grade" defaultValue="3"><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option><option value="4">4학년</option><option value="5">5학년</option><option value="6">6학년</option></select></label>
        <label>학급 코드<input name="code" required minLength={4} maxLength={12} placeholder="예: SUN2026"/></label>
        <button className="gold-button" type="submit">학급 만들고 대시보드 보기</button>
      </form>
    </section> : <section className="teacher-dashboard">
      <aside className="teacher-sidebar"><p className="eyebrow">내 학급</p>{dashboardClasses.length ? dashboardClasses.map((item) => <button key={item.id} className={`class-tab ${item.id === (previewClass as DashboardClass).id ? "active" : ""}`} onClick={() => setPreviewClass(item)}><b>{item.name}</b><small>{item.grade}학년 · 학생 {item.students.length}명</small></button>) : <button className="class-tab active"><b>{previewClass.name}</b><small>{previewClass.grade}학년 · 학생 0명</small></button>}<button className="paper-button" onClick={() => setPreviewClass(null)}>＋ 다른 학급 만들기</button></aside>
      <div className="dashboard-main"><div className="dashboard-title"><div><p className="eyebrow">{previewClass.grade}학년</p><h2>{previewClass.name}</h2></div><div className="class-code"><small>학생 참여 코드</small><strong>{previewClass.code}</strong></div></div>
        <div className="stat-grid"><article><span>👥</span><b>{(previewClass as DashboardClass).students?.length ?? 0}명</b><small>등록 학생</small></article><article><span>✍️</span><b>{Math.round(((previewClass as DashboardClass).students ?? []).reduce((sum,s)=>sum+s.completed,0)/Math.max(1,(previewClass as DashboardClass).students?.length ?? 0))}자</b><small>평균 완료</small></article><article><span>🏰</span><b>{Math.max(1,...((previewClass as DashboardClass).students ?? []).map(s=>s.currentChapter))}장</b><small>현재 왕국</small></article><article><span>🔐</span><b>UID</b><small>권한 보호</small></article></div>
        <section className="roster-panel"><div><h3>학생 학습 현황</h3><button className="paper-button" onClick={() => { const rows = (previewClass as DashboardClass).students ?? []; const csv = ["학생,완료한자,현재장,최근학습",...rows.map(s=>[s.nickname,s.completed,s.currentChapter,s.updatedAt].map(v=>`"${String(v).replaceAll('"','""')}"`).join(","))].join("\r\n"); const link=document.createElement("a");link.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));link.download=`${previewClass.name}-학습현황.csv`;link.click();URL.revokeObjectURL(link.href); }}>CSV 내려받기</button></div>{(previewClass as DashboardClass).students?.length ? <div className="student-table">{(previewClass as DashboardClass).students.map(s=><div key={s.uid}><b>{s.nickname}</b><span>{s.completed}/50자</span><span>{s.currentChapter}장</span><small>{s.updatedAt ? new Date(s.updatedAt).toLocaleString("ko-KR") : "기록 없음"}</small></div>)}</div> : <div className="empty-roster"><span>🪶</span><b>아직 참여한 학생이 없어요.</b><p>학생이 학급 코드 <strong>{previewClass.code}</strong>로 가입하면 이곳에 실제 학습 진도와 필기 결과가 나타납니다.</p></div>}</section>
      </div>
    </section>}
  </main>;
  if (screen === "levels") return <main className="level-screen">
    <header className="topbar"><button onClick={() => setScreen("landing")}>한자별곡</button><span>한자 학습</span><button onClick={async () => { if (auth) await signOut(auth); setUser(null); setProgress(emptyProgress); setScreen("landing"); }}>로그아웃</button></header>
    <section className="level-select">
      <div className="level-heading"><p className="eyebrow">배울 급수를 골라요</p><h2>한자 왕국으로 떠나볼까요?</h2><p>8급 왕국부터 차근차근 완성하면 다음 왕국이 열립니다.</p></div>
      <div className="level-cards">
        <button className="level-card available" onClick={() => { setMapPan({ x: 0, y: 0 }); setMapZoom(1); setScreen("map"); }}><small>첫 번째 왕국</small><strong>8급</strong><span>50자 · 입장 가능</span><b>왕국 입장 →</b></button>
        <button className="level-card locked" disabled><small>두 번째 왕국</small><strong>7급</strong><span>150자</span><b>🔒 준비 중</b></button>
        <button className="level-card locked" disabled><small>세 번째 왕국</small><strong>6급</strong><span>150자</span><b>🔒 준비 중</b></button>
      </div>
    </section>
  </main>;
  if (screen === "study") return <main className="study-screen"><header className="topbar"><button onClick={() => setScreen("map")}>← 왕국 지도</button><span>{chapter.name}</span><b>{charIndex + 1} / {chapter.hanja.length}</b></header><section className="lesson-grid">
    <aside className="lesson-scroll"><p className="eyebrow">받아쓰기 임무</p><div className="hanja-heading"><strong>{current.char}</strong><div><small>훈과 음</small><h2>{current.meaning} {current.sound}</h2></div></div><p>{current.hint}</p><div className="target-info"><span>총 {current.strokes}획</span><span>{progress.completed.includes(current.char) ? "✓ 통과" : "미완료"}</span></div><p className="instruction">먼저 회색 본보기를 따라 쓰고, 통과하면 본보기 없이 혼자 써 보세요.</p></aside>
    <WritingBoard key={current.char} char={current.char} onPass={() => complete(current.char)} />
    <nav className="char-list">{chapter.hanja.map((h, i) => <button key={h.char} className={`${i === charIndex ? "selected" : ""} ${progress.completed.includes(h.char) ? "done" : ""}`} onClick={() => setCharIndex(i)}>{h.char}<small>{h.meaning}</small></button>)}</nav>
  </section><footer className="lesson-footer"><button className="paper-button" disabled={charIndex === 0} onClick={() => setCharIndex(charIndex - 1)}>이전 글자</button><button className="gold-button" disabled={!progress.completed.includes(current.char)} onClick={() => charIndex < chapter.hanja.length - 1 ? setCharIndex(charIndex + 1) : setScreen("map")}>{charIndex < chapter.hanja.length - 1 ? "다음 글자" : "지도에서 확인"}</button></footer></main>;
  const minimumMapZoom = () => 1;
  const clampMapPan = (pan: { x: number; y: number }, zoom: number) => {
    const rect = mapStageRef.current?.getBoundingClientRect();
    if (!rect || zoom <= 1) return { x: 0, y: 0 };
    const origin = mapNodes[progress.currentChapter - 1];
    const minX = -(zoom - 1) * rect.width * (origin.x / 100);
    const maxX = (zoom - 1) * rect.width * (1 - origin.x / 100);
    const minY = -(zoom - 1) * rect.height * (origin.y / 100);
    const maxY = (zoom - 1) * rect.height * (1 - origin.y / 100);
    return {
      x: Math.min(maxX, Math.max(minX, pan.x)),
      y: Math.min(maxY, Math.max(minY, pan.y)),
    };
  };
  const changeMapZoom = (zoom: number) => {
    const next = Math.min(2.2, Math.max(minimumMapZoom(), zoom));
    setMapZoom(next);
    setMapPan((pan) => clampMapPan(pan, next));
  };
  const showWholeMap = () => { setMapPan({ x: 0, y: 0 }); setMapZoom(1); };
  return <main className="map-screen"><header className="topbar"><button onClick={() => setScreen("levels")}>← 급수 선택</button><span>8급 안개 왕국</span><div className="topbar-account"><b>{progress.completed.length} / {allHanja.length}자</b><button onClick={async () => { if (auth) await signOut(auth); setUser(null); setProgress(emptyProgress); setScreen("landing"); }}>로그아웃</button></div></header>
    <section ref={mapStageRef} className="map-stage"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        mapPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (mapPointers.current.size === 2) {
          const [a, b] = [...mapPointers.current.values()];
          pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: mapZoom };
          dragStart.current = null;
        } else dragStart.current = { x: e.clientX, y: e.clientY, panX: mapPan.x, panY: mapPan.y };
      }}
      onPointerMove={(e) => {
        if (!mapPointers.current.has(e.pointerId)) return;
        mapPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (mapPointers.current.size === 2 && pinchStart.current) {
          const [a, b] = [...mapPointers.current.values()];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          changeMapZoom(pinchStart.current.zoom * distance / pinchStart.current.distance);
        } else if (dragStart.current) setMapPan(clampMapPan({ x: dragStart.current.panX + e.clientX - dragStart.current.x, y: dragStart.current.panY + e.clientY - dragStart.current.y }, mapZoom));
      }}
      onPointerUp={(e) => { mapPointers.current.delete(e.pointerId); dragStart.current = null; pinchStart.current = null; }}
      onPointerCancel={(e) => { mapPointers.current.delete(e.pointerId); dragStart.current = null; pinchStart.current = null; }}
      onWheel={(e) => changeMapZoom(mapZoom - e.deltaY * .001)}>
      <div className="world-map" style={{ transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`, transformOrigin: `${mapNodes[progress.currentChapter - 1].x}% ${mapNodes[progress.currentChapter - 1].y}%` }}>
        <img src="/kingdom-map-ruined.png" alt="검은 안개에 잠긴 픽셀 아트 왕국 지도"/>
        <div className="kingdom-fog" style={{ opacity: Math.max(.16, .62 - progress.currentChapter * .055) }}/>
        {chapters.map((c, index) => {
          const node = mapNodes[index];
          const learned = c.hanja.filter((h) => progress.completed.includes(h.char)).length;
          const ratio = learned / c.hanja.length;
          if (ratio === 0) return null;
          const radius = ratio >= 1 ? 18 : 5 + ratio * 13;
          const mask = `radial-gradient(circle ${radius}vw at ${node.x}% ${node.y}%, #000 0 62%, rgba(0,0,0,.9) 72%, transparent 100%)`;
          return <div key={`restored-${c.id}`} className={`restored-region ${ratio >= 1 ? "complete" : ""}`}
            style={{ WebkitMaskImage: mask, maskImage: mask, opacity: .42 + ratio * .58 }} aria-hidden="true"/>;
        })}
        {chapters.map((c, index) => {
          const node = mapNodes[index]; const locked = c.id > progress.currentChapter;
          const done = c.hanja.every((h) => progress.completed.includes(h.char));
          const currentNode = c.id === progress.currentChapter && !done;
          return <button key={c.id} disabled={locked} aria-label={`${c.place} ${locked ? "잠김" : "입장"}`}
            className={`map-node ${locked ? "locked" : ""} ${done ? "complete" : ""} ${currentNode ? "current" : ""}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => openChapter(c.id)}>
            <span className="node-icon">{locked ? "🔒" : done ? "★" : node.icon}</span>
            <span className="node-label"><b>{c.place}</b><small>{locked ? "안개에 잠김" : `${c.hanja.filter((h) => progress.completed.includes(h.char)).length}/${c.hanja.length}자`}</small></span>
          </button>;
        })}
      </div>
      <div className="map-quest"><small>현재 임무</small><b>{chapters[progress.currentChapter - 1].place}</b><span>{chapters[progress.currentChapter - 1].description}</span></div>
      <div className="map-controls" aria-label="지도 확대 축소">
        <button onClick={() => changeMapZoom(mapZoom + .2)} aria-label="확대">＋</button>
        <input aria-label="지도 확대 비율" type="range" min="1" max="2.2" step=".05" value={mapZoom} onChange={(e) => changeMapZoom(Number(e.target.value))}/>
        <button onClick={() => changeMapZoom(mapZoom - .2)} aria-label="축소">−</button>
        <button className="control-text" onClick={showWholeMap}>전체</button>
      </div>
      {mapZoom !== 1 && <div className="drag-guide">드래그로 이동 · 두 손가락으로 확대/축소</div>}
    </section><div className="map-bottom"><p>{progress.currentChapter === 8 && progress.completed.length === 50 ? "왕국의 모든 안개가 걷혔어요!" : "불빛이 켜진 장소를 눌러 안개 속으로 들어가세요."}</p><button className="gold-button" onClick={() => openChapter(progress.currentChapter)}>현재 거점 입장</button></div></main>;
}
