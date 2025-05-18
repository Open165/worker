import { whoisDomain } from 'whoiser';
import psl from 'psl';

interface Result {
  createdAt: string;
  updatedAt: string;
  expireAt: string;
  registrarUrl: string;
  nameServer: string | string[];
  details: Record<string, unknown>;
}

/**
 * Handles WHOIS lookups for a given host.
 */
export async function whoisHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const hostParam = url.searchParams.get('host');

  if (!hostParam) {
    return new Response('Missing host parameter', { status: 400 });
  }

  let domainToQuery = hostParam;
  try {
    const parsed = psl.parse(hostParam);
    if (parsed.error || !parsed.domain) {
      throw new Error(`psl.parse error: ${parsed.error}`);
    }
    domainToQuery = parsed.domain;
  } catch (e) {
    // psl.parse might throw an error for completely invalid inputs
    console.warn(`[psl] Error parsing host: ${hostParam}`, e);
    // Fallback to original hostParam
  }

  try {
    const whoisDataByServer: { [nsServer: string]: Record<string, unknown> } = await whoisDomain(domainToQuery, {
      timeout: 5000,
    });

    const result: Partial<Result> = {};
    const requiredKeys = ['createdAt', 'updatedAt', 'expireAt', 'registrarUrl', 'nameServer'];

    // Iterate over the results from different WHOIS servers
    // and try to find the required information.
    for (const [serverName, serverData] of Object.entries(whoisDataByServer)) {
      if (Array.isArray(serverData) || typeof serverData === 'string') {
        console.warn('[whoiser] Unexpected WHOIS server response format:', serverData);
        console.warn('[whoiser] Server:', serverName);
        continue;
      }

      if (!result.createdAt && 'Created Date' in serverData) {
        result.createdAt = new Date(String(serverData['Created Date'])).toISOString();
      }
      if (!result.updatedAt && 'Updated Date' in serverData) {
        result.updatedAt = new Date(String(serverData['Updated Date'])).toISOString();
      }
      if (!result.expireAt && 'Expiry Date' in serverData) {
        result.expireAt = new Date(String(serverData['Expiry Date'])).toISOString();
      }
      if (!result.registrarUrl && 'Registrar URL' in serverData) {
        result.registrarUrl = String(serverData['Registrar URL']);
      }
      if (!result.nameServer && 'Name Server' in serverData) {
        const currentNameServer = serverData['Name Server'];
        result.nameServer = Array.isArray(currentNameServer) ? currentNameServer.map((ns) => ns.toString()) : String(currentNameServer);
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
  } catch (error: unknown) {
    return new Response(`WHOIS lookup failed for ${hostParam}: ${String(error)}`, { status: 500 });
  }
}
