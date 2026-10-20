import { describe, expect, it } from "vitest";
import { CHARACTERS, CODING, LIBRARY } from "./library";
import { CODE_PACK } from "./code-pack";
import { LANG_LOGOS } from "./lang-logos";
import { PACK_2 } from "./pack-2";
import { SHEET_STICKERS } from "./sheets";
import { buildIndex, groupCounts, normalize, searchStickers, stickerGroups } from "./search";

// Everything, demo art included, so the test doesn't depend on NEXT_PUBLIC_DEMO_ASSETS.
const ALL = [...LIBRARY, ...CODING, ...CODE_PACK, ...PACK_2, ...LANG_LOGOS, ...CHARACTERS, ...SHEET_STICKERS];
const index = buildIndex(ALL);
const ids = (q: string, g?: Parameters<typeof searchStickers>[2]) => searchStickers(index, q, g).map((s) => s.id);
const byId = (id: string) => ALL.find((s) => s.id === id)!;

describe("sticker groups", () => {
  it("puts every sticker in at least one group", () => {
    expect(ALL.filter((s) => stickerGroups(s).length === 0).map((s) => s.id)).toEqual([]);
  });

  it("derives groups from pack sections, category and extras", () => {
    expect(stickerGroups(byId("p2-som-tam"))).toEqual(["food", "thai"]);
    expect(stickerGroups(byId("p2-tuk-tuk"))).toEqual(["thai"]);
    expect(stickerGroups(byId("p2-cat"))).toEqual(["animals"]);
    expect(stickerGroups(byId("p2-rocket"))).toEqual(["space"]);
    expect(stickerGroups(byId("p2-floppy"))).toEqual(["code", "retro"]);
    expect(stickerGroups(byId("p2-donut"))).toEqual(["food", "retro"]);
    expect(stickerGroups(byId("elephant"))).toEqual(["animals", "thai"]);
    expect(stickerGroups(byId("code-sudo-bang"))).toEqual(["code"]);
    expect(stickerGroups(byId("lang-python"))).toEqual(["code"]);
    expect(stickerGroups(byId("mickey-01"))).toEqual(["characters"]);
    expect(stickerGroups(byId("demo-mouse-ears"))).toEqual(["characters"]);
  });

  it("only demo art lands in characters", () => {
    const visible = [...LIBRARY, ...CODING, ...CODE_PACK, ...PACK_2];
    expect(groupCounts(buildIndex(visible)).characters).toBe(0);
    expect(groupCounts(index).characters).toBeGreaterThan(0);
  });
});

describe("sticker search", () => {
  it("returns everything for an empty query", () => {
    expect(searchStickers(index, "  ")).toHaveLength(ALL.length);
  });

  it("matches Thai names and aliases", () => {
    const cats = ids("แมว");
    expect(cats).toEqual(expect.arrayContaining(["p2-cat", "p2-cat-loaf", "cute-09", "kitty-01"]));
    expect(ids("กาแฟ")).toEqual(expect.arrayContaining(["coffee-code", "p2-iced-coffee-bag", "p2-coffee-mug", "code-brew-coffee"]));
    expect(ids("ของไทย")).toContain("p2-tuk-tuk");
  });

  it("matches English, ids and tags case-insensitively", () => {
    expect(ids("Python")).toEqual(expect.arrayContaining(["lang-python", "coding-16", "coding-24"]));
    expect(ids("CAT")).toContain("p2-cat");
    expect(ids("coffee")).toContain("p2-coffee-mug");
    expect(ids("sudo-bang")).toEqual(["code-sudo-bang"]);
    expect(ids("food")).toContain("p2-pad-thai");
  });

  it("requires every word and respects the group", () => {
    expect(ids("cat black")).toEqual(["p2-cat-loaf"]);
    expect(ids("แมว", "animals")).toEqual(expect.arrayContaining(["p2-cat", "p2-cat-loaf"]));
    expect(ids("แมว", "animals")).not.toContain("kitty-01");
    expect(ids("", "space")).toContain("tiny-planet");
    expect(ids("zzzz-nothing")).toEqual([]);
  });

  it("normalises zero-width marks and case", () => {
    expect(normalize(" Ca\u200Bt ")).toBe("cat");
  });
});
