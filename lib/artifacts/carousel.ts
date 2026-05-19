import type { BrandKit, CarouselRenderSpec, CarouselSlideSpec } from "@/types";
import { dimensionsFor, escapeXml, wrapLines } from "./dimensions";

function slideSvg(
  slide: CarouselSlideSpec,
  index: number,
  total: number,
  brand: BrandKit,
  width: number,
  height: number,
): string {
  const bg = slide.background ?? brand.palette.background;
  const fg = brand.palette.foreground;
  const accent = brand.palette.accent;
  const muted = brand.palette.muted;
  const surface = brand.palette.surface;
  const pad = Math.round(width * 0.075);
  const titleSize = Math.round(width * 0.075);
  const bodySize = Math.round(width * 0.04);
  const footerSize = Math.round(width * 0.022);

  const titleLines = wrapLines(slide.title ?? "", 22, 3);
  const bodyLines = wrapLines(slide.body ?? "", 38, 12);
  const footer = slide.footer ?? brand.name ?? "";

  const titleY = Math.round(height * 0.22);
  const titleTags = titleLines
    .map((line, i) => {
      const y = titleY + i * (titleSize * 1.15);
      return `<text x="${pad}" y="${y}" font-family="${escapeXml(brand.fonts.heading)}" font-weight="800" font-size="${titleSize}" fill="${fg}">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const bodyStartY = titleY + titleLines.length * (titleSize * 1.15) + Math.round(height * 0.04);
  const bodyTags = bodyLines
    .map((line, i) => {
      const y = bodyStartY + i * (bodySize * 1.55);
      return `<text x="${pad}" y="${y}" font-family="${escapeXml(brand.fonts.body)}" font-size="${bodySize}" fill="${muted}">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const counter = `${index + 1} / ${total}`;
  const accentBarWidth = Math.round((width - pad * 2) * ((index + 1) / total));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="${bg}"/>
  <rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${Math.round(height * 0.005)}" fill="${surface}"/>
  <rect x="${pad}" y="${pad}" width="${accentBarWidth}" height="${Math.round(height * 0.005)}" fill="${accent}"/>
  <text x="${pad}" y="${pad + Math.round(height * 0.045)}" font-family="${escapeXml(brand.fonts.body)}" font-size="${footerSize}" fill="${accent}" letter-spacing="2">${escapeXml((brand.name ?? "AgenticOS").toUpperCase())} · ${counter}</text>
  ${titleTags}
  ${bodyTags}
  <text x="${pad}" y="${height - pad}" font-family="${escapeXml(brand.fonts.body)}" font-size="${footerSize}" fill="${muted}">${escapeXml(footer)}</text>
</svg>`;
}

/** Render a multi-slide carousel as an array of SVG strings. Pure render —
 *  caller is responsible for persistence. */
export function renderCarouselSvgs(spec: CarouselRenderSpec, brand: BrandKit): string[] {
  const { w, h } = dimensionsFor(spec.aspect, "1:1");
  return spec.slides.map((slide, i) => slideSvg(slide, i, spec.slides.length, brand, w, h));
}

/** Build a single HTML index that previews all slides side by side. */
export function renderCarouselIndexHtml(spec: CarouselRenderSpec, svgPaths: string[], brand: BrandKit): string {
  const cards = svgPaths
    .map(
      (rel, i) => `
    <figure>
      <img src="${escapeXml(rel)}" alt="Slide ${i + 1}" />
      <figcaption>${i + 1} / ${svgPaths.length}</figcaption>
    </figure>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeXml(spec.title)}</title>
<style>
  :root { color-scheme: dark; }
  body { background: ${brand.palette.background}; color: ${brand.palette.foreground}; font-family: ${brand.fonts.body}; margin: 0; padding: 24px; }
  h1 { font-family: ${brand.fonts.heading}; font-weight: 800; letter-spacing: 0.04em; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  figure { margin: 0; border: 1px solid ${brand.palette.surface}; padding: 8px; background: #000; }
  figure img { width: 100%; height: auto; display: block; }
  figcaption { font-size: 0.75rem; color: ${brand.palette.muted}; margin-top: 6px; letter-spacing: 0.12em; text-transform: uppercase; }
</style>
</head>
<body>
<h1>${escapeXml(spec.title)}</h1>
<p style="color:${brand.palette.muted}; max-width: 720px;">Generated carousel · ${svgPaths.length} slides · ${escapeXml(spec.aspect ?? "1:1")}</p>
<div class="grid">${cards}</div>
</body>
</html>`;
}
