// Netlify Edge Function — og-inject
// Intercepts /?movie=KEY and injects movie-specific OG meta tags.
// Movie status (Now Playing / Coming Soon) is determined by today's date.

export default async (request, context) => {
  const url      = new URL(request.url);
  const movieKey = url.searchParams.get('movie');
  if (!movieKey) return context.next();

  let meta;
  try {
    const jsonRes = await fetch(`${url.origin}/movies.json`);
    if (jsonRes.ok) {
      const data  = await jsonRes.json();
      const today = new Date();

      const film = (data.films || []).find(f => f.key === movieKey);
      if (film) {
        const start   = new Date(film.startDate + 'T00:00:00');
        const end     = new Date(film.endDate   + 'T23:59:59');
        const playing = today >= start && today <= end;
        const status  = playing ? 'Now Playing' : 'Coming Soon';

        // Build date range string e.g. "MAR 13–19"
        const MO = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const s  = new Date(film.startDate + 'T12:00:00');
        const e  = new Date(film.endDate   + 'T12:00:00');
        const sm = MO[s.getMonth()], em = MO[e.getMonth()];
        const dateRange = sm === em
          ? `${sm} ${s.getDate()}–${e.getDate()}`
          : `${sm} ${s.getDate()}–${em} ${e.getDate()}`;

        const extra = film.specialNote ? ` · ${film.specialNote}` : '';

        meta = {
          title:       `${status}: ${film.title} — Melville Theatre`,
          description: `${dateRange} · ${film.showtime} · ${film.rating} · ${film.duration}${extra} · Melville Theatre, Melville SK`,
          image:       `https://img.youtube.com/vi/${film.trailerYouTubeId}/maxresdefault.jpg`,
        };
      }
    }
  } catch (_) { /* fall through */ }

  if (!meta) return context.next();

  const response = await context.next();
  let html = await response.text();

  html = html
    .replace(/(<meta property="og:title"\s+content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta property="og:description"\s+content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta property="og:image"\s+content=")[^"]*(")/,        `$1${meta.image}$2`)
    .replace(/(<meta name="twitter:title"\s+content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta name="twitter:description"\s+content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta name="twitter:image"\s+content=")[^"]*(")/,       `$1${meta.image}$2`);

  return new Response(html, { status: response.status, headers: response.headers });
};

export const config = { path: '/' };
