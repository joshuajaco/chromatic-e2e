import { test as base, expect } from '@playwright/test';

import { makeTest } from './playwright-api/makeTest';

export const test = makeTest(base);

export { expect };

export { archiveCypress } from './cypress-api';

export { takeArchive } from './playwright-api/takeArchive';
export type { ChromaticConfig } from './types';
