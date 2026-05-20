import {checkWrap} from '@augment-vir/assert';
import {
    ensureErrorAndPrependMessage,
    log as logImport,
    wrapInTry,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {getNowInUtcTimezone} from 'date-vir';
import {mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {type Page} from 'rebrowser-playwright';
import sanitizeFilename from 'sanitize-filename';
import {type LoadedBrowser} from '../browser/loaded-browser.js';
import {getAllPageHtml} from '../web-snap/get-html.js';
import {type PhaseRunParams} from './web-flow-phase.js';
import {type WebFlow} from './web-flow.js';

/**
 * The result of a single phase within a {@link WebFlow}.
 *
 * @category Internal
 */
export type WebFlowPhaseResult<Output> = {
    phaseName: string;
    output: Output | undefined;
    /**
     * The full page HTML snapshot captured after the phase finished. This will be left `undefined`
     * if grabbing the snapshot crashed or failed.
     */
    snapshot: string | undefined;
    /**
     * A full-page PNG screenshot captured after the phase finished. This will be left `undefined`
     * if grabbing the screenshot crashed or failed.
     */
    screenshot: Buffer | undefined;
    /**
     * The URL that the page was on after the phase finished running. This will be left `undefined`
     * if the page crashes and the url cannot be obtained.
     */
    finalPageUrl: string | undefined;
};

/**
 * Options for {@link runWebFlow}.
 *
 * @category Internal
 */
export type RunWebFlowOptions = PartialWithUndefined<{
    /**
     * Disable logging. Errors will still be logged.
     *
     * @default false
     */
    silent: boolean;
    /** The directory to which phase failure screenshots will be saved to. */
    screenshotFailurePath: string;
    /** A page that you want to use instead of creating a new one internally. */
    existingPage: Page;
}>;

/**
 * Params for {@link runWebFlow}.
 *
 * @category Internal
 */
export type RunWebFlowParams<Context, Output> = {
    browserParams: Readonly<LoadedBrowser<Context>>;
    webFlow: Readonly<WebFlow<Context, Output>>;
    options?: Readonly<RunWebFlowOptions> | undefined;
};

/**
 * Run a single {@link WebFlow}. A browser must already be loaded beforehand.
 *
 * @category Internal
 */
export async function runWebFlow<Context, Output>({
    browserParams,
    webFlow,
    options = {},
}: Readonly<RunWebFlowParams<Context, Output>>): Promise<WebFlowPhaseResult<Output>[]> {
    const log = logImport.if(!options.silent);

    /* node:coverage ignore next 1: not testing the user provided page */
    const page = options.existingPage || (await browserParams.browserContext.newPage());
    const createdPage = !options.existingPage;

    try {
        try {
            const webFlowStartedAt = getNowInUtcTimezone();
            await page.goto(webFlow.startUrl);

            log.faint(`${webFlow.flowKey}: start`);

            const params: Omit<PhaseRunParams<Context>, 'phaseStartedAt'> = {
                ...browserParams,
                originalUrl: webFlow.startUrl,
                page,
                webFlowStartedAt,
                webFlowKey: webFlow.flowKey,
                silent: !!options.silent,
            };

            const phaseResults: WebFlowPhaseResult<Output>[] = [];

            for (const [
                index,
                phase,
            ] of webFlow.phases.entries()) {
                try {
                    const phaseParams: PhaseRunParams<Context> = {
                        ...params,
                        phaseStartedAt: getNowInUtcTimezone(),
                    };

                    log.faint(`${webFlow.flowKey}: phase ${index}: ${phase.name}`);

                    const phaseResult = await wrapInTry(() => phase.run(phaseParams));
                    const finalPageUrl: string | undefined = wrapInTry(() => page.url(), {
                        fallbackValue: undefined,
                    });
                    const error = checkWrap.instanceOf(phaseResult, Error);

                    const output: Output | undefined =
                        checkWrap.notInstanceOf(phaseResult, Error) || undefined;

                    const [
                        snapshot,
                        screenshot,
                    ] = await Promise.all([
                        getAllPageHtml(page, browserParams.storeKey).catch((error: unknown) => {
                            console.error(
                                ensureErrorAndPrependMessage(
                                    error,
                                    `Failed to take HTML snapshot after phase '${phase.name}' on page '${finalPageUrl}'.`,
                                ),
                            );
                            return undefined;
                        }),
                        page
                            .screenshot({
                                fullPage: true,
                            })
                            .catch((error: unknown) => {
                                console.error(
                                    ensureErrorAndPrependMessage(
                                        error,
                                        `Failed to take screenshot after phase '${phase.name}' on page '${finalPageUrl}'.`,
                                    ),
                                );
                                return undefined;
                            }),
                    ]);

                    phaseResults.push({
                        phaseName: phase.name,
                        output,
                        snapshot,
                        screenshot,
                        finalPageUrl,
                    });

                    if (error) {
                        throw error;
                    }
                } catch (error) {
                    try {
                        const screenshotDirPath = options.screenshotFailurePath;

                        if (screenshotDirPath) {
                            const screenshotFilePath = join(
                                screenshotDirPath,
                                'screenshots',
                                webFlow.flowKey,
                                [
                                    'phase',
                                    String(index).padStart(2, '0'),
                                    sanitizeFilename(phase.name),
                                    Date.now(),
                                ].join('_') + '.png',
                            );
                            await mkdir(dirname(screenshotFilePath), {
                                recursive: true,
                            });
                            await page.screenshot({
                                path: screenshotFilePath,
                                fullPage: true,
                            });
                        }
                    } catch (screenshotError) {
                        log.error(
                            ensureErrorAndPrependMessage(
                                screenshotError,
                                'Failed to save phase failure screenshot.',
                            ),
                        );
                    }
                    throw ensureErrorAndPrependMessage(
                        error,
                        `Phase '${phase.name}' in WebFlow '${webFlow.flowKey}' failed:`,
                    );
                }
            }

            return phaseResults;
        } catch (error) {
            throw ensureErrorAndPrependMessage(error, `WebFlow '${webFlow.flowKey}' failed:`);
        }
    } finally {
        if (createdPage) {
            await page.close();
        }
    }
}
