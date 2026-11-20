// Password protection while the site is not yet public.
// The password is the SITE_PASSWORD secret in Cloudflare (Worker → Settings → Variables and secrets).
// Any username works; only the password is checked.
// To make the site public: delete the SITE_PASSWORD secret.

export default {
  async fetch(request, env) {
    const password = env.SITE_PASSWORD;
    if (password) {
      const header = request.headers.get("Authorization") || "";
      // Browsers send the login as UTF-8 or Latin-1 bytes (matters for ñ, á, …); accept both.
      const tries = [];
      if (header.startsWith("Basic ")) {
        try {
          const bytes = atob(header.slice(6).trim());
          const utf8 = new TextDecoder().decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
          for (const decoded of [utf8, bytes]) tries.push(decoded.slice(decoded.indexOf(":") + 1).normalize("NFC"));
        } catch {}
      }
      let ok = false;
      for (const given of tries) if (await sameText(given, password.normalize("NFC"))) ok = true;
      if (!ok) {
        return new Response("Sitio en preparación / Site in preparation", {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="Mujeres Artesanas de Kingston", charset="UTF-8"',
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
};

async function sameText(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}
