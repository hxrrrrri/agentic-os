import type { BrandKit, ThumbnailRenderSpec } from "@/types";
import { dimensionsFor, escapeXml, wrapLines } from "./dimensions";

/** Single hero thumbnail. Good for YouTube, blog hero, post header.
 *  Pure SVG, no native dep. */
export function renderThumbnailSvg(spec: ThumbnailRenderSpec, brand: BrandKit): string {
  const { w, h } = dimensionsFor(spec.aspect, "16:9");
  const pad = Math.round(w * 0.05);
  const titleSize = Math.round(w * 0.058);
  const subSize = Math.round(w * 0.027);
  const badgeSize = Math.round(w * 0.018);

  const titleLines = wrapLines(spec.title, 24, 3);
  const subtitleLines = wrapLines(spec.subtitle ?? "", 50, 2);
  const titleHeight = titleLines.length * titleSize * 1.15;
  const startY = Math.round((h - titleHeight) / 2);

  const titleTags = titleLines
    .map((line, i) => {
      const y = startY + i * (titleSize * 1.15);
      return `<text x="${pad}" y="${y}" font-family="${escapeXml(brand.fonts.heading)}" font-weight="900" font-size="${titleSize}" fill="${brand.palette.foreground}">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const subStartY = startY + titleLines.length * titleSize * 1.15 + Math.round(h * 0.04);
  const subTags = subtitleLines
    .map((line, i) => {
      const y = subStartY + i * subSize * 1.4;
      return `<text x="${pad}" y="${y}" font-family="${escapeXml(brand.fonts.body)}" font-size="${subSize}" fill="${brand.palette.muted}">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const badge = spec.badge
    ? `<g>
      <rect x="${pad}" y="${pad}" width="${Math.max(120, spec.badge.length * 14)}" height="${badgeSize * 2.4}" fill="${brand.palette.accent}"/>
      <text x="${pad + 14}" y="${pad + badgeSize * 1.6}" font-family="${escapeXml(brand.fonts.body)}" font-weight="800" font-size="${badgeSize}" letter-spacing="3" fill="${brand.palette.background}">${escapeXml(spec.badge.toUpperCase())}</text>
    </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand.palette.background}"/>
      <stop offset="100%" stop-color="${brand.palette.surface}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="0" y="${h - Math.round(h * 0.012)}" width="${w}" height="${Math.round(h * 0.012)}" fill="${brand.palette.accent}"/>
  ${badge}
  ${titleTags}
  ${subTags}
  <text x="${w - pad}" y="${h - pad}" text-anchor="end" font-family="${escapeXml(brand.fonts.body)}" font-size="${badgeSize}" fill="${brand.palette.muted}" letter-spacing="4">${escapeXml((brand.name ?? "AgenticOS").toUpperCase())}</text>
</svg>`;
}
