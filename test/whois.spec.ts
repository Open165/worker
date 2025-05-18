import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import type { Result } from '../src/handlers/whois';

describe('WHOIS worker integration', () => {
  it('returns WHOIS info for example.com', async () => {
    const response = await SELF.fetch('https://example.com/whois?host=example.com');
    const { createdAt, registrarUrl, nameServer } = await response.json<Result>();
    expect({
      createdAt,
      registrarUrl,
      nameServer,
    }).toMatchInlineSnapshot(`
        {
          "createdAt": "1995-08-14T04:00:00.000Z",
          "nameServer": [
            "A.IANA-SERVERS.NET",
            "B.IANA-SERVERS.NET",
          ],
          "registrarUrl": "http://res-dom.iana.org",
        }
      `);
  });
});
