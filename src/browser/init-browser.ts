import {assert} from '@augment-vir/assert';
import {chromium, type BrowserContext} from '@electrovir/rebrowser-playwright';
import {mkdir} from 'node:fs/promises';

/**
 * Options for initializing a persistent browser content.
 *
 * @category Internal
 */
export type BrowserOptions = Parameters<typeof chromium.launchPersistentContext>[1];

async function launchBrowserContext(
    userDataDirPath: string | undefined,
    options: Readonly<BrowserOptions>,
) {
    assert.isDefined(
        userDataDirPath,
        'Either `userDataDirPath` or `cdpConnectUrl` must be provided to `initBrowser`.',
    );
    await mkdir(userDataDirPath, {
        recursive: true,
    });

    /** WebKit is typically faster but `rebrowser-playwright` seems to only work with Chromium. */
    return await chromium.launchPersistentContext(userDataDirPath, options);
}

async function connectBrowserContext(cdpConnectUrl: string) {
    const browser = await chromium.connectOverCDP(cdpConnectUrl);
    const browserContext = browser.contexts()[0];
    assert.isDefined(browserContext, 'CDP connection returned no browser context.');
    return browserContext;
}

/**
 * Cleanly tear down a browser context. When the context belongs to a browser connected over CDP the
 * whole connection is closed; a locally launched persistent context is closed directly.
 *
 * @category Internal
 */
export async function closeBrowserContext(browserContext: Readonly<BrowserContext>) {
    const browser = browserContext.browser();
    if (browser) {
        await browser.close();
    } else {
        await browserContext.close();
    }
}

/**
 * Params for {@link initBrowser}.
 *
 * @category Internal
 */
export type InitBrowserParams =
    | {
          /**
           * Connect to an existing browser over the Chrome DevTools Protocol instead of launching a
           * local persistent browser.
           */
          cdpConnectUrl: string;
      }
    | {
          /**
           * Directory for the local persistent browser. Required unless `cdpConnectUrl` is
           * provided.
           */
          userDataDirPath: string;
          options?: BrowserOptions | undefined;
      };

/**
 * Initialize a browser and browser context. Launches a local persistent browser by default, or
 * connects to an existing browser over the Chrome DevTools Protocol when `cdpConnectUrl` is
 * provided.
 *
 * @category Internal
 */
export async function initBrowser(params: Readonly<InitBrowserParams>) {
    const browserContext =
        'cdpConnectUrl' in params
            ? await connectBrowserContext(params.cdpConnectUrl)
            : await launchBrowserContext(params.userDataDirPath, params.options);

    try {
        browserContext.setDefaultTimeout(10_000);

        return {
            browserContext,
        };
    } catch (error) {
        await closeBrowserContext(browserContext);
        throw error;
    }
}
