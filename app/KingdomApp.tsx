"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { chapters, allHanja } from "@/data/hanja";
import { expectedStrokes, judgeWriting, type Point } from "@/lib/handwriting";

type Screen = "landing" | "login" | "map" | "study" | "teacher";
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
  const [hint, setHint] = useState(0);
  const [result, setResult] = useState<{ score: number; message: string; passed: boolean } | null>(null);
  const size = 360;
  const paint = (extra?: Point[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = "#d6c7a9"; ctx.lineWidth = 1; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke(); ctx.setLineDash([]);
    if (hint > 0) {
      const expected = expectedStrokes(char, size);
      ctx.strokeStyle = hint === 2 ? "rgba(37,67,51,.24)" : "rgba(37,67,51,.12)"; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.lineJoin = "round";
      expected.forEach((points, i) => {
        if (hint === 1) { ctx.fillStyle = "#d1603d"; ctx.beginPath(); ctx.arc(points[0].x, points[0].y, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#533c29"; ctx.font = "bold 12px monospace"; ctx.fillText(String(i + 1), points[0].x + 8, points[0].y); return; }
        ctx.beginPath(); points.forEach((p, n) => n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
      });
    }
    ctx.strokeStyle = "#231d18"; ctx.lineWidth = 13; ctx.lineCap = "round"; ctx.lineJoin = "round";
    [...strokes, ...(extra?.length ? [extra] : [])].forEach((points) => { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); });
  };
  useEffect(() => paint(active ?? undefined));
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * size, y: ((event.clientY - rect.top) / rect.height) * size };
  };
  return <div className="writing-wrap">
    <div className="canvas-frame">
      <canvas ref={canvasRef} width={size} height={size}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setActive([point(e)]); setResult(null); }}
        onPointerMove={(e) => active && setActive([...active, point(e)])}
        onPointerUp={() => { if (active?.length) setStrokes([...strokes, active]); setActive(null); }} />
    </div>
    <div className="writing-actions">
      <button className="paper-button" onClick={() => { setStrokes(strokes.slice(0, -1)); setResult(null); }}>한 획 되돌리기</button>
      <button className="paper-button" onClick={() => { setStrokes([]); setResult(null); }}>모두 지우기</button>
      <button className="paper-button" onClick={() => setHint((hint + 1) % 3)}>도움 {hint === 0 ? "보기" : hint === 1 ? "더 보기" : "끄기"}</button>
      <button className="gold-button" onClick={() => { const judged = judgeWriting(char, strokes, size); setResult(judged); if (judged.passed) onPass(judged.score); }}>글씨 확인</button>
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
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [previewClass, setPreviewClass] = useState<PreviewClass | null>(null);
  const [dashboardClasses, setDashboardClasses] = useState<DashboardClass[]>([]);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  useEffect(() => auth ? onAuthStateChanged(auth, async (next) => {
    setUser(next);
    if (next && next.isAnonymous && db) { const snap = await getDoc(doc(db, "studentProgress", next.uid)); if (snap.exists()) { setProgress(snap.data() as Progress); setScreen("map"); } }
  }) : undefined, []);
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
      const credential = auth.currentUser?.isAnonymous ? { user: auth.currentUser } : await signInAnonymously(auth);
      await tokenFetch("/api/student/join", { method: "POST", body: JSON.stringify({ classCode: form.get("classCode"), nickname: form.get("nickname") }) });
      setUser(credential.user); setProgress(emptyProgress); setScreen("map");
    } catch (error) { setNotice(error instanceof Error ? error.message : "학생 입장에 실패했습니다."); }
  };
  const teacherLogin = async () => {
    if (!auth) { setScreen("teacher"); return; }
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
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
      <div className="hero-actions"><button className="gold-button big" onClick={() => setScreen("login")}>모험 시작</button><button className="paper-button big" onClick={() => { setProgress(emptyProgress); setScreen("map"); }}>체험하기</button></div>
      {!isFirebaseConfigured && <small className="dev-badge">현재 체험 모드 · 저장/로그인은 Firebase 연결 후 활성화</small>}
    </div></main>;
  if (screen === "login") return <main className="auth-screen"><section className="panel auth-card"><button className="back" onClick={() => setScreen("landing")}>← 돌아가기</button><h2>왕국 입장소</h2>
    <div className="tabs"><button className={authMode === "student" ? "active" : ""} onClick={() => setAuthMode("student")}>학생</button><button className={authMode === "teacher" ? "active" : ""} onClick={() => setAuthMode("teacher")}>선생님</button></div>
    <p className="muted">{!isFirebaseConfigured ? "로컬 체험 모드입니다. Firebase 연결 후 기록이 안전하게 저장돼요." : authMode === "student" ? "이메일 없이 익명 학생 계정으로 입장해요. 학급 코드는 학급을 찾는 용도로만 사용됩니다." : "학교에서 허용한 Google 계정으로만 로그인할 수 있어요."}</p>
    {authMode === "student" ? <form action={studentJoin}><label>학생 이름<input name="nickname" required maxLength={20} placeholder="예: 김하늘"/></label><label>학급 코드<input name="classCode" required minLength={4} maxLength={12} placeholder="선생님이 알려준 코드"/></label><button className="gold-button" type="submit">{isFirebaseConfigured ? "익명 계정으로 모험 시작" : "저장 없이 체험 시작"}</button></form>
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
  if (screen === "study") return <main className="study-screen"><header className="topbar"><button onClick={() => setScreen("map")}>← 왕국 지도</button><span>{chapter.name}</span><b>{charIndex + 1} / {chapter.hanja.length}</b></header><section className="lesson-grid">
    <aside className="lesson-scroll"><p className="eyebrow">받아쓰기 임무</p><h2>{current.meaning} {current.sound}</h2><p>{current.hint}</p><div className="target-info"><span>총 {current.strokes}획</span><span>{progress.completed.includes(current.char) ? "✓ 통과" : "미완료"}</span></div><p className="instruction">빈 칸에 획순대로 써 보세요. ‘글씨 확인’은 획 수, 순서, 방향과 전체 모양을 함께 살펴봅니다.</p></aside>
    <WritingBoard key={current.char} char={current.char} onPass={() => complete(current.char)} />
    <nav className="char-list">{chapter.hanja.map((h, i) => <button key={h.char} className={`${i === charIndex ? "selected" : ""} ${progress.completed.includes(h.char) ? "done" : ""}`} onClick={() => setCharIndex(i)}>{h.char}<small>{h.meaning}</small></button>)}</nav>
  </section><footer className="lesson-footer"><button className="paper-button" disabled={charIndex === 0} onClick={() => setCharIndex(charIndex - 1)}>이전 글자</button><button className="gold-button" disabled={!progress.completed.includes(current.char)} onClick={() => charIndex < chapter.hanja.length - 1 ? setCharIndex(charIndex + 1) : setScreen("map")}>{charIndex < chapter.hanja.length - 1 ? "다음 글자" : "지도에서 확인"}</button></footer></main>;
  const focusCurrentNode = () => {
    setMapPan({ x: 0, y: 0 });
    setMapZoom(1.55);
  };
  const showWholeMap = () => { setMapPan({ x: 0, y: 0 }); setMapZoom(1); };
  return <main className="map-screen"><header className="topbar"><button onClick={() => setScreen("landing")}>한자별곡</button><span>안개 왕국 지도</span><b>{progress.completed.length} / {allHanja.length}자</b></header>
    <section className="map-stage"
      onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; e.currentTarget.setPointerCapture(e.pointerId); dragStart.current = { x: e.clientX, y: e.clientY, panX: mapPan.x, panY: mapPan.y }; }}
      onPointerMove={(e) => { if (!dragStart.current) return; setMapPan({ x: dragStart.current.panX + e.clientX - dragStart.current.x, y: dragStart.current.panY + e.clientY - dragStart.current.y }); }}
      onPointerUp={() => { dragStart.current = null; }} onPointerCancel={() => { dragStart.current = null; }}
      onWheel={(e) => { const next = Math.min(2.2, Math.max(1, mapZoom - e.deltaY * .001)); setMapZoom(next); if (next === 1) setMapPan({ x: 0, y: 0 }); }}>
      <div className="world-map" style={{ transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`, transformOrigin: `${mapNodes[progress.currentChapter - 1].x}% ${mapNodes[progress.currentChapter - 1].y}%` }}>
        <img src="/kingdom-map-pixel-concept.png" alt="픽셀 아트 안개 왕국 지도"/>
        <div className="kingdom-fog" style={{ opacity: Math.max(.08, .88 - progress.currentChapter * .1) }}/>
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
        <button onClick={() => setMapZoom(Math.min(2.2, mapZoom + .2))} aria-label="확대">＋</button>
        <button onClick={() => { const next = Math.max(1, mapZoom - .2); setMapZoom(next); if (next === 1) setMapPan({x:0,y:0}); }} aria-label="축소">−</button>
        <button className="control-text" onClick={showWholeMap}>전체</button>
        <button className="control-text" onClick={focusCurrentNode}>현재 거점</button>
      </div>
      {mapZoom > 1 && <div className="drag-guide">지도를 드래그해서 이동 · 휠로 확대/축소</div>}
    </section><div className="map-bottom"><p>{progress.currentChapter === 8 && progress.completed.length === 50 ? "왕국의 모든 안개가 걷혔어요!" : "불빛이 켜진 장소를 눌러 안개 속으로 들어가세요."}</p><button className="gold-button" onClick={() => openChapter(progress.currentChapter)}>현재 거점 입장</button></div></main>;
}
