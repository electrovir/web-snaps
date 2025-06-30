import {
    awaitAllPromisesInObject,
    randomString,
    type MaybePromise,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {initBrowser, type InitBrowserOptions} from './init-browser.js';
import {type LoadedBrowser} from './loaded-browser.js';

/**
 * Setup a browser instance for use with the web-snaps package.
 *
 * @category Internal
 */
export async function setupBrowser<Context>(
    rawContext: MaybePromise<Context>,
    options: Readonly<PartialWithUndefined<InitBrowserOptions>> = {},
): Promise<LoadedBrowser<Context>> {
    const storeKey = [
        'data-store',
        randomString(32),
    ].join('-');

    const {browserResult, context} = await awaitAllPromisesInObject({
        browserResult: initBrowser(storeKey, options),
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
    rawContext: MaybePromise<Context>,
    /** Calls this callback and then automatically closes the browser afterwards. */
    callback: (params: Readonly<LoadedBrowser<Context>>) => MaybePromise<T>,
    options: Readonly<PartialWithUndefined<InitBrowserOptions>> = {},
): Promise<T> {
    const browserParams = await setupBrowser(rawContext, options);

    try {
        return await callback(browserParams);
    } finally {
        await browserParams.browserContext.close();
        await browserParams.browser.close();
    }
}
