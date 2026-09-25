// Minimal single-page PDF that shows one JPEG edge to edge. The poster is rendered to a
// canvas first (fonts and Tamil shaping are the browser's job), so the PDF only has to
// carry the image: no PDF library needed, and it opens in every viewer and print shop.

const enc = new TextEncoder();

// PDF text strings: UTF-16BE with a BOM, as hex, so any title (Tamil included) survives
function pdfText(s: string): string {
  let hex = "FEFF";
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

export interface PdfImage {
  jpeg: Uint8Array;
  /** image size in pixels */
  width: number;
  height: number;
}

/** Page size is in PDF points (1/72 inch). */
export function imagePdf(img: PdfImage, page: { w: number; h: number }, title = ""): Blob {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (d: string | Uint8Array) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    parts.push(b);
    len += b.length;
  };
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = len;
    push(`${n} 0 obj\n${body}\n`);
    if (stream) { push("stream\n"); push(stream); push("\nendstream\n"); }
    push("endobj\n");
  };

  const W = page.w.toFixed(2), H = page.h.toFixed(2);
  const content = enc.encode(`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`);

  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker comment
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>`, img.jpeg);
  obj(5, `<< /Length ${content.length} >>`, content);
  obj(6, `<< /Title ${pdfText(title)} /Producer ${pdfText("Family Tree Builder")} >>`);

  const xref = len;
  push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let n = 1; n <= 6; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

/** Poster units are 4 per millimetre; PDF points are 72 per inch. */
export const unitsToPt = (u: number) => (u / 4) * (72 / 25.4);
