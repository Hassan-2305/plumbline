// Generates fictional demo assets in public/demo:
//   aurora-brand-book.pdf  — a small text PDF brand book (for guideline import)
//   northstar-promo.mp4    — an 8-second colour-block video (needs ffmpeg on PATH)
//   northstar-promo.vtt    — captions for the video
// Usage: node scripts/make-demo-assets.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "public", "demo");

// ---------- PDF (hand-built, Helvetica, no dependencies) ----------
const pages = [
  [
    ["h", "Aurora Coffee - Brand Guidelines"],
    ["s", "FICTIONAL DEMO DOCUMENT. Aurora Coffee is not a real company."],
    ["p", ""],
    ["h2", "1. Voice and tone"],
    ["p", "Our voice is warm, playful and conversational."],
    ["p", "All product copy must remain strictly formal."],
    ["p", "Avoid unsupported superlatives such as best or ultimate."],
    ["p", "Never use the phrase \"world's best coffee\"."],
    ["p", "Use \"single-origin\" instead of \"premium beans\"."],
    ["p", ""],
    ["h2", "2. Claims"],
    ["p", "Health claims about caffeine require approved supporting evidence."],
    ["p", "Numerical claims must match the approved fact sheet."],
    ["p", "Statistics older than 12 months must not be used in promotions."],
  ],
  [
    ["h2", "3. Accessibility"],
    ["p", "All videos must include captions."],
    ["p", "Images must have descriptive alt text."],
    ["p", "Text colour contrast must meet WCAG AA."],
    ["p", ""],
    ["h2", "4. Visual identity"],
    ["p", "Use the approved logo without stretching or recolouring."],
    ["p", "Primary colours are Roast Brown #4A2C2A and Cream #F5EBDD."],
    ["p", "Accent colour is Ember Orange #D9622B."],
    ["p", ""],
    ["p", "Aurora was founded in a small roastery. This history is background only."],
  ],
];

function makePdf(pages, file) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pagesId = objects.length + 1 + pages.length * 2; // reserved below
  const pageIds = [];
  for (const lines of pages) {
    let y = 760;
    let stream = "";
    for (const [kind, text] of lines) {
      const [font, size, gap] = kind === "h" ? ["/F2", 20, 30] : kind === "h2" ? ["/F2", 13, 22] : kind === "s" ? ["/F1", 9, 16] : ["/F1", 11, 18];
      if (text) stream += `BT ${font} ${size} Tf 60 ${y} Td (${esc(text)}) Tj ET\n`;
      y -= gap;
    }
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
    pageIds.push(
      add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`),
    );
  }
  const realPagesId = add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  if (realPagesId !== pagesId) throw new Error("page tree id mismatch");
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  writeFileSync(join(out, file), pdf, "latin1");
  console.log(`wrote ${file}`);
}

makePdf(pages, "aurora-brand-book.pdf");
makePdf(
  [
    [
      ["h", "Northstar Daily Protein - Retail Sell Sheet"],
      ["s", "FICTIONAL DEMO DOCUMENT. Northstar Nutrition is not a real company."],
      ["p", ""],
      ["p", "Each serving contains 24g of plant-based protein."],
      ["p", "Our vegan protein is the ultimate choice for athletes."],
      ["p", "Rated 4.8 out of 5 by more than 2,000 verified customers."],
    ],
    [
      ["h2", "Why retailers choose Northstar"],
      ["p", "Clinically proven to support muscle recovery."],
      ["p", "Contact sales@northstar-nutrition.example for wholesale pricing."],
      ["p", "Launching alongside Project Polaris in spring."],
    ],
  ],
  "northstar-sell-sheet.pdf",
);

// ---------- Captions ----------
writeFileSync(
  join(out, "northstar-promo.vtt"),
  `WEBVTT

NOTE Fictional demo captions for Northstar Nutrition.

00:00:00.500 --> 00:00:03.000
Meet Northstar Daily Protein, now with 24g of plant-based protein.

00:00:03.000 --> 00:00:05.500
Our miracle formula is clinically proven to boost your recovery!

00:00:06.000 --> 00:00:06.800
Order today and get free delivery on every single subscription box.
`,
);
console.log("wrote northstar-promo.vtt");

// ---------- Video (ffmpeg) ----------
try {
  const seg = (color, box, dur) => `color=c=${color}:s=640x360:d=${dur},drawbox=x=40:y=250:w=560:h=70:color=${box}:t=fill`;
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f", "lavfi", "-i", seg("0x2F6B4F", "0xF4EFE6", 3),
      "-f", "lavfi", "-i", seg("0x7C3AED", "0xEC4899", 3),
      "-f", "lavfi", "-i", seg("0xFFFFFF", "0x1C1C1E", 2),
      "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[v]",
      "-map", "[v]", "-r", "24", "-c:v", "libx264", "-preset", "veryslow", "-crf", "30", "-movflags", "+faststart",
      join(out, "northstar-promo.mp4"),
    ],
    { stdio: "ignore" },
  );
  console.log("wrote northstar-promo.mp4");
} catch {
  console.warn("ffmpeg not available — skipped northstar-promo.mp4");
}
