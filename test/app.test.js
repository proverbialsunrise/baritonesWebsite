import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../app.js';
import { formatArrangementDate, getArrangements } from '../lib/getArrangements.js';
import {
  clearEventsCache,
  formatEventDate,
  getEvents,
  parseCalendarEvents,
} from '../lib/getEvents.js';
import { getRepertoire } from '../lib/getRepertoire.js';
import { getImagesForPhotosPage } from '../lib/utils.js';

const ROOT_DIR = path.join(import.meta.dirname, '..');

describe('data loaders', () => {
  it('sorts repertoire alphabetically by title', async () => {
    const songs = await getRepertoire(path.join(ROOT_DIR, 'data', 'repertoire.json'));
    assert.ok(songs.length > 0);
    for (let i = 1; i < songs.length; i += 1) {
      assert.ok(
        songs[i - 1].title <= songs[i].title,
        `Expected "${songs[i - 1].title}" <= "${songs[i].title}"`,
      );
    }
  });

  it('sorts arrangements newest first and formats date as "MMMM, YYYY"', async () => {
    const arrangements = await getArrangements(path.join(ROOT_DIR, 'data', 'arrangements.json'));
    assert.ok(arrangements.length >= 2);
    assert.equal(arrangements[0].title, "Since You've Been Gone");
    assert.equal(arrangements[0].dateStr, 'April, 2014');
    assert.equal(arrangements.at(-1).title, 'Friends');
    assert.equal(arrangements.at(-1).dateStr, 'July, 2011');
    assert.equal(formatArrangementDate('not-a-date'), '');
  });

  it('lists performance jpg photos sorted alphabetically with leading slash', async () => {
    const photos = await getImagesForPhotosPage();
    assert.ok(photos.length > 0);
    for (const photo of photos) {
      assert.match(photo.filename, /^\/img\/perform\/.+\.jpe?g$/i);
    }
    const names = photos.map((p) => p.filename);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sorted);
  });
});

describe('calendar events', () => {
  it('formats EST and EDT dates with ordinal day suffixes matching Moment format', () => {
    const estDate = new Date('2026-11-21T18:00:00Z');
    assert.equal(
      formatEventDate(estDate, 'America/Toronto'),
      'Saturday November 21st, 2026 - 1:00pm EST',
    );

    const edtDate = new Date('2027-04-11T18:00:00Z');
    assert.equal(
      formatEventDate(edtDate, 'America/Toronto'),
      'Sunday April 11th, 2027 - 2:00pm EDT',
    );

    const secondDate = new Date('2026-12-02T14:05:00Z');
    assert.equal(
      formatEventDate(secondDate, 'America/Toronto'),
      'Wednesday December 2nd, 2026 - 9:05am EST',
    );

    const thirdDate = new Date('2026-12-03T14:05:00Z');
    assert.equal(
      formatEventDate(thirdDate, 'America/Toronto'),
      'Thursday December 3rd, 2026 - 9:05am EST',
    );

    assert.equal(formatEventDate(null, 'America/Toronto'), '');
  });

  it('filters out rehearsals and past events, sorts earliest first, and handles parameter objects', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:past-1',
      'SUMMARY:Past Gig',
      'DTSTART:20200101T180000Z',
      'LOCATION:Old Hall',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:rehearsal-1',
      'SUMMARY:Weekly rehearsal',
      'DTSTART:20300501T230000Z',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:future-2',
      'SUMMARY:Later Show',
      'DTSTART:20300615T180000Z',
      'LOCATION:Park',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:future-1',
      'SUMMARY;LANGUAGE=en-US:First Show',
      'DTSTART:20300510T180000Z',
      'LOCATION;LANGUAGE=en-US:Downtown',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:no-summary',
      'DTSTART:20300701T180000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const now = Date.parse('2026-01-01T00:00:00Z');
    const events = parseCalendarEvents(ics, { timeZone: 'America/Toronto', now });

    assert.equal(events.length, 3);
    assert.equal(events[0].summary, 'First Show');
    assert.equal(events[0].location, 'Downtown');
    assert.equal(events[1].summary, 'Later Show');
    assert.equal(events[2].summary, '');
  });

  it('caches calendar results and falls back to stale cache on fetch failure', async () => {
    clearEventsCache();
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:cached-1',
      'SUMMARY:Cached Concert',
      'DTSTART:20300510T180000Z',
      'LOCATION:Guelph',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    let calls = 0;
    const okFetch = async () => {
      calls += 1;
      return new Response(ics, { status: 200 });
    };

    const t0 = Date.parse('2026-01-01T00:00:00Z');
    const first = await getEvents({
      calendarId: 'test@example.com',
      cacheTtlMs: 60_000,
      fetchImpl: okFetch,
      now: t0,
    });
    assert.equal(first.length, 1);
    assert.equal(calls, 1);

    const second = await getEvents({
      calendarId: 'test@example.com',
      cacheTtlMs: 60_000,
      fetchImpl: okFetch,
      now: t0 + 10_000,
    });
    assert.equal(second.length, 1);
    assert.equal(calls, 1);

    const failingFetch = async () => {
      calls += 1;
      throw new Error('network error');
    };

    const stale = await getEvents({
      calendarId: 'test@example.com',
      cacheTtlMs: 60_000,
      fetchImpl: failingFetch,
      now: t0 + 120_000,
    });
    assert.equal(stale.length, 1);
    assert.equal(stale[0].summary, 'Cached Concert');
    assert.equal(calls, 2);

    clearEventsCache();
    await assert.rejects(
      () =>
        getEvents({
          calendarId: 'uncached@example.com',
          fetchImpl: failingFetch,
          now: t0,
        }),
      /network error/,
    );
  });
});

describe('HTTP routes and security headers', () => {
  let server;
  let baseUrl;
  let shouldFailEvents = false;

  before(async () => {
    const app = createApp({
      isProduction: true,
      getEvents: async () => {
        if (shouldFailEvents) {
          throw new Error('Sensitive internal failure details');
        }
        return [
          {
            summary: 'Test Concert',
            location: 'Kitchener',
            dateString: 'Saturday November 21st, 2026 - 1:00pm EST',
          },
        ];
      },
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves /healthz', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });

  it('serves all page routes with HTTPS-safe assets and security headers', async () => {
    const routes = [
      ['/', '<title>Bearded Baritones</title>'],
      ['/about', '<title>About | Bearded Baritones</title>'],
      ['/videos', '<title>Videos | Bearded Baritones</title>'],
      ['/appearances', '<title>Appearances | Bearded Baritones</title>'],
      ['/repertoire', '<title>Repertoire | Bearded Baritones</title>'],
      ['/arrangements', '<title>Arrangements | Bearded Baritones</title>'],
      ['/photos', '<title>Photos | Bearded Baritones</title>'],
      ['/contact', '<title>Contact | Bearded Baritones</title>'],
    ];

    for (const [route, expectedTitle] of routes) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.equal(res.status, 200, `Expected 200 for ${route}`);
      const html = await res.text();
      assert.ok(html.includes(expectedTitle), `Missing title ${expectedTitle} on ${route}`);
      assert.ok(!html.includes('http://yui.yahooapis.com'), `Found Yahoo CDN on ${route}`);
      assert.ok(!html.includes('http://fonts.googleapis.com'), `Found HTTP font on ${route}`);
      assert.ok(!html.toLowerCase().includes('jquery'), `Found jQuery on ${route}`);
      assert.ok(html.includes('</head>'), `Missing </head> on ${route}`);
      assert.ok(html.includes('/vendor/purecss/pure-min.css'));
      assert.ok(html.includes('/vendor/purecss/grids-responsive-min.css'));

      assert.equal(res.headers.get('x-powered-by'), null);
      assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      const csp = res.headers.get('content-security-policy');
      assert.ok(csp?.includes('https://www.youtube.com'));
      assert.ok(csp?.includes('upgrade-insecure-requests'));
    }
  });

  it('fixes minor HTML bugs on /about, /photos, /appearances, and /contact', async () => {
    const aboutHtml = await (await fetch(`${baseUrl}/about`)).text();
    assert.ok(!aboutHtml.includes('src="img/'));
    assert.ok(aboutHtml.includes('src="/img/josh.jpg" alt="Photo of Josh"'));

    const photosHtml = await (await fetch(`${baseUrl}/photos`)).text();
    assert.ok(photosHtml.includes('src="/img/perform/'));

    const appearancesHtml = await (await fetch(`${baseUrl}/appearances`)).text();
    assert.ok(appearancesHtml.includes('Test Concert'));
    assert.ok(appearancesHtml.includes('Kitchener'));

    const contactHtml = await (await fetch(`${baseUrl}/contact`)).text();
    assert.ok(contactHtml.includes('href="mailto:bearded.baritones@gmail.com"'));
  });

  it('serves local PureCSS, app CSS, and JS assets', async () => {
    for (const asset of [
      '/vendor/purecss/pure-min.css',
      '/vendor/purecss/grids-responsive-min.css',
      '/css/app.css',
      '/js/ui.js',
    ]) {
      const res = await fetch(`${baseUrl}${asset}`);
      assert.equal(res.status, 200, `Expected 200 for ${asset}`);
    }
  });

  it('returns real 404 status for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.ok(html.includes('404: Page not found'));
  });

  it('returns 500 and hides error details in production', async () => {
    shouldFailEvents = true;
    try {
      const res = await fetch(`${baseUrl}/appearances`);
      assert.equal(res.status, 500);
      const html = await res.text();
      assert.ok(html.includes('500: Internal Server Error'));
      assert.ok(!html.includes('Sensitive internal failure details'));
    } finally {
      shouldFailEvents = false;
    }
  });
});
