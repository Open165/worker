import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

/**
 * Type for environment bindings
 */
interface Env {
  DB: D1Database;
  URLSCAN_API_KEY?: string;
}

/**
 * Parameters for the workflow
 */
type SyncParams = {
  /** Optional URLscan submission flag */
  submitToUrlscan?: boolean;
};

/**
 * 165反詐騙諮詢專線_假投資(博弈)網站
 * https://data.gov.tw/dataset/160055
 */
const NPA_165_SITE_URL =
  // Ronny Wang's mirror to bypass IP region block
  'https://raw.githubusercontent.com/g0v-data/165-data/main/gamble.csv';

type NPA165SiteData = {
  name: string;
  url: string;
  count: number;
  /** In YYYY/MM/DD format */
  startDate: string;
  /** In YYYY/MM/DD format */
  endDate: string;
  /** Extracted from url */
  host: string;
};

/**
 * Workflow to sync site records from 165 open data
 */
export class SyncSiteRecordWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    console.log('[syncSiteRecord]', 'Starting site record sync workflow');

    // Step 1: Fetch the latest date in DB
    const latestDate = await step.do('fetch-latest-date', async () => {
      const result = await this.env.DB.prepare('SELECT max(endDate) AS latestDate FROM ScamSiteRecord').first<{
        latestDate: string | null;
      }>();

      return result?.latestDate || null;
    });

    console.log('[syncSiteRecord]', `Latest date in DB: ${latestDate || 'None'}`);

    // Step 2: Fetch and process site records
    const siteRecords = await step.do('fetch-site-records', async () => {
      const scamSiteCsv = await (await fetch(NPA_165_SITE_URL)).text();

      const rawData: NPA165SiteData[] = scamSiteCsv
        .split('\n')
        .filter(
          // Skip first 2 rows, they are headers
          (row, idx) => row.trim() && idx >= 2
        )
        .map((line) => {
          const [name, url, count, startDate, endDate] = line.trim().split(',');
          return {
            name: name.trim(),
            url: url.trim(),
            count: +count,
            startDate: startDate.trim(),
            endDate: endDate.trim(),

            /**
             * Extract host from url. URL in open data may come in these formats:
             * - some-domain.com
             * - some-domain.com:port
             * - some-domain.com/some-path
             * - some-domain.com/?some-query
             * - some-domain.com?some-query
             * - https://some-domain.com
             */
            host: url.match(/^(?:https?:\/\/)?([^?/:]+)/)?.[1] ?? url,
          };
        })
        .filter((data) => !latestDate || data.endDate > latestDate);

      if (!rawData.length) {
        console.log('[syncSiteRecord]', 'No new site records found');
        return { records: [], urls: [] };
      }

      // Sort by endDate ascending
      rawData.sort((a, b) => a.endDate.localeCompare(b.endDate));

      // Extract URLs for possible URLscan submission
      const urls = rawData.map((data) => data.url);

      return { records: rawData, urls };
    });

    console.log('[syncSiteRecord]', `Found ${siteRecords.records.length} new site records`);

    // Step 3: Insert site records into DB
    if (siteRecords.records.length > 0) {
      await step.do(
        'insert-site-records', // Add retry configuration
        {
          retries: {
            limit: 3,
            delay: '10 seconds',
            backoff: 'exponential',
          },
        },
        async () => {
          const db = this.env.DB;

          // Prepare the insert statement once
          const insertStmt = db.prepare(
            'INSERT INTO ScamSiteRecord (name, url, count, startDate, endDate, host) VALUES (?, ?, ?, ?, ?, ?)'
          );

          // Create an array of bound statements for batch execution
          const batchStatements = siteRecords.records.map((record) => {
            return insertStmt.bind(record.name, record.url, record.count, record.startDate, record.endDate, record.host);
          });

          // Prepare and add FTS rebuild statement
          const rebuildFtsStmt = db.prepare('INSERT INTO ScamSiteRecordFTS(ScamSiteRecordFTS) VALUES(?)');
          batchStatements.push(rebuildFtsStmt.bind('rebuild'));

          // Execute all statements in a batch
          await db.batch(batchStatements);

          return { success: true, count: siteRecords.records.length };
        }
      );

      console.log('[syncSiteRecord]', `Inserted ${siteRecords.records.length} site records into DB`);
    }

    // Step 4: Submit URLs to URLscan.io if required
    if (event.payload.submitToUrlscan && siteRecords.urls.length > 0 && this.env.URLSCAN_API_KEY) {
      await step.do(
        'submit-to-urlscan',
        {
          retries: {
            limit: 3,
            delay: '10 seconds',
            backoff: 'exponential',
          },
        },
        async () => {
          const API_URL = 'https://urlscan.io/api/v1/scan/';
          const API_KEY = this.env.URLSCAN_API_KEY;

          if (!API_KEY) {
            throw new Error('URLSCAN_API_KEY not configured');
          }

          const results = [];

          for (const url of siteRecords.urls) {
            // Sleep 2 seconds between submissions to avoid API rate limits
            await new Promise((resolve) => setTimeout(resolve, 2000));

            try {
              const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'API-Key': API_KEY,
                },
                body: JSON.stringify({
                  url: url,
                  visibility: 'public',
                  tags: ['scam', 'malicious'],
                }),
              });

              const result = await response.json<{
                uuid?: string;
                url?: string;
              }>();
              results.push({
                url,
                uuid: result.uuid,
                success: !!result.uuid,
              });
            } catch (error) {
              console.error(`Error submitting URL ${url} to URLscan:`, error);
              results.push({
                url,
                success: false,
                error: String(error),
              });
            }
          }

          return {
            success: true,
            submitted: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
          };
        }
      );
    }

    console.log('[syncSiteRecord]', 'Site record sync workflow completed');

    return {
      siteRecordsCount: siteRecords.records.length,
      urlsSubmitted: event.payload.submitToUrlscan && siteRecords.urls.length > 0,
    };
  }
}
