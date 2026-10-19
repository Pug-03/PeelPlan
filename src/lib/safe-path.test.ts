import { describe, expect, it } from "vitest";
import { afterAuthPath, safePath, stripLocale } from "./safe-path";

describe("safePath", () => {
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "javascript:alert(1)", "evil.com", ""])("rejects %j", (bad) => {
    expect(safePath(bad, "/fallback")).toBe("/fallback");
  });
  it.each(["/..//evil.com", "/th/..//evil.com", "/%2e%2e//evil.com", "/th//evil.com"])("rejects %j, which normalises to a protocol-relative URL", (bad) => {
    expect(safePath(bad, "/fallback")).toBe("/fallback");
  });
  it("keeps same-origin paths with query and hash", () => {
    expect(safePath("/th/editor?x=1#s=abc", "/f")).toBe("/th/editor?x=1#s=abc");
  });
  it("strips locale prefixes", () => {
    expect(stripLocale("/th/editor")).toBe("/editor");
    expect(stripLocale("/en")).toBe("/");
    expect(stripLocale("/en?x=1")).toBe("/?x=1");
    expect(stripLocale("/thing")).toBe("/thing");
  });
});

describe("afterAuthPath", () => {
  it("defaults to the collection", () => {
    expect(afterAuthPath(undefined)).toBe("/collection");
    expect(afterAuthPath("https://evil.com")).toBe("/collection");
    expect(afterAuthPath("/..//evil.com")).toBe("/collection");
  });
  it("returns the requested page without its locale, keeping a share hash", () => {
    expect(afterAuthPath("/th/editor?layout=abc")).toBe("/editor?layout=abc");
    expect(afterAuthPath("/editor#s=token")).toBe("/editor#s=token");
  });
  it("never sends people back to the sign-in pages", () => {
    expect(afterAuthPath("/th/login?next=/editor")).toBe("/collection");
    expect(afterAuthPath("/onboarding")).toBe("/collection");
  });
});
