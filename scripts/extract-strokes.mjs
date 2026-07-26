import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "data", "hanja.ts"), "utf8");
const chapterLists = [...source.matchAll(/hanja:\s*make\("([^"]+)"\)/g)];
const characters = [...new Set(chapterLists.flatMap((match) => match[1].split(/\s+/)))];
const output = {};
const dataAliases = { "敎": "教", "靑": "青" };

for (const character of characters) {
  const dataCharacter = dataAliases[character] ?? character;
  const sourcePath = path.join(root, "node_modules", "hanzi-writer-data", `${dataCharacter}.json`);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing stroke data for ${character}`);
  }
  const data = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  output[character] = { strokes: data.strokes, medians: data.medians };
}

fs.writeFileSync(path.join(root, "data", "strokes.json"), JSON.stringify(output));
console.log(`Wrote stroke data for ${Object.keys(output).length} characters.`);
