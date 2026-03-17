// Netlify Function: update-movies
// Receives new movie data from the admin page, verifies password,
// then commits the updated movies.json to GitHub via the GitHub API.
// Netlify auto-deploys on every push → the public site updates in ~30s.

export default async (req, context) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { password, movies } = body;

  // ── 1. Verify admin password ──────────────────────────────────────────────
  const ADMIN_PASSWORD = Netlify.env.get('ADMIN_PASSWORD');
  if (!ADMIN_PASSWORD) {
    return json({ error: 'Server misconfigured: ADMIN_PASSWORD env var not set' }, 500);
  }
  if (password !== ADMIN_PASSWORD) {
    return json({ error: 'Incorrect password' }, 401);
  }

  // ── 2. Validate payload ───────────────────────────────────────────────────
  if (!movies || !movies.nowPlaying || !Array.isArray(movies.comingSoon)) {
    return json({ error: 'Invalid movies payload' }, 400);
  }

  // ── 3. GitHub API — get current file SHA ─────────────────────────────────
  const GITHUB_TOKEN = Netlify.env.get('GITHUB_TOKEN');
  const GITHUB_REPO  = Netlify.env.get('GITHUB_REPO');   // e.g. "torontomonica-create/melville-theater"
  const GITHUB_BRANCH = Netlify.env.get('GITHUB_BRANCH') || 'main';

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return json({ error: 'Server misconfigured: GITHUB_TOKEN or GITHUB_REPO env var not set' }, 500);
  }

  const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/movies.json`;
  const ghHeaders = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  let sha;
  try {
    const getRes = await fetch(`${apiBase}?ref=${GITHUB_BRANCH}`, { headers: ghHeaders });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    } else if (getRes.status !== 404) {
      const err = await getRes.text();
      return json({ error: `GitHub GET failed: ${err}` }, 500);
    }
  } catch (e) {
    return json({ error: `GitHub GET error: ${e.message}` }, 500);
  }

  // ── 4. GitHub API — commit updated movies.json ────────────────────────────
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(movies, null, 2))));

  const putPayload = {
    message: `Admin update: movies.json [${new Date().toISOString()}]`,
    content,
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  };

  try {
    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify(putPayload),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return json({ error: `GitHub PUT failed: ${err}` }, 500);
    }
  } catch (e) {
    return json({ error: `GitHub PUT error: ${e.message}` }, 500);
  }

  return json({ ok: true, message: 'movies.json updated — site will redeploy in ~30 seconds.' });
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export const config = { path: '/api/update-movies' };
