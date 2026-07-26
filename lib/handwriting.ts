import strokeData from "@/data/strokes.json";

export type Point = { x: number; y: number };
type Entry = { medians: number[][][] };

const entries = strokeData as Record<string, Entry>;
const aliases: Record<string, string> = { 敎: "教", 靑: "青" };

function resample(points: Point[], count = 24): Point[] {
  if (points.length < 2) return Array.from({ length: count }, () => points[0] ?? { x: 0, y: 0 });
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = distances.at(-1) || 1;
  return Array.from({ length: count }, (_, index) => {
    const target = (total * index) / (count - 1);
    const right = distances.findIndex((distance) => distance >= target);
    if (right <= 0) return points[0];
    const left = right - 1;
    const ratio = (target - distances[left]) / Math.max(1, distances[right] - distances[left]);
    return { x: points[left].x + (points[right].x - points[left].x) * ratio, y: points[left].y + (points[right].y - points[left].y) * ratio };
  });
}

export function expectedStrokes(char: string, size: number): Point[][] {
  const entry = entries[char] ?? entries[aliases[char]];
  return (entry?.medians ?? []).map((stroke) => stroke.map(([x, y]) => ({ x: (x / 1024) * size, y: ((1024 - y) / 1024) * size })));
}

export function judgeWriting(char: string, drawn: Point[][], size: number) {
  const expected = expectedStrokes(char, size);
  if (drawn.length !== expected.length) {
    return { passed: false, score: Math.max(15, 80 - Math.abs(drawn.length - expected.length) * 18), message: drawn.length < expected.length ? `${expected.length - drawn.length}획이 부족해요.` : `${drawn.length - expected.length}획이 많아요.` };
  }
  let distance = 0;
  expected.forEach((stroke, index) => {
    const a = resample(drawn[index]);
    const b = resample(stroke);
    distance += a.reduce((sum, point, i) => sum + Math.hypot(point.x - b[i].x, point.y - b[i].y), 0) / a.length;
  });
  const average = distance / Math.max(1, expected.length);
  const score = Math.round(Math.max(0, Math.min(100, 105 - (average / size) * 230)));
  return {
    passed: score >= 64,
    score,
    message: score >= 82 ? "훌륭해요! 획의 모양과 순서가 아주 정확해요." : score >= 64 ? "통과! 조금만 더 반듯하게 쓰면 완벽해요." : "획의 시작·끝과 전체 모양을 보고 다시 써 봐요.",
  };
}
