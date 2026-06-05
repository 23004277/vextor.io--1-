import { UPDATE_LOG } from '../constants';

type UpdateLogEntry = (typeof UPDATE_LOG)[number];

type RelayStateStore = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
};

type Env = {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  DISCORD_UPDATE_WEBHOOK_URL?: string;
  UPDATE_LOG_BOT_TOKEN?: string;
  PUBLIC_SITE_URL?: string;
  UPDATE_LOG_STATE?: RelayStateStore;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LAST_POSTED_UPDATE_KEY = 'update-log:last-posted';
const DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 45;
const DISCORD_THEME_COLORS: Record<string, number> = {
  Systems: 0xf59e0b,
  Featured: 0x22d3ee,
  Progression: 0xa78bfa,
  Interface: 0x38bdf8,
  Community: 0x34d399,
  Foundation: 0x94a3b8,
};
const SECTION_ICONS: Record<string, string> = {
  'Dominion Warfare': 'Control',
  'Void Transit': 'Void',
  'Bot Intelligence': 'AI',
  'Progression and PvE': 'Progression',
  'Interface and Security': 'Systems',
  'Combat Intelligence': 'Combat',
  'World and PvE': 'World',
  'Systems and Security': 'Security',
  'Interface and Sharing': 'Interface',
  'Pilot Records': 'Records',
  'Interface Layer': 'UI',
  'Community Systems': 'Community',
  'Main Menu': 'Menu',
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...(init.headers || {}),
    },
  });
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function formatSectionItems(items: string[]): string {
  return truncateText(items.map((item) => `- ${item}`).join('\n'), 1024);
}

function resolveUpdateLogEntry(updateId: string | null): UpdateLogEntry | undefined {
  if (!updateId) return UPDATE_LOG[0];
  return UPDATE_LOG.find((entry) => entry.id === updateId);
}

function getSiteUrl(request: Request, env: Env): string {
  const envUrl = env.PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  return new URL(request.url).origin;
}

function getCacheStateKey(request: Request): Request {
  const requestUrl = new URL(request.url);
  return new Request(`${requestUrl.origin}/__relay_state__/update-log/latest`, { method: 'GET' });
}

async function getLastPostedUpdateId(request: Request, env: Env): Promise<string | null> {
  if (env.UPDATE_LOG_STATE) {
    return env.UPDATE_LOG_STATE.get(LAST_POSTED_UPDATE_KEY);
  }

  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;
  if (!edgeCache) return null;

  const cached = await edgeCache.match(getCacheStateKey(request));
  return cached ? cached.text() : null;
}

async function setLastPostedUpdateId(request: Request, env: Env, updateId: string): Promise<void> {
  if (env.UPDATE_LOG_STATE) {
    await env.UPDATE_LOG_STATE.put(LAST_POSTED_UPDATE_KEY, updateId, { expirationTtl: DEDUPE_TTL_SECONDS });
    return;
  }

  const response = new Response(updateId, {
    headers: {
      'Cache-Control': `public, max-age=${DEDUPE_TTL_SECONDS}`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });

  const edgeCache = (caches as CacheStorage & { default?: Cache }).default;
  if (!edgeCache) return;

  await edgeCache.put(getCacheStateKey(request), response);
}

function buildDiscordPayload(entry: UpdateLogEntry, request: Request, env: Env) {
  const siteUrl = getSiteUrl(request, env);
  const shareImageUrl = `${siteUrl}/imgasset/vextor-preview-v2-share.png`;
  const tags = entry.tags.join(' | ');
  const totalHighlights = (entry.sections ?? []).reduce((sum, section) => sum + section.items.length, 0);

  return {
    username: 'Vextor Update Relay',
    allowed_mentions: { parse: [] as string[] },
    content: `Patch uplink transmitted: **${entry.id} // ${entry.title}**\nLaunch: ${siteUrl}`,
    embeds: [
      {
        title: truncateText(`${entry.id} // ${entry.title}`, 256),
        url: siteUrl,
        description: truncateText(entry.content, 4096),
        color: DISCORD_THEME_COLORS[entry.theme] ?? 0x22d3ee,
        author: {
          name: 'Vextor Tactical Update Archive',
          url: siteUrl,
          icon_url: shareImageUrl,
        },
        thumbnail: {
          url: shareImageUrl,
        },
        fields: [
          {
            name: 'Release Window',
            value: `${entry.date}\nTheme: ${entry.theme}`,
            inline: true,
          },
          {
            name: 'Telemetry',
            value: `${entry.sections?.length ?? 0} sections\n${totalHighlights} highlights`,
            inline: true,
          },
          {
            name: 'Tags',
            value: truncateText(tags || 'Live service update', 1024),
            inline: false,
          },
          ...(entry.sections ?? []).slice(0, 5).map((section) => ({
            name: truncateText(`${SECTION_ICONS[section.label] ?? 'Update'} | ${section.label}`, 256),
            value: formatSectionItems(section.items),
            inline: false,
          })),
        ],
        footer: {
          text: truncateText(`Posted from the Vextor update relay | ${entry.id}`, 2048),
        },
        image: {
          url: shareImageUrl,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function postUpdateLogToDiscord(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!env.UPDATE_LOG_BOT_TOKEN) {
    return jsonResponse({ error: 'Missing UPDATE_LOG_BOT_TOKEN secret' }, { status: 500 });
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.UPDATE_LOG_BOT_TOKEN}`) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!env.DISCORD_UPDATE_WEBHOOK_URL) {
    return jsonResponse({ error: 'Missing DISCORD_UPDATE_WEBHOOK_URL secret' }, { status: 500 });
  }

  let body: { updateId?: string; dryRun?: boolean; force?: boolean } = {};
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = (await request.json()) as { updateId?: string; dryRun?: boolean; force?: boolean };
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  const url = new URL(request.url);
  const updateId = body.updateId ?? url.searchParams.get('updateId');
  const dryRun = body.dryRun === true || url.searchParams.get('dryRun') === '1';
  const force = body.force === true || url.searchParams.get('force') === '1';
  const entry = resolveUpdateLogEntry(updateId);

  if (!entry) {
    return jsonResponse({ error: `Update log entry not found for '${updateId}'` }, { status: 404 });
  }

  const payload = buildDiscordPayload(entry, request, env);
  const lastPostedUpdateId = await getLastPostedUpdateId(request, env);

  if (!dryRun && !force && lastPostedUpdateId === entry.id) {
    return jsonResponse(
      {
        ok: true,
        duplicate: true,
        skipped: entry.id,
        reason: 'This update log entry was already relayed. Use force=1 to repost it.',
      },
      { status: 409 }
    );
  }

  if (dryRun) {
    return jsonResponse({
      ok: true,
      dryRun: true,
      updateId: entry.id,
      duplicateWouldTrigger: lastPostedUpdateId === entry.id,
      payload,
    });
  }

  if (env.DISCORD_UPDATE_WEBHOOK_URL === 'mock://discord-webhook') {
    await setLastPostedUpdateId(request, env, entry.id);
    return jsonResponse({
      ok: true,
      posted: entry.id,
      title: entry.title,
      force,
      lastPostedUpdateId: entry.id,
      mockRelay: true,
    });
  }

  const discordResponse = await fetch(env.DISCORD_UPDATE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!discordResponse.ok) {
    const errorText = await discordResponse.text();
    return jsonResponse(
      {
        error: 'Discord webhook rejected the update log payload',
        status: discordResponse.status,
        response: errorText,
      },
      { status: 502 }
    );
  }

  await setLastPostedUpdateId(request, env, entry.id);

  return jsonResponse({
    ok: true,
    posted: entry.id,
    title: entry.title,
    force,
    lastPostedUpdateId: entry.id,
  });
}

async function serveImageAsset(request: Request, env: Env): Promise<Response> {
  if (!env.ASSETS?.fetch) {
    return new Response('Static assets binding missing', { status: 500 });
  }

  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'image/png');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/discord/update-log/latest') {
      return postUpdateLogToDiscord(request, env);
    }

    if (url.pathname.startsWith('/imgasset/')) {
      return serveImageAsset(request, env);
    }

    if (env.ASSETS?.fetch) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
