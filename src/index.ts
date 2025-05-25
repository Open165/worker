/**
 * Main entrypoint - routes requests to their handlers
 */
import { screenshotHandler } from './handlers/screenshot';
import { whoisHandler } from './handlers/whois';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    switch (pathname) {
      case '/screenshot':
        return screenshotHandler(request, env);
      case '/whois':
        return whoisHandler(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  },

  // Handle scheduled events
  async scheduled(event, env) {
    console.log('Running scheduled sync');

    // Create workflow instances
    const recordInstance = await env.SYNC_SITE_RECORD.create({
      id: crypto.randomUUID(),
      params: {
        submitToUrlscan: true, // Enable URL scanning on scheduled runs
      },
    });

    const announcementInstance = await env.SYNC_SITE_ANNOUNCEMENT.create({
      id: crypto.randomUUID(),
      params: {},
    });

    console.log(`Started workflows: records=${recordInstance.id}, announcements=${announcementInstance.id}`);
  },
} satisfies ExportedHandler<Env>;
