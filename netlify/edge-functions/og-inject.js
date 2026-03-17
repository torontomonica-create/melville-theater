// Netlify Edge Function — og-inject
// Intercepts requests to /?movie=KEY and replaces the default
// OG / Twitter meta tags with movie-specific values from movies.json.

export default async (request, context) => {
  const url      = new URL(request.url);
  const movieKey = url.searchParams.get('movie');

  // No ?movie= param → serve page as-is
  if (!movieKey) return context.next();

  // ── Fetch movies.json from the same origin ────────────────────────────────
  // The edge function runs before the response, so we fetch the JSON
  // file from the same site (absolute URL using the request's origin).
  let meta;
  try {
    const jsonUrl = `${url.origin}/movies.json`;
    const jsonRes = await fetch(jsonUrl);
    if (jsonRes.ok) {
      const data = await jsonRes.json();

      // Build a flat lookup: key → OG data
      const lookup = {};

      const np = data.nowPlaying;
      if (np && np.key) {
        lookup[np.key] = {
          title:       `Now Playing: ${np.title} — Melville Theatre`,
          description: `${np.dateRange} · ${np.showtime} · ${np.rating} · ${np.duration} · Melville Theatre, Melville SK`,
          image:       `https://img.youtube.com/vi/${np.trailerYouTubeId}/maxresdefault.jpg`,
        };
      }

      (data.comingSoon || []).forEach(m => {
        if (!m.key) return;
        lookup[m.key] = {
          title:       `Coming Soon: ${m.title} — Melville Theatre`,
          description: `${m.dateRange} · ${m.showtime} · ${m.rating} · ${m.duration}${m.specialNote ? ' · ' + m.specialNote : ''} · Melville Theatre, Melville SK`,
          image:       `https://img.youtube.com/vi/${m.trailerYouTubeId}/maxresdefault.jpg`,
        };
      });

      meta = lookup[movieKey];
    }
  } catch (_) {
    // If we can't fetch the JSON, fall through to default page
  }

  // Unknown movie key → serve page as-is (default OG tags remain)
  if (!meta) return context.next();

  // ── Fetch the HTML response, then inject movie-specific OG tags ───────────
  const response = await context.next();
  let html = await response.text();

  html = html
    .replace(/(<meta property="og:title"\s+content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta property="og:description"\s+content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta property="og:image"\s+content=")[^"]*(")/,        `$1${meta.image}$2`)
    .replace(/(<meta name="twitter:title"\s+content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta name="twitter:description"\s+content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta name="twitter:image"\s+content=")[^"]*(")/,       `$1${meta.image}$2`);

  return new Response(html, {
    status:  response.status,
    headers: response.headers,
  });
};

export const config = { path: '/' };
