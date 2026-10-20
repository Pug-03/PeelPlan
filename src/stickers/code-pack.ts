import { BLACK, MONO, O, die, face, gloss, wrap } from "./art";
import type { LibrarySticker } from "./library";

/**
 * Code & command sticker pack (in-house artwork). Most are built from a handful of templates whose
 * size follows the text, so adding one is a single line in the lists at the bottom.
 */

/** Artwork units to millimetres (matches the hand-drawn coding stickers, e.g. 220 units = 80 mm). */
const MM_PER_UNIT = 0.36;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Name = { en: string; th: string };
type Art = { w: number; h: number; body: string };

const sticker = (id: string, name: Name, { w, h, body }: Art): LibrarySticker => ({
  id: `code-${id}`,
  category: "coding",
  name,
  widthMm: Math.round(w * MM_PER_UNIT),
  viewBox: [w, h],
  svg: wrap(w, h, body),
});

/** Monospace glyphs are ~0.6em wide. */
const monoWidth = (text: string, size: number) => [...text].length * size * 0.6;

/** Outline colour for a filled shape: a dark fill keeps its own colour (a near-black ring on near-black reads as a muddy band). */
const edge = (bg: string) => (bg === "#1B1B1F" || bg === "#0D1117" ? bg : O);

/** One-line shell command on a pill: `$ text`. */
function command(text: string, bg: string, fg = "#fff", prompt = "#7AE582"): Art {
  const size = 16;
  const w = Math.round(monoWidth(`$ ${text}`, size) + 64);
  const light = bg !== "#1B1B1F" && bg !== "#0D1117";
  const pill = `<rect x="10" y="10" width="${w - 20}" height="40" rx="12"/>`;
  return {
    w,
    h: 60,
    body: `${die(pill)}
      <rect x="10" y="10" width="${w - 20}" height="40" rx="12" fill="${bg}"${light ? ` stroke="${O}" stroke-width="3"` : ""}/>
      <text x="32" y="35.5" font-family="${MONO}" font-weight="800" font-size="${size}"><tspan fill="${prompt}">$</tspan><tspan fill="${fg}" dx="${size * 0.6}">${esc(text)}</tspan></text>`,
  };
}

/** Terminal window with a few lines; lines starting with "$", ">" or "✓" get a coloured lead. */
function terminal(lines: string[], accent = "#7AE582"): Art {
  const size = 11.5;
  const w = Math.round(Math.max(150, Math.max(...lines.map((l) => monoWidth(l, size))) + 50));
  const h = 46 + lines.length * 17 + 6;
  const lead = (l: string) => {
    const m = /^([$>✓✗<] ?)(.*)$/.exec(l);
    if (!m) return `<tspan fill="#C9D1D9">${esc(l)}</tspan>`;
    const color = m[1].startsWith("✗") ? "#FF6B6B" : m[1].startsWith("<") ? "#8B949E" : accent;
    return `<tspan fill="${color}">${esc(m[1])}</tspan><tspan fill="#E6EDF3">${esc(m[2])}</tspan>`;
  };
  return {
    w,
    h,
    body: `${die(`<rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="13"/>`)}
      <rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="13" fill="#0D1117"/>
      <path d="M10 30V23a13 13 0 0 1 13-13h${w - 46}a13 13 0 0 1 13 13v7z" fill="#21262D"/>
      <circle cx="24" cy="20" r="4" fill="#FF5F57"/><circle cx="36" cy="20" r="4" fill="#FEBC2E"/><circle cx="48" cy="20" r="4" fill="#28C840"/>
      ${lines.map((l, i) => `<text x="22" y="${48 + i * 17}" font-family="${MONO}" font-weight="700" font-size="${size}">${lead(l)}</text>`).join("")}`,
  };
}

/** Chunky keyboard key. */
function keycap(label: string, top: string, side: string): Art {
  const size = label.length <= 2 ? 30 : label.length <= 4 ? 22 : 17;
  return {
    w: 110,
    h: 110,
    body: `${die(`<rect x="12" y="12" width="86" height="88" rx="16"/>`)}
      <rect x="12" y="12" width="86" height="88" rx="16" fill="${side}" stroke="${O}" stroke-width="3.5"/>
      <rect x="20" y="16" width="70" height="68" rx="12" fill="${top}" stroke="${O}" stroke-width="2.5"/>
      ${gloss("M28 30q2-8 10-9", 3.5)}
      <text x="55" y="${52 + size * 0.36}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="800" font-size="${size}" fill="${O}">${esc(label)}</text>`,
  };
}

/** Desktop-style error dialog. */
function errorBox(title: string, message: string): Art {
  const size = 12.5;
  const w = Math.round(Math.max(170, [...message].length * size * 0.56 + 82));
  return {
    w,
    h: 100,
    body: `${die(`<rect x="10" y="10" width="${w - 20}" height="80" rx="12"/>`)}
      <rect x="10" y="10" width="${w - 20}" height="80" rx="12" fill="#fff" stroke="${O}" stroke-width="3.5"/>
      <path d="M11.75 34V22a10.25 10.25 0 0 1 10.25-10.25h${w - 44}a10.25 10.25 0 0 1 10.25 10.25v12z" fill="#E5484D"/>
      <path d="M10 34h${w - 20}" stroke="${O}" stroke-width="3"/>
      <text x="24" y="27" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="12" fill="#fff">${esc(title)}</text>
      <path d="M${w - 30} 18l8 8m0-8l-8 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="36" cy="62" r="12" fill="#E5484D" stroke="${O}" stroke-width="2.5"/>
      <path d="M36 55v8" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="36" cy="69" r="2.2" fill="#fff"/>
      <text x="58" y="66.5" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="${size}" fill="${O}">${esc(message)}</text>`,
  };
}

/** Speech bubble (code-review talk). */
function bubble(text: string, bg: string, fg = O, mono = false): Art {
  const size = 18;
  const w = Math.round((mono ? monoWidth(text, size) : [...text].reduce((n, ch) => n + (/[A-Z]/.test(ch) ? 0.84 : 0.64), 0) * size) + 60);
  const shapes = `<rect x="10" y="10" width="${w - 20}" height="48" rx="24"/><path d="M30 52L24 72L52 54Z"/>`;
  return {
    w,
    h: 82,
    body: `${die(shapes)}
      <path d="M30 52L24 72L52 54Z" fill="${bg}" stroke="${edge(bg)}" stroke-width="3.5" stroke-linejoin="round"/>
      <rect x="10" y="10" width="${w - 20}" height="48" rx="24" fill="${bg}" stroke="${edge(bg)}" stroke-width="3.5"/>
      <path d="M30 52L24 72L52 54Z" fill="${bg}"/>
      ${gloss("M24 24q4-6 12-7", 3)}
      <text x="${w / 2}" y="${34 + size * 0.36}" text-anchor="middle" font-family="${mono ? MONO : BLACK}" font-weight="900" font-size="${size}" fill="${fg}">${esc(text)}</text>`,
  };
}

/** Square tile with one big operator or keyword. */
function symbol(glyph: string, bg: string, fg: string): Art {
  const size = [0, 58, 46, 36, 30, 24][Math.min([...glyph].length, 5)];
  return {
    w: 110,
    h: 110,
    body: `${die(`<rect x="12" y="12" width="86" height="86" rx="22"/>`)}
      <rect x="12" y="12" width="86" height="86" rx="22" fill="${bg}" stroke="${edge(bg)}" stroke-width="3.5"/>
      ${gloss("M24 34q3-10 13-12", 3.5)}
      <text x="55" y="${55 + size * 0.36}" text-anchor="middle" font-family="${MONO}" font-weight="800" font-size="${size}" fill="${fg}">${esc(glyph)}</text>`,
  };
}

/** Rubber stamp with a double border. */
function stamp(text: string, color: string): Art {
  const size = 22;
  const w = Math.round([...text].length * size * 0.8 + 56);
  return {
    w,
    h: 74,
    body: `${die(`<rect x="10" y="10" width="${w - 20}" height="54" rx="8"/>`)}
      <rect x="10" y="10" width="${w - 20}" height="54" rx="8" fill="#FFFDF7" stroke="${color}" stroke-width="4"/>
      <rect x="17" y="17" width="${w - 34}" height="40" rx="4" fill="none" stroke="${color}" stroke-width="1.8"/>
      <text x="${w / 2 + 1}" y="44.6" text-anchor="middle" font-family="${BLACK}" font-weight="900" font-size="${size - 1}" letter-spacing="2" fill="${color}">${esc(text)}</text>`,
  };
}

/** Chunky outlined word with a drop shadow, tilted like a slapped-on sticker ("coder"). */
function word(text: string, fill: string, outline: string, shadow: string): Art {
  const w = 300;
  const h = 176;
  const t = (attrs: string) =>
    `<text x="150" y="120" text-anchor="middle" textLength="232" lengthAdjust="spacingAndGlyphs" font-family="Arial Rounded MT Bold, Arial Black, Arial, sans-serif" font-weight="900" font-size="110" stroke-linejoin="round" paint-order="stroke" ${attrs}>${esc(text)}</text>`;
  return {
    w,
    h,
    body: `<g transform="rotate(-7 150 96)">
      ${t('fill="#fff" stroke="#000" stroke-opacity=".13" stroke-width="44" transform="translate(0 5)"')}
      ${t('fill="#fff" stroke="#fff" stroke-width="42" transform="translate(0 5)"')}
      ${t(`fill="${shadow}" stroke="${shadow}" stroke-width="17" transform="translate(0 6)"`)}
      ${t(`fill="${fill}" stroke="${outline}" stroke-width="17"`)}
    </g>`,
  };
}

const C = {
  coral: "#FF6B4A",
  yellow: "#FFD23F",
  mint: "#7AE582",
  blue: "#4C8DFF",
  purple: "#8B7CF6",
  pink: "#FF7AB6",
  teal: "#2EC4B6",
  dark: "#1B1B1F",
  cream: "#FFF4DC",
};

const drawn: LibrarySticker[] = [
  sticker("coder", { en: "coder", th: "coder" }, word("coder", "#fff", "#1B1B1F", "#9A9A9E")),
  sticker("coder-coral", { en: "coder (coral)", th: "coder (ส้มคอรัล)" }, word("coder", "#FF6B4A", "#1B1B1F", "#9A9A9E")),
  sticker("coder-mint", { en: "coder (mint)", th: "coder (เขียวมิ้นต์)" }, word("coder", "#7AE582", "#1B1B1F", "#9A9A9E")),
  sticker(
    "rubber-duck",
    { en: "Rubber duck debugging", th: "เป็ดยางช่วยดีบั๊ก" },
    {
      w: 130,
      h: 120,
      body: `${die(`<path d="M20 78C20 60 40 54 60 58C70 60 76 62 84 58C100 52 112 62 110 78C108 98 86 106 62 106C38 106 20 98 20 78Z"/><circle cx="80" cy="44" r="24"/><path d="M100 46C112 44 118 48 116 54C112 58 104 56 100 54Z"/>`)}
        <path d="M20 78C20 60 40 54 60 58C70 60 76 62 84 58C100 52 112 62 110 78C108 98 86 106 62 106C38 106 20 98 20 78Z" fill="#FFD23F" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M30 92C44 102 84 104 102 88" stroke="#F5B915" stroke-width="5" fill="none" stroke-linecap="round"/>
        <circle cx="80" cy="44" r="24" fill="#FFD23F" stroke="${O}" stroke-width="3.5"/>
        <path d="M100 46C112 44 118 48 116 54C112 58 104 56 100 54Z" fill="#FF8A3D" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M40 76C48 66 66 68 70 80C62 88 46 88 40 76Z" fill="#FFC21F" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
        ${gloss("M64 32q5-8 14-9")}
        <ellipse cx="92" cy="53" rx="4.5" ry="2.8" fill="#FF8FA3" opacity=".75"/>
        <ellipse cx="86" cy="40" rx="3.6" ry="4.6" fill="${O}"/><circle cx="87.3" cy="38.2" r="1.5" fill="#fff"/>`,
    },
  ),
  sticker(
    "floppy",
    { en: "Save icon", th: "ไอคอนเซฟ" },
    {
      w: 110,
      h: 110,
      body: `${die(`<path d="M14 22a8 8 0 0 1 8-8h58l16 16v58a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z"/>`)}
        <path d="M14 22a8 8 0 0 1 8-8h58l16 16v58a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z" fill="${C.blue}" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
        <rect x="32" y="14" width="42" height="26" fill="#D5DEEA" stroke="${O}" stroke-width="3"/>
        <rect x="60" y="19" width="8" height="16" rx="1.5" fill="${C.blue}"/>
        <rect x="26" y="54" width="58" height="34" rx="4" fill="#fff" stroke="${O}" stroke-width="3"/>
        <text x="55" y="76" text-anchor="middle" font-family="${MONO}" font-weight="800" font-size="11" fill="${O}">save.js</text>
        ${gloss("M20 46v-14", 3.5)}`,
    },
  ),
  sticker(
    "database",
    { en: "Database", th: "ฐานข้อมูล" },
    {
      w: 100,
      h: 120,
      body: `${die(`<path d="M20 30v62a30 10 0 0 0 60 0V30z"/><ellipse cx="50" cy="30" rx="30" ry="10"/>`)}
        <path d="M20 30v62a30 10 0 0 0 60 0V30" fill="${C.purple}" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M20 52a30 10 0 0 0 60 0M20 74a30 10 0 0 0 60 0" stroke="${O}" stroke-width="3" fill="none"/>
        <ellipse cx="50" cy="30" rx="30" ry="10" fill="#A99BFF" stroke="${O}" stroke-width="3.5"/>
        ${gloss("M27 44v40", 3.5)}
        ${face(50, 70, 8, 0.8)}`,
    },
  ),
  sticker(
    "git-graph",
    { en: "Git branches", th: "กิ่ง Git" },
    {
      w: 150,
      h: 90,
      body: `${die(`<rect x="10" y="10" width="130" height="70" rx="16"/>`)}
        <rect x="10" y="10" width="130" height="70" rx="16" fill="${C.dark}"/>
        <path d="M48 56C56 56 58 34 70 34H98C110 34 112 56 122 56" stroke="${C.pink}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M28 56H122" stroke="${C.mint}" stroke-width="4" stroke-linecap="round"/>
        <g fill="${C.dark}" stroke-width="3.5"><circle cx="28" cy="56" r="6" stroke="${C.mint}"/><circle cx="84" cy="56" r="6" stroke="${C.mint}"/><circle cx="122" cy="56" r="7" stroke="${C.yellow}" fill="${C.yellow}"/><circle cx="70" cy="34" r="6" stroke="${C.pink}"/><circle cx="98" cy="34" r="6" stroke="${C.pink}"/></g>`,
    },
  ),
];

export const CODE_PACK: LibrarySticker[] = [
  // Shell commands
  sticker("git-commit-wip", { en: 'git commit -m "wip"', th: 'git commit -m "wip"' }, command('git commit -m "wip"', C.dark)),
  sticker("rm-node-modules", { en: "rm -rf node_modules", th: "rm -rf node_modules" }, command("rm -rf node_modules", C.coral, "#fff", C.yellow)),
  sticker("sudo-bang", { en: "sudo !!", th: "sudo !!" }, command("sudo !!", C.yellow, O, C.coral)),
  sticker("npm-install", { en: "npm install", th: "npm install" }, command("npm install", "#CB3837", "#fff", C.yellow)),
  sticker("docker-up", { en: "docker compose up", th: "docker compose up" }, command("docker compose up", "#1D63ED", "#fff", C.yellow)),
  sticker("vim-wq", { en: ":wq", th: ":wq" }, command(":wq", C.mint, O, O)),
  sticker("git-blame", { en: "git blame", th: "git blame" }, command("git blame", C.purple, "#fff", C.yellow)),
  sticker("chmod-x", { en: "chmod +x", th: "chmod +x" }, command("chmod +x", C.dark, C.yellow)),
  sticker("kill-9", { en: "kill -9", th: "kill -9" }, command("kill -9", "#E5484D", "#fff", C.yellow)),
  sticker("ssh-prod", { en: "ssh prod", th: "ssh prod" }, command("ssh prod", C.dark, "#FF6B6B")),
  sticker("pnpm-dev", { en: "pnpm dev", th: "pnpm dev" }, command("pnpm dev", "#F69220", O, O)),
  sticker("brew-coffee", { en: "brew install coffee", th: "brew install coffee" }, command("brew install coffee", "#FBB040", O, "#7A4B12")),
  sticker("git-checkout-b", { en: "git checkout -b feature", th: "git checkout -b feature" }, command("git checkout -b feature", C.teal, "#fff", C.yellow)),
  sticker("cd-home", { en: "cd ~", th: "cd ~" }, command("cd ~", C.pink, "#fff", C.yellow)),

  // Terminal windows
  sticker("term-clean", { en: "Working tree clean", th: "ไม่มีอะไรให้ commit" }, terminal(["$ git status", "nothing to commit,", "working tree clean"])),
  sticker("term-tests", { en: "All tests pass", th: "เทสผ่านหมด" }, terminal(["$ npm test", "✓ 128 passed", "✗ 0 failed"])),
  sticker("term-whoami", { en: "whoami", th: "whoami" }, terminal(["$ whoami", "developer"])),
  sticker("term-console", { en: "console.log", th: "console.log" }, terminal(["> console.log('hi')", "hi", "< undefined"], C.yellow)),
  sticker("term-make-coffee", { en: "make coffee", th: "make coffee" }, terminal(["$ make coffee", "make: *** No rule to", "make target 'coffee'"])),
  sticker("term-vim", { en: "How to exit vim", th: "ออกจาก vim ยังไง" }, terminal(["$ vim", "how do I exit?", "help"])),

  // Keys
  sticker("key-copy", { en: "⌘C", th: "⌘C" }, keycap("⌘C", "#F4F6F8", "#C9CFD6")),
  sticker("key-paste", { en: "⌘V", th: "⌘V" }, keycap("⌘V", "#FFE7A3", "#F2C14E")),
  sticker("key-esc", { en: "Esc", th: "Esc" }, keycap("esc", "#FFB4A6", "#F07A62")),
  sticker("key-undo", { en: "Ctrl+Z", th: "Ctrl+Z" }, keycap("ctrl+Z", "#BFE9FF", "#7CC3EA")),
  sticker("key-tab", { en: "Tab", th: "Tab" }, keycap("tab ⇥", "#C9F2D2", "#86D69A")),
  sticker("key-enter", { en: "Enter", th: "Enter" }, keycap("↵", "#E2DBFF", "#A99BFF")),

  // Errors and review talk
  sticker("err-404", { en: "404 not found", th: "404 ไม่พบหน้า" }, errorBox("Error 404", "Page not found")),
  sticker("err-segfault", { en: "Segmentation fault", th: "Segmentation fault" }, errorBox("Fatal", "Segmentation fault (core dumped)")),
  sticker("err-undefined", { en: "undefined is not a function", th: "undefined is not a function" }, errorBox("TypeError", "undefined is not a function")),
  sticker("say-lgtm", { en: "LGTM", th: "LGTM" }, bubble("LGTM", C.mint)),
  sticker("say-feature", { en: "It's a feature", th: "มันคือฟีเจอร์" }, bubble("it's a feature", C.yellow)),
  sticker("say-works", { en: "Works for me", th: "เครื่องผมได้นะ" }, bubble("works for me", C.cream)),
  sticker("say-todo", { en: "// TODO", th: "// TODO" }, bubble("// TODO", C.dark, "#8B949E", true)),
  sticker("say-conflict", { en: "Merge conflict?", th: "ชนกันอีกแล้ว?" }, bubble("merge conflict?", C.pink, "#fff")),

  // Operators and keywords
  sticker("sym-braces", { en: "{ }", th: "{ }" }, symbol("{}", C.dark, C.yellow)),
  sticker("sym-arrow", { en: "=>", th: "=>" }, symbol("=>", C.purple, "#fff")),
  sticker("sym-semicolon", { en: ";", th: ";" }, symbol(";", C.yellow, O)),
  sticker("sym-strict-eq", { en: "===", th: "===" }, symbol("===", C.mint, O)),
  sticker("sym-and", { en: "&&", th: "&&" }, symbol("&&", C.coral, "#fff")),
  sticker("sym-null", { en: "null", th: "null" }, symbol("null", C.cream, "#C2410C")),
  sticker("sym-array", { en: "[ ]", th: "[ ]" }, symbol("[]", C.blue, "#fff")),
  sticker("sym-shebang", { en: "#!", th: "#!" }, symbol("#!", C.dark, C.mint)),

  // Stamps
  sticker("stamp-approved", { en: "Approved", th: "อนุมัติแล้ว" }, stamp("APPROVED", "#2F9E44")),
  sticker("stamp-deprecated", { en: "Deprecated", th: "เลิกใช้แล้ว" }, stamp("DEPRECATED", "#E5484D")),
  sticker("stamp-ship-it", { en: "Ship it", th: "ปล่อยเลย" }, stamp("SHIP IT", "#1D63ED")),
  sticker("stamp-hotfix", { en: "Hotfix", th: "แก้ด่วน" }, stamp("HOTFIX", "#E8590C")),

  ...drawn,
];
