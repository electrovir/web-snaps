import {type BrowserContext, type Page} from 'rebrowser-playwright';

/**
 * A loaded browser instance with context and store key.
 *
 * @category Internal
 */
export type LoadedBrowser<Context> = {
    browserContext: BrowserContext;
    storeKey: string;
    context: Context;
};

/**
 * {@link LoadedBrowser} with a loaded Playwright Page as well.
 *
 * @category Internal
 */
export type LoadedBrowserPage<Context> = LoadedBrowser<Context> & {
    page: Page;
    originalUrl: string;
};
