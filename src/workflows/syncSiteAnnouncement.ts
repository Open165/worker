import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

/**
 * Type for environment bindings
 */
interface Env {
  DB: D1Database;
}

/**
 * Parameters for the workflow
 */
type SyncParams = never;

/**
 * 165反詐騙官網使用之 API
 */
const NPA_165_ANNOUNCEMENT_API = 'https://165.npa.gov.tw/api/article/list/9';
const ANNOUCNEMENT_REGEX = /通報假投資/;

type NPA165Announcement = {
  id: string;
  title: string;
  publishDate: string;
};

/**
 * Workflow to sync site announcements from 165 API
 */
export class SyncSiteAnnouncementWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    console.log('[syncSiteAnnouncement]', 'Starting site announcement sync workflow');

    // Step 1: Fetch and process announcements
    const announcements = await step.do(
      'fetch-site-announcements',
      {
        retries: {
          limit: 3,
          delay: '10 seconds',
          backoff: 'exponential',
        },
      },
      async () => {
        const response = await fetch(NPA_165_ANNOUNCEMENT_API);
        const data: NPA165Announcement[] = await response.json();

        const filteredAnnouncements = data
          .filter(({ title }) => title.match(ANNOUCNEMENT_REGEX))
          .map(({ id, title, publishDate }) => ({
            id,
            title,
            endDate: this.getEndDate(title, publishDate),
            publishDate,
          }));

        return filteredAnnouncements;
      }
    );

    console.log('[syncSiteAnnouncement]', `Found ${announcements.length} announcements`);

    // Step 2: Insert announcements into DB
    if (announcements.length > 0) {
      await step.do('insert-announcements', async () => {
        const db = this.env.DB;

        // First delete existing announcements
        await db.prepare('DELETE FROM ScamSiteAnnouncement').run();

        // Prepare the insert statement once
        const insertStmt = db.prepare('INSERT INTO ScamSiteAnnouncement (id, title, endDate, publishDate) VALUES (?, ?, ?, ?)');

        // Create an array of bound statements for batch execution
        const batchStatements = announcements.map((announcement) => {
          return insertStmt.bind(announcement.id, announcement.title, announcement.endDate, announcement.publishDate);
        });

        // Execute all statements in a batch
        await db.batch(batchStatements);

        return { success: true, count: announcements.length };
      });

      console.log('[syncSiteAnnouncement]', `Inserted ${announcements.length} announcements into DB`);
    }

    console.log('[syncSiteAnnouncement]', 'Site announcement sync workflow completed');

    return {
      announcementsCount: announcements.length,
    };
  }

  /**
   * Extracts the end date from announcement titles
   *
   * Possible title formats and their respective expected output:
   * - 165反詐騙諮詢專線公布108/12/30-109/01/05民眾通報高風險賣場(平臺) --> 2020/01/05
   * - 公布108/12/11-12/17民眾通報假投資博奕網站(投資網站) --> 2019/12/17 (year may be omitted)
   * - 公布1/30~2/5民眾通報假投資(博奕)詐騙網站 --> 2020/02/05 (handle `~` as separator)
   * - 公布2/6-2/12民眾通報假投資(博奕)詐騙網站 --> 2020/02/12 (year comes from publishDate)
   *
   * @param title The announcement title
   * @param publishDate The date when the announcement is published, in YYYY-MM-DDThh:mm:ss+08:00
   * @returns The end date of the announcement in YYYY/MM/DD format
   */
  private getEndDate(title: string, publishDate: string): string {
    const publishYear = +publishDate.slice(0, 4);
    const publishMonth = +publishDate.slice(5, 7);

    // [-~]: handle both `~` and `-` as separator
    // (?:\d{1,3}\/)?: year is optional
    const matches = title.match(/[-~](?:\d{1,3}\/)?(\d{1,2}\/\d{1,2})/);
    if (!matches) throw new Error(`Cannot extract end date from "${title}"`);
    const [month, date] = matches[1].split('/');

    // `publishDate` is after end date, but should be within 1 week.
    // When `publishMonth` is smaller than `month`, the year should be `publishYear - 1`
    const year = publishMonth < +month ? publishYear - 1 : publishYear;

    return `${year}/${month.padStart(2, '0')}/${date.padStart(2, '0')}`;
  }
}
