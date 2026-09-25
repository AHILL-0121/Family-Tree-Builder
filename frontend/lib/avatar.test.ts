import { describe, expect, it } from "vitest";
import { firstGrapheme, getInitials, initialAvatarDataUrl, isValidImageUrl } from "./avatar";

describe("initialAvatarDataUrl", () => {
  it("does not throw on Tamil names (btoa used to)", () => {
    expect(() => initialAvatarDataUrl("நந்தினி", "female")).not.toThrow();
    const url = initialAvatarDataUrl("நந்தினி", "female");
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url)).toContain(">ந<");
  });
  it("escapes markup in the initial", () => {
    expect(decodeURIComponent(initialAvatarDataUrl("<b", ""))).toContain("&lt;");
  });
});

describe("graphemes", () => {
  it("keeps Tamil letter + vowel sign together", () => {
    expect(firstGrapheme("நாதன்")).toBe("நா");
    expect(getInitials("Kamala Rajan")).toBe("KR");
    expect(getInitials("  ")).toBe("");
  });
});

describe("isValidImageUrl", () => {
  it("allows http(s) and data images only", () => {
    expect(isValidImageUrl("https://x.test/a.png")).toBe(true);
    expect(isValidImageUrl("data:image/png;base64,AAA")).toBe(true);
    expect(isValidImageUrl("javascript:alert(1)")).toBe(false);
    expect(isValidImageUrl("file:///etc/passwd")).toBe(false);
  });
});
