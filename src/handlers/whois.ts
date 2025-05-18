import { domain } from 'whoiser';
import type { WhoisSearchResult } from 'whoiser';

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
    const whoisDataByServer = await domain(host, {
      timeout: 5000, // Faster timeout
    });

    const result: Record<string, any> = {};
    const requiredKeys = ['createdAt', 'updatedAt', 'expireAt', 'registrarUrl', 'nameServer'];

    // Iterate over the results from different WHOIS servers
    // and try to find the required information.
    for (const [serverName, serverData] of Object.entries(whoisDataByServer)) {
      if (Array.isArray(serverData) || typeof serverData === 'string') {
        console.warn('[whoiser] Unexpected WHOIS server response format:', serverData);
        console.warn('[whoiser] Server:', serverName);
        continue;
      }

      if (!result.createdAt && serverData['Created Date']) {
        result.createdAt = new Date(serverData['Created Date'].toString()).toISOString();
      }
      if (!result.updatedAt && serverData['Updated Date']) {
        result.updatedAt = new Date(serverData['Updated Date'].toString()).toISOString();
      }
      if (!result.expireAt && serverData['Expiry Date']) {
        result.expireAt = new Date(serverData['Expiry Date'].toString()).toISOString();
      }
      if (!result.registrarUrl && serverData['Registrar URL']) {
        result.registrarUrl = serverData['Registrar URL'].toString();
      }
      if (!result.nameServer && serverData['Name Server']) {
        const currentNameServer = serverData['Name Server'];
        result.nameServer = Array.isArray(currentNameServer) ? currentNameServer.map(ns => ns.toString()) : currentNameServer.toString();
      }

      // If all required fields are found, break the loop
      if (Object.keys(result).length === requiredKeys.length) {
        break;
      }
    }
    result.details = whoisDataByServer;

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(`WHOIS lookup failed for ${host}: ${error.toString()}`, { status: 500 });
  }
}