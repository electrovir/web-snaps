import {awaitAllPromisesInObject, randomString, type MaybePromise} from '@augment-vir/common';
import {type BrowserContextOptions} from 'rebrowser-playwright';
import {initBrowser} from './init-browser.js';
import {type LoadedBrowser} from './loaded-browser.js';

/**
 * Params for {@link setupBrowser} and {@link withBrowserContext}.
 *
 * @category Internal
 */
export type BrowserSetupParams<Context> = Readonly<{
    context: MaybePromise<Context>;
    userDataDirPath: string;
    browserContextOptions?: Readonly<BrowserContextOptions> | undefined;
}>;

/**
 * Setup a browser instance for use with the web-snaps package.
 *
 * @category Internal
 */
export async function setupBrowser<Context>({
    context: rawContext,
    userDataDirPath,
    browserContextOptions,
}: BrowserSetupParams<Context>): Promise<LoadedBrowser<Context>> {
    const storeKey = [
        'data-store',
        randomString(32),
    ].join('-');

    const {browserResult, context} = await awaitAllPromisesInObject({
        browserResult: initBrowser({userDataDirPath, storeKey, browserContextOptions}),
        context: rawContext,
    });

    return {storeKey, ...browserResult, context};
}

/**
 * Run a callback with a browser instance. The browser will be cleanly closed when the callback is
 * finished (or fails).
 *
 * @category Internal
 */
export async function withBrowserContext<Context, T = void>(
    params: BrowserSetupParams<Context>,
    /** Calls this callback and then automatically closes the browser afterwards. */
    callback: (params: Readonly<LoadedBrowser<Context>>) => MaybePromise<T>,
): Promise<T> {
    const browserParams = await setupBrowser(params);

    try {
        return await callback(browserParams);
    } finally {
        await browserParams.browserContext.close();
    }
}
