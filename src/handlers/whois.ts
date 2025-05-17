import { domain } from 'whoiser';
import type { WhoisSearchResult } from 'whoiser';

function getFirstAvailableKey(data: WhoisSearchResult, keys: string[]) {
  for (const key of keys) {
    if (key in data) {
      return data[key];
    }
  }
  return undefined;
}

/**
 * Handles WHOIS lookups for a given host.
 */
export async function whoisHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const host = url.searchParams.get('host');

  if (!host) {
    return new Response('Missing host parameter', { status: 400 });
  }

  try {
    const whoisDataByServer = await domain(host);

    let createdAtRaw: WhoisSearchResult[string];
    let expireAtRaw: WhoisSearchResult[string];

    // Iterate over the results from different WHOIS servers
    // and try to find the creation and expiry dates.
    // We prioritize results that have both dates.
    for (const [serverName, serverData] of Object.entries(whoisDataByServer)) {
      if (Array.isArray(serverData) || typeof serverData === 'string') {
        console.warn('[whoiser] Unexpected WHOIS server response format:', serverData);
        console.warn('[whoiser] Server:', serverName);
        continue;
      }

      const currentCreatedAt = getFirstAvailableKey(serverData, ['Creation Date', 'Created Date']);
      const currentExpireAt = getFirstAvailableKey(serverData, ['Expiry Date', 'Registrar Registration Expiration Date', 'Registry Expiry Date']);

      if (currentCreatedAt && currentExpireAt) {
        const createdAt = new Date(currentCreatedAt.toString()).toISOString();
        const expireAt = new Date(currentExpireAt.toString()).toISOString();

        return new Response(JSON.stringify({ createdAt, expireAt, details: whoisDataByServer }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // If we reach here, it means we didn't find both dates in any server's response.
    return new Response(JSON.stringify({ details: whoisDataByServer }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(`WHOIS lookup failed for ${host}: ${error.toString()}`, { status: 500 });
  }
}