import { NextResponse, type NextRequest } from "next/server";

// Private access for the whole app (pages + API). Candidate CVs are personal data
// and the API can send email, so a deployed copy must not be open to the internet.
//
// No login prompt: open the app once with ?key=<APP_PASSWORD> (the "access link").
// That sets a year-long httpOnly cookie on this browser and strips the key from the
// URL. After that the app just opens. Basic auth still works for scripts (curl -u).
// Locally, leaving APP_PASSWORD unset keeps the app open.

const COOKIE = "kargo_access";
const ONE_YEAR = 60 * 60 * 24 * 365;

async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`kargo-shortlist:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const LOCKED_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kargo Shortlist</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:ui-sans-serif,system-ui,sans-serif;color:#132322;
background:radial-gradient(1000px 500px at 0 0,#e6f1ee,transparent 60%),radial-gradient(800px 400px at 100% 100%,#f4eef1,transparent 60%),#edf1f5}
.card{max-width:26rem;margin:1rem;padding:2rem;border-radius:1.5rem;background:#fffc;box-shadow:0 0 0 1px #e2e8e8}
.logo{width:2.5rem;height:2.5rem;border-radius:.75rem;background:#132322;color:#fff;display:grid;place-items:center;font-weight:600}
h1{font-size:1.4rem;font-weight:500;margin:1.25rem 0 .5rem}p{color:#5f6d6b;line-height:1.55;margin:0}</style></head>
<body><div class="card"><div class="logo">K</div><h1>This workspace is private</h1>
<p>Kargo Shortlist holds candidate CVs, so it only opens from your personal access link. Open that link once on this device and it will be remembered.</p></div></body></html>`;

export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("APP_PASSWORD is not configured for this deployment.", { status: 503 });
    }
    return NextResponse.next();
  }

  const token = await tokenFor(password);

  // 1. Already remembered on this browser.
  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && safeEqual(cookie, token)) return NextResponse.next();

  // 2. Opening the access link: remember this browser, then drop the key from the URL.
  const key = req.nextUrl.searchParams.get("key");
  if (key !== null) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("key");
    if (safeEqual(key, password)) {
      const res = NextResponse.redirect(clean);
      res.cookies.set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: ONE_YEAR });
      return res;
    }
  }

  // 3. Scripts and API clients can still use basic auth.
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    if (safeEqual(decoded.slice(decoded.indexOf(":") + 1), password)) return NextResponse.next();
  }

  // Locked: no browser login popup, just a calm explanation (or JSON for the API).
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "This workspace is private. Open it with your access link first." }, { status: 401 });
  }
  return new NextResponse(LOCKED_PAGE, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
