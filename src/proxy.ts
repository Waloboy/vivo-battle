import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Wrap in try-catch: if token refresh fails (400), let the request pass through
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch (e) {
    // Stale token or network error — let the component handle auth
    console.warn('[Proxy] getUser failed, passing through:', e)
  }

  // If user is signed in and visits the root page, redirect to dashboard
  if (request.nextUrl.pathname === '/' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - manifest.json (PWA manifest — MUST be public, no auth)
     * - assets/ (logos, images, sounds — MUST be public, no auth)
     * - sounds/ (audio files — MUST be public, no auth)
     * - *.svg, *.png, *.jpg, *.ico, *.webp (static images)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|assets/|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp)$).*)',
  ],
}
