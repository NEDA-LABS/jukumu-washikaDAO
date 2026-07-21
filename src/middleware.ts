import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Pages that are fully public (no auth required)
const PUBLIC_PAGES = ['/', '/login', '/register', '/investor', '/investor/signup', '/investor/login', '/portal']

// Page prefixes that are fully public
const PUBLIC_PAGE_PREFIXES = ['/jifunze', '/learn']

// API prefixes that are publicly accessible
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/public/',
  '/api/groups/lookup',
  '/api/webhooks/',
  '/api/investor/stats',
  '/api/investor/funding-requests',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public pages (exact match)
  if (PUBLIC_PAGES.includes(pathname)) return NextResponse.next()

  // Allow public page prefixes
  if (PUBLIC_PAGE_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Allow public API routes
  if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Check for auth cookie on all protected routes
  // Note: full JWT signature verification is done inside each API route handler.
  // The middleware only guards against completely unauthenticated requests.
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)'],
}
