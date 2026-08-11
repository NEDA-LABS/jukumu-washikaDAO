/**
 * The certificate of support, drawn as SVG.
 *
 * SVG because it needs no dependency, scales to any print size without going
 * soft, and can be opened by anything. It is drawn to survive its own fonts
 * being missing on the viewer's machine: the composition is carried by rules,
 * proportion and the gold seal, so a fallback serif changes the texture but
 * never the structure.
 *
 * The wall is the motif — the same brick-per-member wall a chama fills in as
 * people pay. A supporter's gift is drawn as gold bricks laid into it.
 */

const INK = '#1a1714';
const CREAM = '#f4ede4';
const GOLD = '#e0a02e';
const GOLD_DEEP = '#a97416';
const RULE = 'rgba(26,23,20,0.16)';

const DISPLAY = "'Playfair Display', Georgia, 'Times New Roman', serif";
const UI = "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'DM Mono', 'SF Mono', Menlo, Consolas, monospace";

/** XML-escape. Donor names are attacker-supplied text going into markup. */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Fit a name to the plate. Long business names are common, so the type shrinks
 * rather than overflowing, and anything absurd is cut.
 */
function nameSize(name: string): number {
  const n = name.length;
  if (n <= 18) return 62;
  if (n <= 26) return 50;
  if (n <= 36) return 40;
  if (n <= 48) return 32;
  return 27;
}

export interface CertificateInput {
  donorName: string;
  amountTzs: number;
  reference: string;
  date: Date;
}

export function renderCertificateSvg({ donorName, amountTzs, reference, date }: CertificateInput): string {
  const W = 1600;
  const H = 1131; // √2, so it prints to A4 landscape without cropping

  const name = esc(donorName.slice(0, 60));
  const amount = `TSh ${Math.round(amountTzs).toLocaleString('en-US')}`;
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // The gift as bricks. Capped so a large donation stays a composition rather
  // than a bar chart — the wall is a symbol here, not a measure.
  const bricks = Math.max(3, Math.min(24, Math.round(Math.log10(Math.max(amountTzs, 1000)) * 6) - 12));
  const BW = 44, BH = 15, BG = 6;
  const perRow = 12;
  const wallRows = Math.ceil(bricks / perRow);
  const wallW = perRow * (BW + BG) - BG;
  const wallX = (W - wallW) / 2;
  const wallY = 792;

  let wall = '';
  for (let i = 0; i < wallRows * perRow; i += 1) {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const filled = i < bricks;
    // Offset alternate courses, the way brick actually goes.
    const nudge = r % 2 === 1 ? (BW + BG) / 2 : 0;
    const x = wallX + c * (BW + BG) + nudge;
    if (x + BW > wallX + wallW + 1) continue;
    wall += `<rect x="${x.toFixed(1)}" y="${wallY + r * (BH + BG)}" width="${BW}" height="${BH}" `
      + `fill="${filled ? GOLD : 'none'}" stroke="${filled ? GOLD_DEEP : RULE}" stroke-width="1.5"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Certificate of support for ${name}">
  <defs>
    <linearGradient id="seal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8b24e"/><stop offset="1" stop-color="${GOLD_DEEP}"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="${INK}" stroke-width="3"/>
  <rect x="52" y="52" width="${W - 104}" height="${H - 104}" fill="none" stroke="${RULE}" stroke-width="1"/>

  <!-- Corner marks: the wall motif, quietly -->
  ${[[52, 52, 1, 1], [W - 52, 52, -1, 1], [52, H - 52, 1, -1], [W - 52, H - 52, -1, -1]]
    .map(([x, y, sx, sy]) =>
      `<path d="M ${x} ${(y as number) + (sy as number) * 46} L ${x} ${y} L ${(x as number) + (sx as number) * 46} ${y}" fill="none" stroke="${GOLD}" stroke-width="4"/>`
    ).join('')}

  <text x="${W / 2}" y="150" text-anchor="middle" font-family="${MONO}" font-size="17"
        letter-spacing="7" fill="${GOLD_DEEP}">W A S H I K A   D A U</text>
  <line x1="${W / 2 - 60}" y1="176" x2="${W / 2 + 60}" y2="176" stroke="${GOLD}" stroke-width="2"/>

  <text x="${W / 2}" y="268" text-anchor="middle" font-family="${DISPLAY}" font-size="54"
        font-style="italic" fill="${INK}">Certificate of Support</text>
  <text x="${W / 2}" y="312" text-anchor="middle" font-family="${MONO}" font-size="14"
        letter-spacing="5" fill="rgba(26,23,20,0.5)">CHETI CHA SHUKRANI</text>

  <text x="${W / 2}" y="404" text-anchor="middle" font-family="${UI}" font-size="21"
        fill="rgba(26,23,20,0.62)">This is to recognise and thank</text>

  <text x="${W / 2}" y="${404 + 96}" text-anchor="middle" font-family="${DISPLAY}"
        font-size="${nameSize(name)}" font-weight="700" fill="${INK}">${name}</text>
  <line x1="${W / 2 - 320}" y1="536" x2="${W / 2 + 320}" y2="536" stroke="${RULE}" stroke-width="1.5"/>

  <text x="${W / 2}" y="590" text-anchor="middle" font-family="${UI}" font-size="21"
        fill="rgba(26,23,20,0.62)">whose gift of</text>
  <text x="${W / 2}" y="668" text-anchor="middle" font-family="${DISPLAY}" font-size="66"
        font-weight="700" fill="${INK}">${amount}</text>
  <text x="${W / 2}" y="716" text-anchor="middle" font-family="${UI}" font-size="19"
        fill="rgba(26,23,20,0.62)">helps Tanzanian savings groups build what they own.</text>

  ${wall}

  <line x1="180" y1="${H - 176}" x2="${W - 180}" y2="${H - 176}" stroke="${RULE}" stroke-width="1"/>

  <text x="180" y="${H - 138}" font-family="${MONO}" font-size="12" letter-spacing="3"
        fill="rgba(26,23,20,0.45)">REFERENCE</text>
  <text x="180" y="${H - 110}" font-family="${MONO}" font-size="19" fill="${INK}">${esc(reference)}</text>

  <text x="${W - 180}" y="${H - 138}" text-anchor="end" font-family="${MONO}" font-size="12"
        letter-spacing="3" fill="rgba(26,23,20,0.45)">DATE</text>
  <text x="${W - 180}" y="${H - 110}" text-anchor="end" font-family="${UI}" font-size="19"
        fill="${INK}">${esc(dateStr)}</text>

  <!-- Seal -->
  <g transform="translate(${W / 2}, ${H - 128})">
    <circle r="52" fill="url(#seal)"/>
    <circle r="43" fill="none" stroke="${CREAM}" stroke-width="1.5" opacity="0.85"/>
    <text y="-6" text-anchor="middle" font-family="${DISPLAY}" font-size="30" font-weight="700" fill="${CREAM}">WD</text>
    <text y="17" text-anchor="middle" font-family="${MONO}" font-size="8.5" letter-spacing="2" fill="${CREAM}">ASANTE</text>
  </g>
</svg>`;
}
