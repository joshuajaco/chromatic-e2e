import { dedent } from 'ts-dedent';
import express, { type Request } from 'express';
import { Server } from 'http';
import { Browser, chromium, devices, Page } from 'playwright';

import { chromaticSnapshots, takeSnapshot } from './takeSnapshot';
import { TestInfo } from 'playwright/test';

const TEST_PORT = 13339;

const baseUrl = `http://localhost:${TEST_PORT}`;

const indexHtml = dedent`
  <html>
    <head>
      <link rel="stylesheet" href="style.css">
    </head>
    <body>
      <img src="img.png" >
    </body>
  </html>
`;

const pathToResponseInfo = {
  '/': {
    content: ({ query: { inject = '' } }: Request) =>
      indexHtml.replace('</body>', `${[].concat(inject).map(decodeURIComponent).join('')}</body>`),
    mimeType: 'text/html',
  },
} as const;

let app: ReturnType<typeof express>;
let server: Server;
beforeEach(async () => {
  app = express();

  Object.entries(pathToResponseInfo).forEach(([path, responseInfo]) => {
    app.get(path, (req, res) => {
      const { content, mimeType } = responseInfo;
      res.header('content-type', mimeType);
      res.send(typeof content === 'function' ? content(req) : content);
    });
  });

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => resolve(null));
  });
});

afterEach(async () => {
  await server.close();
});

describe('Snapshot storage', () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    // create a bare-bones Playwright test launch (https://playwright.dev/docs/library)
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterEach(async () => {
    await browser.close();

    // we have to manually clear out the chromaticSnapshots entries since that behavior only happens
    // in our test fixture (one level up).
    chromaticSnapshots.clear();
  });

  it('creates an entry (test name and snapshot buffer) when a snapshot is taken', async () => {
    expect(chromaticSnapshots.size).toBe(0);

    await page.goto(baseUrl);

    // not ideal to mock testInfo, but AFAIK we can't get testInfo when using Playwright library instead of Playwright test runner.
    // and this way we can specify the test ID ourselves
    const fakeTestInfo = { testId: 'a' };
    await takeSnapshot(page, fakeTestInfo as TestInfo);

    expect(chromaticSnapshots.get('a').has('Snapshot #1'));
    expect(Buffer.isBuffer(chromaticSnapshots.get('a').get('Snapshot #1'))).toBe(true);
  });

  it('creates multiple entries when multiple snapshots are taken', async () => {
    expect(chromaticSnapshots.size).toBe(0);

    await page.goto(baseUrl);

    const fakeTestInfo = { testId: 'a' };
    // take multiple snapshots
    await takeSnapshot(page, fakeTestInfo as TestInfo);
    await takeSnapshot(page, fakeTestInfo as TestInfo);

    expect(chromaticSnapshots.get('a').has('Snapshot #1'));
    expect(chromaticSnapshots.get('a').has('Snapshot #2'));
  });

  it('preserves names of snapshots when provided', async () => {
    expect(chromaticSnapshots.size).toBe(0);

    const fakeTestInfo = { testId: 'a' };
    await takeSnapshot(page, 'first snappy', fakeTestInfo as TestInfo);
    await takeSnapshot(page, 'second snappy', fakeTestInfo as TestInfo);

    expect(chromaticSnapshots.get('a').has('first snappy'));
    expect(chromaticSnapshots.get('a').has('second snappy'));
  });
});
