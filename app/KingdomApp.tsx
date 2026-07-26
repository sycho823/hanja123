"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, Brush, Castle, Check, ChevronRight, ClipboardList,
  Compass, Copy, Eraser, GraduationCap, HelpCircle, Home, Leaf, LockKeyhole,
  LogOut, Map, Play, RotateCcw, ScrollText, Settings, Sparkles, Star, Trophy,
  UserRound, UsersRound, X, Zap
} from "lucide-react";
import { allHanja, chapters, Hanja, quizFor } from "../data/hanja";
import { isFirebaseConfigured } from "../lib/firebase";

type Screen = "title" | "studentGate" | "studentAuth" | "teacherAuth" | "teacherCreate" |
  "map" | "grades" | "learn" | "write" | "quiz" | "complete" | "book" | "review" |
  "teacher" | "studentDetail" | "records";

type TeacherClass = { name: string; grade: string; code: string };
type StudentRow = { no: number; id: string; learned: number; chapter: string; quiz: number; writing: number; last: string; status: string };

const demoStudents = [
  { no: 3, id: "구름붓", learned: 17, chapter: "자연의 숲", quiz: 88, writing: 82, last: "오늘", status: "순조로움" },
  { no: 7, id: "푸른먹", learned: 14, chapter: "자연의 숲", quiz: 69, writing: 76, last: "오늘", status: "복습 필요" },
  { no: 11, id: "달빛책사", learned: 9, chapter: "수의 들판", quiz: 91, writing: 58, last: "2일 전", status: "쓰기 연습 필요" },
  { no: 15, id: "산들바람", learned: 5, chapter: "수의 들판", quiz: 80, writing: 75, last: "9일 전", status: "장기 미접속" },
];

function IconButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return <button className="icon-button" onClick={onClick}>{icon}<span>{label}</span></button>;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><div className="scroll-modal" onClick={(e) => e.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="닫기"><X /></button>{children}
  </div></div>;
}

export default function KingdomApp() {
  const [screen, setScreen] = useState<Screen>("title");
  const [previous, setPrevious] = useState<Screen>("title");
  const [modal, setModal] = useState<string | null>(null);
  const [chapter, setChapter] = useState(chapters[1]);
  const [hanja, setHanja] = useState<Hanja>(chapters[1].hanja[0]);
  const [learnStep, setLearnStep] = useState(0);
  const [found, setFound] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [classCode, setClassCode] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "join">("login");
  const [bookTab, setBookTab] = useState(0);
  const [teacherClass, setTeacherClass] = useState<TeacherClass | null>(null);
  const [teacherStudents, setTeacherStudents] = useState<StudentRow[]>([]);
  const [teacherDemo, setTeacherDemo] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const go = (next: Screen) => { setPrevious(screen); setScreen(next); window.scrollTo(0, 0); };
  const back = () => setScreen(previous);

  if (screen === "title") return <TitleScreen onStudent={() => go("studentGate")} onTeacher={() => go("teacherAuth")} />;
  if (screen === "studentGate") return <GateScreen code={classCode} setCode={setClassCode} onBack={back} onNext={() => go("studentAuth")} />;
  if (screen === "studentAuth") return <StudentAuth mode={authMode} setMode={setAuthMode} onBack={back} onEnter={() => go("map")} />;
  if (screen === "teacherAuth") return <TeacherAuth onBack={back} onEnter={() => teacherClass ? go("teacher") : go("teacherCreate")} onCreate={() => go("teacherCreate")} onDemo={() => {
    setTeacherDemo(true);
    setTeacherClass({ name: "햇살초등학교 3학년 2반", grade: "3학년", code: "DEMO88" });
    setTeacherStudents(demoStudents);
    go("teacher");
  }} />;
  if (screen === "teacherCreate") return <TeacherCreate onBack={back} onDone={(newClass) => {
    setTeacherDemo(false);
    setTeacherClass(newClass);
    setTeacherStudents([]);
    setSelectedStudent(null);
    go("teacher");
  }} />;
  if (screen === "teacher" || screen === "studentDetail") return <TeacherDashboard
    detail={screen === "studentDetail"}
    classInfo={teacherClass}
    students={teacherStudents}
    demo={teacherDemo}
    selectedStudent={selectedStudent}
    onBack={back}
    onDetail={(student) => { setSelectedStudent(student); go("studentDetail"); }}
    onNewClass={() => go("teacherCreate")}
    onHome={() => setScreen("title")}
  />;

  const studentShell = (content: React.ReactNode) => <div className="app-shell">
    <StudentHeader onSettings={() => setModal("settings")} onLogout={() => setScreen("title")} />
    {content}
    {modal && <Modal onClose={() => setModal(null)}>
      {modal === "locked" ? <><LockKeyhole className="modal-hero-icon" /><h2>새로운 한자 지역을 준비하고 있어요</h2><p>다음 업데이트에서 만날 수 있어요!</p><button className="seal-button" onClick={() => setModal(null)}>알겠어요</button></> :
      <><Settings className="modal-hero-icon" /><h2>모험 설정</h2><div className="setting-row"><span>배경 음악</span><button className="toggle">켜짐</button></div><div className="setting-row"><span>효과음</span><button className="toggle">켜짐</button></div><div className="setting-row"><span>움직임 줄이기</span><button className="toggle muted">꺼짐</button></div></>}
    </Modal>}
  </div>;

  if (screen === "map") return studentShell(<MapLobby onGrades={() => go("grades")} onBook={() => go("book")} onReview={() => go("review")} onRecords={() => go("records")} onLearn={(c) => { setChapter(c); setHanja(c.hanja[0]); setLearnStep(0); go("learn"); }} />);
  if (screen === "grades") return studentShell(<Grades onBack={() => setScreen("map")} onLocked={() => setModal("locked")} onEight={() => setScreen("map")} />);
  if (screen === "book") return studentShell(<HanjaBook tab={bookTab} setTab={setBookTab} onBack={() => setScreen("map")} onStudy={(h, c) => { setHanja(h); setChapter(c); setLearnStep(0); go("learn"); }} />);
  if (screen === "review") return studentShell(<Review onBack={() => setScreen("map")} onStart={() => { setHanja(chapters[0].hanja[2]); setChapter(chapters[0]); setQuizIndex(0); setAnswer(null); go("quiz"); }} />);
  if (screen === "records") return studentShell(<Records onBack={() => setScreen("map")} />);
  if (screen === "learn") return studentShell(<Learn h={hanja} chapter={chapter.name} step={learnStep} found={found} setFound={setFound} onBack={() => setScreen("map")} onNext={() => {
    if (learnStep < 1) setLearnStep(learnStep + 1); else go("write");
  }} />);
  if (screen === "write") return studentShell(<Writing h={hanja} onBack={() => setScreen("learn")} onDone={() => { setQuizIndex(0); setAnswer(null); go("quiz"); }} />);
  if (screen === "quiz") return studentShell(<Quiz h={hanja} index={quizIndex} answer={answer} setAnswer={setAnswer} onBack={() => setScreen("write")} onNext={() => {
    if (quizIndex < quizFor(hanja).length - 1) { setQuizIndex(quizIndex + 1); setAnswer(null); } else go("complete");
  }} />);
  return studentShell(<Complete h={hanja} onMap={() => setScreen("map")} onReview={() => setScreen("review")} />);
}

function TitleScreen({ onStudent, onTeacher }: { onStudent: () => void; onTeacher: () => void }) {
  return <main className="title-screen">
    <div className="sky-orb" /><div className="mountains mountain-back" /><div className="mountains mountain-front" />
    <div className="mist mist-one" /><div className="mist mist-two" />
    <div className="distant-castle"><span /><span /><span /></div>
    <div className="title-content">
      <div className="demo-badge">{isFirebaseConfigured ? "왕국 연결됨" : "체험 모드"}</div>
      <p className="eyebrow">초등 한자 8급 모험</p>
      <h1><span>한자별곡</span><small>漢字別曲</small></h1>
      <div className="title-divider"><i /><Brush /><i /></div>
      <p className="tagline">한자의 힘으로 잃어버린 왕국을 되찾아라!</p>
      <div className="title-actions">
        <button className="wood-button primary" onClick={onStudent}><UserRound /><b>학생으로 시작</b><small>안개 왕국으로 모험을 떠나요</small></button>
        <button className="wood-button teacher" onClick={onTeacher}><GraduationCap /><b>선생님으로 시작</b><small>우리 반의 모험을 살펴봐요</small></button>
      </div>
      <p className="title-note"><Sparkles /> 한 글자씩 배울 때마다 왕국에 빛이 돌아와요</p>
    </div>
  </main>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button className="back-button" onClick={onClick}><ArrowLeft /> 뒤로가기</button>;
}

function GateScreen({ code, setCode, onBack, onNext }: { code: string; setCode: (v: string) => void; onBack: () => void; onNext: () => void }) {
  return <main className="gate-screen"><BackButton onClick={onBack} /><div className="gate-towers" />
    <section className="paper-panel gate-panel"><Compass className="crest" /><p className="eyebrow">왕국 입장 허가서</p><h2>우리 반 왕국으로<br />들어가 볼까요?</h2><p>선생님께 받은 여섯 자리 학급 코드를 적어 주세요.</p>
      <label>학급 코드<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="예: HJ8A25" maxLength={6} /></label>
      <button className="ink-button" disabled={code.length < 4} onClick={onNext}>성문 열기 <ChevronRight /></button>
      <button className="text-button" onClick={() => { setCode("DEMO88"); onNext(); }}><Play /> 체험 왕국 바로 들어가기</button>
    </section>
  </main>;
}

function StudentAuth({ mode, setMode, onBack, onEnter }: { mode: "login" | "join"; setMode: (m: "login" | "join") => void; onBack: () => void; onEnter: () => void }) {
  return <main className="form-screen"><BackButton onClick={onBack} /><section className="paper-panel auth-panel">
    <div className="form-illustration"><div className="apprentice"><span className="head">한</span><span className="body" /></div><p>“모험 아이디를 알려줘!”</p></div>
    <div className="form-content"><div className="tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>다시 온 모험가</button><button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>처음 온 모험가</button></div>
      <h2>{mode === "login" ? "모험을 이어가요" : "새 모험가 등록"}</h2>
      {mode === "join" && <label>출석번호<input type="number" placeholder="예: 12" /></label>}
      <label>모험 아이디<input defaultValue={mode === "login" ? "구름붓" : ""} placeholder="내가 정한 멋진 이름" /></label>
      <label>비밀번호<input type="password" defaultValue={mode === "login" ? "demo1234" : ""} placeholder="나만 아는 비밀번호" /></label>
      <button className="ink-button" onClick={onEnter}>{mode === "login" ? "모험 이어가기" : "모험 시작하기"} <ChevronRight /></button>
      <p className="privacy-note"><LockKeyhole /> 실명과 이메일은 받지 않아요.</p>
    </div>
  </section></main>;
}

function TeacherAuth({ onBack, onEnter, onCreate, onDemo }: { onBack: () => void; onEnter: () => void; onCreate: () => void; onDemo: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return <main className="form-screen teacher-form"><BackButton onClick={onBack} /><section className="paper-panel narrow-panel">
    <div className="round-icon"><GraduationCap /></div><p className="eyebrow">왕국 관청</p><h2>선생님 로그인</h2>
    <label>이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="선생님 이메일" /></label>
    <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" /></label>
    <button className="ink-button" disabled={!email || !password} onClick={onEnter}>학급 살펴보기 <ChevronRight /></button>
    <button className="outline-button" onClick={onCreate}>새 선생님 계정 만들기</button>
    <button className="text-button teacher-demo-button" onClick={onDemo}><Play /> 예시 데이터로 교사 화면 체험</button>
    <p className="demo-copy">예시 데이터는 체험 버튼을 눌렀을 때만 표시돼요.</p>
  </section></main>;
}

function createClassCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function TeacherCreate({ onBack, onDone }: { onBack: () => void; onDone: (value: TeacherClass) => void }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("1학년");
  const [code, setCode] = useState(() => createClassCode());
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); } catch { /* clipboard may be unavailable in preview */ }
  };
  return <main className="form-screen teacher-form"><BackButton onClick={onBack} /><section className="paper-panel narrow-panel">
    <p className="eyebrow">새로운 왕국 만들기</p><h2>학급을 등록해요</h2>
    <label>학급 이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 햇살초 3학년 2반" /></label>
    <label>학년<select value={grade} onChange={(e) => setGrade(e.target.value)}><option>1학년</option><option>2학년</option><option>3학년</option><option>4학년</option><option>5학년</option><option>6학년</option></select></label>
    <label>학급 코드<input className="class-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} /></label>
    <div className="code-actions"><button className="outline-button" onClick={() => setCode(createClassCode())}><RotateCcw /> 새 코드 만들기</button><button className="outline-button" onClick={copyCode}><Copy /> 코드 복사</button></div>
    <p className="demo-copy">원하는 코드로 직접 바꾸거나 새 코드를 만들 수 있어요.</p>
    <button className="ink-button" disabled={!name.trim() || code.length < 4} onClick={() => onDone({ name: name.trim(), grade, code })}>학급 만들기 <Check /></button>
  </section></main>;
}

function StudentHeader({ onSettings, onLogout }: { onSettings: () => void; onLogout: () => void }) {
  return <header className="student-header">
    <div className="profile"><div className="avatar">漢</div><div><b>구름붓</b><span>12번 · 한자 수련생</span></div></div>
    <div className="progress-wrap"><div className="progress-copy"><span>왕국 복구</span><b>17 / 50</b></div><div className="progress-track"><i style={{ width: "34%" }} /></div><small>오늘도 안개가 걷히고 있어요!</small></div>
    <div className="header-actions"><span className="demo-badge">체험 모드</span><IconButton icon={<Settings />} label="설정" onClick={onSettings} /><IconButton icon={<LogOut />} label="나가기" onClick={onLogout} /></div>
  </header>;
}

function MapLobby({ onGrades, onBook, onReview, onRecords, onLearn }: { onGrades: () => void; onBook: () => void; onReview: () => void; onRecords: () => void; onLearn: (c: typeof chapters[number]) => void }) {
  const [selected, setSelected] = useState(1);
  return <main className="map-lobby">
    <div className="map-heading"><div><p className="eyebrow">안개 왕국 복구 지도</p><h2>한자의 빛을 되찾는 중</h2></div><button className="grade-chip" onClick={onGrades}>8급 모험 <ChevronRight /></button></div>
    <section className="kingdom-map">
      <div className="river" /><div className="road" />
      {chapters.map((c, index) => {
        const state = index === 0 ? "done" : index === 1 ? "current" : "locked";
        return <button key={c.id} className={`map-node node-${c.id} ${state} ${selected === c.id ? "selected" : ""}`} onClick={() => {
          setSelected(c.id); if (state === "locked") return; if (selected === c.id) onLearn(c);
        }}>
          <span className="landmark">{state === "locked" ? <LockKeyhole /> : index === 0 ? <Home /> : index === 1 ? <Leaf /> : index === 2 ? <Compass /> : <Castle />}</span>
          <b>{c.place}</b><small>{state === "done" ? "완료" : state === "current" ? "진행 중 · 6/8" : "안개 속"}</small>
        </button>;
      })}
      <div className="map-legend"><span><i className="done" /> 되찾은 지역</span><span><i className="current" /> 모험 가능</span><span><i className="locked" /> 안개 지역</span></div>
      <aside className="map-card">
        <span className="chapter-number">제 {selected} 장</span><h3>{chapters[selected - 1].place}</h3><p>{chapters[selected - 1].description}</p>
        <div className="hanja-preview">{chapters[selected - 1].hanja.map((h) => <span key={h.char}>{h.char}</span>)}</div>
        {selected <= 2 ? <button className="ink-button" onClick={() => onLearn(chapters[selected - 1])}>{selected === 1 ? "다시 둘러보기" : "이어서 학습"} <ChevronRight /></button> : <p className="locked-copy"><LockKeyhole /> 앞 지역을 먼저 되찾아 주세요.</p>}
      </aside>
    </section>
    <nav className="bottom-nav">
      <button className="active"><Map /><span>왕국 지도</span></button><button onClick={() => onLearn(chapters[1])}><BookOpen /><span>이어서 학습</span></button>
      <button onClick={onBook}><ScrollText /><span>한자 도감</span></button><button onClick={onReview}><RotateCcw /><span>복습 훈련</span><i>3</i></button>
      <button onClick={onRecords}><ClipboardList /><span>나의 기록</span></button>
    </nav>
  </main>;
}

function Grades({ onBack, onLocked, onEight }: { onBack: () => void; onLocked: () => void; onEight: () => void }) {
  return <main className="content-page"><BackButton onClick={onBack} /><div className="page-title"><p className="eyebrow">모험 지역 선택</p><h2>어느 급수로 떠날까요?</h2><p>8급 왕국부터 차근차근 빛을 되찾아 봐요.</p></div>
    <div className="grade-grid">{["8급", "7급", "6급", "5급", "4급 이하"].map((grade, index) => <button key={grade} className={`grade-card ${index === 0 ? "available" : "locked"}`} onClick={index === 0 ? onEight : onLocked}>
      <span>{index === 0 ? <Sparkles /> : <LockKeyhole />}</span><b>{grade}</b><small>{index === 0 ? "50자 · 모험 가능" : "아직 안개 속이에요"}</small>
    </button>)}</div>
  </main>;
}

function Learn({ h, chapter, step, found, setFound, onBack, onNext }: { h: Hanja; chapter: string; step: number; found: boolean; setFound: (v: boolean) => void; onBack: () => void; onNext: () => void }) {
  return <main className="activity-page"><BackButton onClick={onBack} /><div className="activity-top"><div><span>{chapter}</span><b>{step + 1} / 4 단계</b></div><div className="step-dots"><i className="active" /><i className={step > 0 ? "active" : ""} /><i /><i /></div></div>
    {step === 0 ? <section className="find-scene">
      <div className="scene-sun" /><div className="scene-hills" /><div className="scene-pond" /><div className="scene-tree target" onClick={() => setFound(true)}><i /><i /><i /></div>
      <div className="activity-prompt"><p className="eyebrow">그림 속 한자 찾기</p><h2>‘{h.meaning}’을 찾아 눌러 보세요</h2><p>{found ? "잘했어! 한자의 힘을 찾았어." : "그림을 천천히 살펴보면 금세 찾을 수 있어요."}</p></div>
      {found && <div className="found-hanja"><Sparkles /><b>{h.char}</b><span>{h.meaning} {h.sound}</span></div>}
      <div className="guide-bubble"><span className="mini-guide">漢</span><p>{found ? "안개가 조금 걷혔어!" : "빛나는 곳을 잘 살펴봐!"}</p></div>
      <button className="ink-button activity-next" disabled={!found} onClick={onNext}>다음 단계 <ChevronRight /></button>
    </section> : <section className="transform-panel"><p className="eyebrow">그림에서 한자로</p><h2>모양이 어떻게 변했을까요?</h2><div className="transform-steps"><div><span className="tree-symbol">♧</span><small>나무의 모습</small></div><ChevronRight /><div><span className="line-symbol">十</span><small>가지와 줄기</small></div><ChevronRight /><div className="final"><span>{h.char}</span><small>{h.meaning} {h.sound}</small></div></div><p className="hint-copy">{h.hint}</p>
      {!h.detailed && <p className="content-note"><HelpCircle /> 이 글자는 그림보다 뜻과 낱말을 연결해 배워요.</p>}
      <button className="ink-button" onClick={onNext}>따라 쓰러 가기 <Brush /></button></section>}
  </main>;
}

function Writing({ h, onBack, onDone }: { h: Hanja; onBack: () => void; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const [message, setMessage] = useState("붉은 시작점에서 천천히 그어 보세요.");
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!; const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = point(e); const ctx = canvasRef.current!.getContext("2d")!; ctx.beginPath(); ctx.moveTo(p.x, p.y); setDrawing(true); canvasRef.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return; const p = point(e); const ctx = canvasRef.current!.getContext("2d")!; ctx.lineWidth = 18; ctx.lineCap = "round"; ctx.strokeStyle = "#263832"; ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const clear = () => { const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setMessage("다시 시작해 볼까요? 시작점을 살펴봐요."); };
  return <main className="activity-page writing-page"><BackButton onClick={onBack} /><div className="activity-top"><div><span>따라 쓰기</span><b>{attempt} / 3 연습</b></div><div className="step-dots"><i className="active" /><i className={attempt > 1 ? "active" : ""} /><i className={attempt > 2 ? "active" : ""} /></div></div>
    <section className="writing-layout"><div className="writing-info"><p className="eyebrow">획순 연습</p><h2>{h.char}</h2><h3>{h.meaning} {h.sound}</h3><p>총 {h.strokes}획</p><div className="stroke-list">{Array.from({ length: Math.min(h.strokes, 6) }, (_, i) => <span className={i === 0 ? "active" : ""} key={i}>{i + 1}</span>)}</div></div>
      <div className="canvas-wrap"><div className="guide-char">{h.char}</div><div className="crosshair horizontal" /><div className="crosshair vertical" /><span className="start-dot">1</span>
        <canvas ref={canvasRef} width={520} height={520} onPointerDown={start} onPointerMove={move} onPointerUp={() => setDrawing(false)} onPointerCancel={() => setDrawing(false)} />
      </div>
      <aside className="writing-tools"><div className="guide-bubble static"><span className="mini-guide">漢</span><p>{message}</p></div>
        <button className="outline-button" onClick={clear}><Eraser /> 모두 지우기</button><button className="outline-button" onClick={() => { clear(); setAttempt(Math.min(3, attempt + 1)); }}><RotateCcw /> 다시 쓰기</button>
        <button className="ink-button" onClick={() => { if (attempt < 3) { setAttempt(attempt + 1); clear(); setMessage(attempt === 1 ? "좋아요! 이번엔 흐린 글자를 보고 써요." : "멋져요! 이제 혼자 써 볼까요?"); } else onDone(); }}>{attempt < 3 ? "연습 통과" : "쓰기 완료"} <Check /></button>
      </aside></section>
  </main>;
}

function Quiz({ h, index, answer, setAnswer, onBack, onNext }: { h: Hanja; index: number; answer: string | null; setAnswer: (v: string) => void; onBack: () => void; onNext: () => void }) {
  const quiz = quizFor(h); const q = quiz[index]; const correct = answer === q.answer;
  return <main className="activity-page quiz-page"><BackButton onClick={onBack} /><div className="mission-title"><span>왕국 복구 임무</span><b>{index + 1} / {quiz.length}</b></div>
    <section className="quiz-scroll"><p className="eyebrow">한자의 힘을 확인해요</p><h2>{q.question}</h2><div className="choice-grid">{q.choices.map((choice) => <button key={choice} className={answer === choice ? (choice === q.answer ? "correct" : "wrong") : answer && choice === q.answer ? "correct reveal" : ""} onClick={() => !answer && setAnswer(choice)}>
      <span>{choice}</span>{answer === choice && (correct ? <Check /> : <X />)}</button>)}</div>
      {answer && <div className={`feedback ${correct ? "good" : "try"}`}><span className="mini-guide">{correct ? "✓" : "漢"}</span><div><b>{correct ? "정확해요! 안개가 걷히고 있어요." : "조금 아쉬워요. 다시 살펴볼까요?"}</b><p>{h.char}는 ‘{h.meaning} {h.sound}’예요. {h.hint}</p></div></div>}
      <button className="ink-button" disabled={!answer} onClick={onNext}>{index === quiz.length - 1 ? "임무 마치기" : "다음 문제"} <ChevronRight /></button>
    </section>
  </main>;
}

function Complete({ h, onMap, onReview }: { h: Hanja; onMap: () => void; onReview: () => void }) {
  return <main className="complete-page"><div className="rays" /><div className="complete-card"><div className="seal-mark">완료</div><p className="eyebrow">한자의 빛을 되찾았어요</p><h2>{h.char}</h2><h3>{h.meaning} {h.sound}</h3><p>검은 안개가 한 걸음 물러났어요.<br />왕국의 숲에 따뜻한 빛이 돌아옵니다.</p><div className="reward-row"><div><Star /><b>퀴즈 2/2</b><span>정답</span></div><div><Brush /><b>3회</b><span>쓰기 완료</span></div><div><Sparkles /><b>+1</b><span>빛의 조각</span></div></div>
    <div className="complete-actions"><button className="ink-button" onClick={onMap}><Map /> 왕국으로 돌아가기</button><button className="outline-button" onClick={onReview}><RotateCcw /> 복습하기</button></div></div>
  </main>;
}

function HanjaBook({ tab, setTab, onBack, onStudy }: { tab: number; setTab: (n: number) => void; onBack: () => void; onStudy: (h: Hanja, c: typeof chapters[number]) => void }) {
  const current = chapters[tab];
  return <main className="content-page book-page"><BackButton onClick={onBack} /><div className="page-title"><p className="eyebrow">왕국의 지혜가 모이는 곳</p><h2>한자 도감</h2><p>배운 한자를 눌러 다시 살펴보세요.</p></div>
    <div className="book-tabs">{chapters.map((c, i) => <button className={tab === i ? "active" : ""} key={c.id} onClick={() => setTab(i)}>{c.shortName}</button>)}</div>
    <section className="open-book"><div className="book-chapter"><span>{current.name}</span><b>{tab === 0 ? "11/11" : tab === 1 ? "6/8" : `0/${current.hanja.length}`}</b></div><div className="hanja-grid">{current.hanja.map((h, index) => {
      const learned = tab === 0 || (tab === 1 && index < 6); return <button key={h.char} className={learned ? "learned" : "unknown"} onClick={() => learned && onStudy(h, current)}>
        <span>{learned ? h.char : "?"}</span><b>{learned ? `${h.meaning} ${h.sound}` : "안개 속"}</b><small>{learned ? `${h.strokes}획 · ${index % 3 === 0 ? "복습 필요" : "학습 완료"}` : "아직 만나지 못했어요"}</small>
      </button>; })}</div></section>
  </main>;
}

function Review({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const items = [
    [RotateCcw, "오늘의 복습", "오늘 잊기 쉬운 3글자를 다시 만나요", "3"],
    [Zap, "자주 틀린 한자", "三 · 水 · 山을 천천히 살펴봐요", "3"],
    [Brush, "쓰기 다시 연습", "획순이 어려웠던 글자를 연습해요", "2"],
    [BookOpen, "단원 종합 문제", "수의 들판을 한 번에 복습해요", "열림"],
    [Trophy, "8급 모의시험", "50자를 모두 배운 뒤 도전할 수 있어요", "잠금"],
  ] as const;
  return <main className="content-page review-page"><BackButton onClick={onBack} /><div className="page-title"><p className="eyebrow">배움의 서당</p><h2>복습 훈련소</h2><p>조금 헷갈렸던 글자도 다시 보면 내 것이 돼요.</p></div>
    <div className="review-list">{items.map(([Icon, title, desc, badge], index) => <button key={title} className={index === 4 ? "locked" : ""} onClick={index === 4 ? undefined : onStart}><span className="review-icon"><Icon /></span><span><b>{title}</b><small>{desc}</small></span><i>{badge}</i><ChevronRight /></button>)}</div>
  </main>;
}

function Records({ onBack }: { onBack: () => void }) {
  return <main className="content-page records-page"><BackButton onClick={onBack} /><div className="page-title"><p className="eyebrow">모험 두루마리</p><h2>구름붓의 기록</h2><p>왕국을 되찾기 위해 걸어온 길이에요.</p></div>
    <div className="record-stats"><div><b>17</b><span>배운 한자</span></div><div><b>88%</b><span>퀴즈 정답률</span></div><div><b>82%</b><span>쓰기 통과율</span></div><div><b>5일</b><span>연속 모험</span></div></div>
    <section className="paper-panel timeline"><h3>최근 모험 기록</h3>{["水 물 수 학습 완료", "火 불 화 쓰기 연습", "月 달 월 퀴즈 만점", "자연의 숲 입장"].map((t, i) => <div key={t}><i /><span><b>{t}</b><small>{i === 0 ? "오늘" : `${i}일 전`}</small></span></div>)}</section>
  </main>;
}

function TeacherDashboard({ detail, classInfo, students, demo, selectedStudent, onBack, onDetail, onNewClass, onHome }: {
  detail: boolean; classInfo: TeacherClass | null; students: StudentRow[]; demo: boolean; selectedStudent: StudentRow | null;
  onBack: () => void; onDetail: (student: StudentRow) => void; onNewClass: () => void; onHome: () => void;
}) {
  const activeStudent = selectedStudent ?? students[0];
  const learnedAverage = students.length ? Math.round(students.reduce((sum, s) => sum + s.learned, 0) / students.length) : 0;
  const quizAverage = students.length ? Math.round(students.reduce((sum, s) => sum + s.quiz, 0) / students.length) : 0;
  const reviewCount = students.filter((s) => s.status !== "순조로움").length;
  if (detail && activeStudent) return <main className="teacher-dashboard"><header className="teacher-head"><BackButton onClick={onBack} /><div>{demo && <span className="demo-badge">예시 데이터</span>}<button className="icon-button" onClick={onHome}><LogOut /><span>나가기</span></button></div></header>
    <div className="teacher-title"><div className="avatar">漢</div><div><p className="eyebrow">{activeStudent.no}번 학생</p><h1>{activeStudent.id}</h1><span>{activeStudent.learned >= 15 ? "한자 수련생" : "한자 견습생"} · 최근 접속 {activeStudent.last}</span></div><button className="outline-button">비밀번호 초기화</button></div>
    <div className="teacher-stats"><Stat label="학습한 한자" value={`${activeStudent.learned} / 50`} /><Stat label="전체 진행률" value={`${Math.round(activeStudent.learned / 50 * 100)}%`} /><Stat label="평균 정답률" value={`${activeStudent.quiz}%`} /><Stat label="쓰기 통과율" value={`${activeStudent.writing}%`} /></div>
    <section className="dashboard-panel"><h2>단원별 진행도</h2>{chapters.slice(0, 4).map((c, i) => <div className="chapter-progress" key={c.id}><span>{c.place}</span><div><i style={{ width: i === 0 ? "82%" : i === 1 ? "20%" : "0%" }} /></div><b>{i === 0 ? "9/11" : i === 1 ? "1/8" : "0"}</b></div>)}</section>
    <div className="teacher-two-col"><section className="dashboard-panel"><h2>자주 틀리는 한자</h2><div className="trouble-hanja"><span>三<small>뜻 구별</small></span><span>水<small>쓰기</small></span><span>山<small>음 읽기</small></span></div></section><section className="dashboard-panel"><h2>최근 학습 기록</h2><ul><li>月 퀴즈 완료 <b>100%</b></li><li>日 쓰기 연습 <b>통과</b></li><li>수의 들판 종합 <b>82%</b></li></ul></section></div>
  </main>;

  return <main className="teacher-dashboard"><header className="teacher-head"><div className="teacher-brand"><Castle /><b>한자별곡 관청</b></div><div>{demo && <span className="demo-badge">예시 데이터</span>}<button className="icon-button" onClick={onHome}><LogOut /><span>나가기</span></button></div></header>
    <div className="teacher-title"><div><p className="eyebrow">{classInfo?.grade ?? "학년 미지정"}</p><h1>{classInfo?.name ?? "새 학급"}</h1><span>학급 코드 <b>{classInfo?.code ?? "미생성"}</b> <button aria-label="복사" onClick={() => classInfo && navigator.clipboard?.writeText(classInfo.code)}><Copy /></button></span></div><div className="teacher-title-actions"><button className="outline-button" onClick={onNewClass}><RotateCcw /> 새 학급 만들기</button><button className="ink-button"><UsersRound /> 학생 관리</button></div></div>
    <div className="teacher-stats"><Stat label="등록 학생" value={`${students.length}명`} /><Stat label="오늘 학습" value={`${students.filter((s) => s.last === "오늘").length}명`} /><Stat label="평균 진행률" value={`${Math.round(learnedAverage / 50 * 100)}%`} /><Stat label="평균 정답률" value={`${quizAverage}%`} /><Stat label="복습 필요" value={`${reviewCount}명`} warning={reviewCount > 0} /></div>
    <section className="dashboard-panel table-panel"><div className="panel-heading"><div><h2>학생 모험 현황</h2><p>학생을 누르면 자세한 기록을 볼 수 있어요.</p></div><button className="outline-button">명단 내려받기</button></div>
      {students.length === 0 ? <div className="empty-students"><UsersRound /><h3>아직 등록된 학생이 없어요</h3><p>학생에게 학급 코드 <b>{classInfo?.code}</b>를 알려주면 이곳에 등록 현황이 나타나요.</p></div> :
      <div className="student-table"><div className="table-row head"><span>번호 · 모험 아이디</span><span>학습</span><span>현재 단원</span><span>퀴즈</span><span>쓰기</span><span>최근 접속</span><span>상태</span></div>
      {students.map((s) => <button className="table-row" key={s.no} onClick={() => onDetail(s)}><span><b>{s.no}</b> {s.id}</span><span>{s.learned}/50</span><span>{s.chapter}</span><span>{s.quiz}%</span><span>{s.writing}%</span><span>{s.last}</span><span className={`status status-${s.status.replaceAll(" ", "-")}`}>{s.status}</span></button>)}</div>}
    </section>
  </main>;
}

function Stat({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return <div className={warning ? "warning" : ""}><span>{label}</span><b>{value}</b></div>;
}
