// Netlify Edge Function — og-inject
// Fills in the link-preview tags (Facebook, Messenger, WhatsApp, iMessage) for the page.
//   /?movie=KEY  -> preview for that film
//   /            -> preview for the film playing now
// Movie status (Now Playing / Coming Soon) is determined by today's date.

const MO = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async (request, context) => {
  const url      = new URL(request.url);
  const movieKey = url.searchParams.get('movie');

  let meta;
  try {
    const jsonRes = await fetch(`${url.origin}/movies.json`);
    if (jsonRes.ok) {
      const data  = await jsonRes.json();
      const films = data.films || [];
      const today = new Date();
      const isPlaying = (f) =>
        today >= new Date(f.startDate + 'T00:00:00') && today <= new Date(f.endDate + 'T23:59:59');

      // Shared link: that film. Plain homepage: the film playing now.
      const film = movieKey ? films.find(f => f.key === movieKey) : films.find(isPlaying);
      if (film) {
        const status = isPlaying(film) ? 'Now Playing' : 'Coming Soon';

        // Build date range string e.g. "MAR 13–19"
        const s  = new Date(film.startDate + 'T12:00:00');
        const e  = new Date(film.endDate   + 'T12:00:00');
        const sm = MO[s.getMonth()], em = MO[e.getMonth()];
        const dateRange = sm === em
          ? `${sm} ${s.getDate()}–${e.getDate()}`
          : `${sm} ${s.getDate()}–${em} ${e.getDate()}`;

        const extra = film.specialNote ? ` · ${film.specialNote}` : '';

        // maxresdefault.jpg does not exist for every trailer; fall back to hqdefault.jpg
        let image = `https://img.youtube.com/vi/${film.trailerYouTubeId}/maxresdefault.jpg`;
        try {
          const head = await fetch(image, { method: 'HEAD' });
          if (!head.ok) image = `https://img.youtube.com/vi/${film.trailerYouTubeId}/hqdefault.jpg`;
        } catch (_) {
          image = `https://img.youtube.com/vi/${film.trailerYouTubeId}/hqdefault.jpg`;
        }

        meta = {
          title:       `${status}: ${film.title} — Melville Theatre`,
          description: `${dateRange} · ${film.showtime} · ${film.rating} · ${film.duration}${extra} · Melville Theatre, Melville SK`,
          image,
          // Facebook treats og:url as the page's identity, so it must be this film's own link
          url: movieKey ? `${url.origin}/?movie=${encodeURIComponent(film.key)}` : `${url.origin}/`,
        };
      }
    }
  } catch (_) { /* fall through */ }

  if (!meta) return context.next();

  const response = await context.next();
  let html = await response.text();

  // Replacer functions (not strings) so "$" in a title can never be misread as a replacement pattern
  const set = (re, value) => { html = html.replace(re, (_, a, b) => `${a}${escAttr(value)}${b}`); };
  set(/(<meta property="og:title"\s+content=")[^"]*(")/,        meta.title);
  set(/(<meta property="og:description"\s+content=")[^"]*(")/,  meta.description);
  set(/(<meta property="og:image"\s+content=")[^"]*(")/,        meta.image);
  set(/(<meta property="og:url"\s+content=")[^"]*(")/,          meta.url);
  set(/(<meta name="twitter:title"\s+content=")[^"]*(")/,       meta.title);
  set(/(<meta name="twitter:description"\s+content=")[^"]*(")/, meta.description);
  set(/(<meta name="twitter:image"\s+content=")[^"]*(")/,       meta.image);

  return new Response(html, { status: response.status, headers: response.headers });
};

export const config = { path: '/' };
