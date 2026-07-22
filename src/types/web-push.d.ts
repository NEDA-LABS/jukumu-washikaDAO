// Ambient declaration for the optional `web-push` runtime dependency.
// This keeps the production type-check (next build / Netlify) green without
// requiring the external @types/web-push package to be installed, since push
// is loaded lazily and used loosely (see src/lib/push.ts).
declare module 'web-push';
