import { describe, expect, it } from "vitest";
import { linkify } from "./linkify";

describe("linkify", () => {
  it("keeps plain text as one segment", () => {
    expect(linkify("สวัสดีค่ะ")).toEqual([{ kind: "text", text: "สวัสดีค่ะ" }]);
  });

  it("finds http(s) and www links and drops trailing punctuation", () => {
    expect(linkify("see https://shopee.co.th/x?a=1. or www.example.com!")).toEqual([
      { kind: "text", text: "see " },
      { kind: "link", text: "https://shopee.co.th/x?a=1", href: "https://shopee.co.th/x?a=1" },
      { kind: "text", text: ". or " },
      { kind: "link", text: "www.example.com", href: "https://www.example.com/" },
      { kind: "text", text: "!" },
    ]);
  });

  it("never links other schemes", () => {
    const segs = linkify("javascript:alert(1) data:text/html,hi");
    expect(segs.every((s) => s.kind === "text")).toBe(true);
  });

  it("does not treat markup as a link", () => {
    expect(linkify('<a href="x">https://a.co</a>')).toEqual([
      { kind: "text", text: '<a href="x">' },
      { kind: "link", text: "https://a.co", href: "https://a.co/" },
      { kind: "text", text: "</a>" },
    ]);
  });
});
