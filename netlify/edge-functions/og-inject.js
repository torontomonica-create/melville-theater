const MOVIES = {
  bride: {
    title: 'Now Playing: The Bride — Melville Theatre',
    description: 'MAR 13–19 · 8:00pm nightly · 14A · 126 min · Melville Theatre, Melville SK',
    image: 'https://img.youtube.com/vi/IhgcUArO3Uo/maxresdefault.jpg',
  },
  hailmary: {
    title: 'Coming Soon: Project Hail Mary — Melville Theatre',
    description: 'MAR 20–26 · 7:00pm · G · 157 min · Melville Theatre, Melville SK',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSatNA0E_YKQzqk1gccbRQPrg6fbXnS9NDauJFt4jlbBNH-yfAs',
  },
  mario: {
    title: 'Coming Soon: The Super Mario Galaxy Movie — Melville Theatre',
    description: 'APR 3–16 · 7:00pm + 2:00pm Sat & Sun · G · 98 min · Real D 3D · Melville Theatre, Melville SK',
    image: 'https://i.redd.it/fehzqd0ue9se1.jpeg',
  },
};

export default async (request, context) => {
  const url = new URL(request.url);
  const movieKey = url.searchParams.get('movie');
  const meta = MOVIES[movieKey];

  // movie 파라미터 없으면 그냥 통과
  if (!meta) return context.next();

  const response = await context.next();
  let html = await response.text();

  // OG / Twitter 태그 교체
  html = html
    .replace(/(<meta property="og:title"\s+content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta property="og:description"\s+content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta property="og:image"\s+content=")[^"]*(")/,        `$1${meta.image}$2`)
    .replace(/(<meta name="twitter:title"\s+content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta name="twitter:description"\s+content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta name="twitter:image"\s+content=")[^"]*(")/,       `$1${meta.image}$2`);

  return new Response(html, {
    status: response.status,
    headers: response.headers,
  });
};

export const config = { path: '/' };
