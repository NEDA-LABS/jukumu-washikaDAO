/**
 * The WashikaDAU mark, as raw geometry.
 *
 * Drawn in a 100×100 box: a hexagon with two interlocking "unity hands"
 * swirls, the second being the first turned half a revolution about the
 * centre.
 *
 * It lives here rather than inside the React component because the mark is
 * also drawn by the certificate renderer, which produces a standalone SVG file
 * on the server and cannot import a client component. Two copies of these
 * paths would drift, and the place that drift would show up is a certificate
 * someone prints and keeps — the one artefact of ours that outlives a deploy.
 */

/** The outer hexagon. Stroked, never filled. */
export const LOGO_HEX_PATH = 'M31 8 H69 L92 50 L69 92 H31 L8 50 Z';

/** One swirl. Filled. */
export const LOGO_SWIRL_PATH =
  'M47 53 C42.5 44.5 47 33.5 58 31.5 C69 29.5 77.5 38.5 76 49 '
  + 'C74.8 57.5 67 62 58.5 60.5 C64 57.5 65.5 50 60 46.5 '
  + 'C53.5 42.5 46.5 47 47 53 Z';

/** What turns the first swirl into its counterpart. */
export const LOGO_SWIRL_ROTATE = 'rotate(180 50 50)';

/** Stroke weight the hexagon is drawn at, in the 100×100 space. */
export const LOGO_HEX_STROKE = 6.5;
