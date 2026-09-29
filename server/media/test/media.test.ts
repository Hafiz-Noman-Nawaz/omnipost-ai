import { describe, it, expect } from "vitest";
import { sniffMime } from "../src/validation";
import { kindForMime } from "../src/types";

describe("Phase 2 Content Vault & Media Sniffing", () => {
  it("should accurately sniff PNG magic bytes", () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const detected = sniffMime(pngHeader);
    expect(detected).toBe("image/png");
    expect(kindForMime(detected)).toBe("IMAGE");
  });

  it("should accurately sniff JPEG magic bytes", () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const detected = sniffMime(jpegHeader);
    expect(detected).toBe("image/jpeg");
    expect(kindForMime(detected)).toBe("IMAGE");
  });

  it("should accurately sniff PDF magic bytes", () => {
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
    const detected = sniffMime(pdfHeader);
    expect(detected).toBe("application/pdf");
    expect(kindForMime(detected)).toBe("DOCUMENT");
  });
});
