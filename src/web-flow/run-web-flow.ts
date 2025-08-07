import {check, checkWrap} from '@augment-vir/assert';
import {
    ensureErrorAndPrependMessage,
    log as logImport,
    wrapInTry,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {getNowInIsoString, getNowInUtcTimezone} from 'date-vir';
import {JSDOM} from 'jsdom';
import {type Page} from 'rebrowser-playwright';
import {type LoadedBrowser} from '../browser/loaded-browser.js';
import {getAllPageHtml} from '../web-snap/get-html.js';
import {saveWebSnap} from '../web-snap/save-web-snap.js';
import {type InProgressWebSnap} from '../web-snap/web-snap.js';
import {type PhaseRunParams, type PhaseRunResult} from './web-flow-phase.js';
import {type WebFlow} from './web-flow.js';

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
    /**
     * Disable all phase snapshots, even when a phase has `takeSnapshot` set to `true`.
     *
     * @default false
     */
    disableSnapshots: boolean;
    /** Path to the directory that phase snapshots will be saved to. */
    webSnapDirPath: string;
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
}: Readonly<RunWebFlowParams<Context, Output>>): Promise<(undefined | Output)[]> {
    const log = logImport.if(!options.silent);

    /* node:coverage ignore next 1: not testing the user provided page */
    const page = options.existingPage || (await browserParams.browserContext.newPage());
    const createdPage = !options.existingPage;

    try {
        try {
            const webFlowStartedAt = getNowInUtcTimezone();
            await page.goto(webFlow.startUrl);

            log.faint(`${webFlow.flowKey}: start`);

            let wasSnapshotBlocked = false as boolean;

            const params: Omit<PhaseRunParams<Context>, 'phaseStartedAt'> = {
                ...browserParams,
                originalUrl: webFlow.startUrl,
                page,
                webFlowStartedAt,
                webFlowKey: webFlow.flowKey,
                silent: !!options.silent,
                blockSnapshot(shouldBlockSnapshot) {
                    wasSnapshotBlocked = shouldBlockSnapshot;
                },
            };

            const phaseOutputs: (undefined | Output)[] = [];

            const webSnapInProgress: InProgressWebSnap = {
                webFlow: {
                    flowKey: webFlow.flowKey,
                    startUrl: webFlow.startUrl,
                    phaseNames: webFlow.phaseNames,
                },
                generatedAt: getNowInIsoString(),
                phaseSnaps: [],
            };

            try {
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
                        const error = checkWrap.instanceOf(phaseResult, Error);

                        const {disableSnapshot, output}: PhaseRunResult<Output> =
                            checkWrap.notInstanceOf(phaseResult, Error) || {
                                disableSnapshot: false,
                                output: undefined,
                            };

                        phaseOutputs.push(output);

                        if (
                            !wasSnapshotBlocked &&
                            !options.disableSnapshots &&
                            !phase.disableSnapshot &&
                            !disableSnapshot
                        ) {
                            const rawHtml = await getAllPageHtml(page, browserParams.storeKey);
                            const finalHtml = phase.sanitizeSnapshot
                                ? await phase.sanitizeSnapshot({
                                      ...phaseParams,
                                      get dom() {
                                          return new JSDOM(rawHtml);
                                      },
                                      domString: rawHtml,
                                  })
                                : rawHtml;

                            webSnapInProgress.phaseSnaps.push({
                                pageHtml: check.isString(finalHtml)
                                    ? finalHtml
                                    : finalHtml.serialize(),
                                phaseName: phase.name,
                            });
                        }

                        if (error) {
                            throw error;
                        }
                    } catch (error) {
                        throw ensureErrorAndPrependMessage(
                            error,
                            `Phase '${phase.name}' in WebFlow '${webFlow.flowKey}' failed:`,
                        );
                    }
                }
            } finally {
                if (webSnapInProgress.phaseSnaps.length && options.webSnapDirPath) {
                    await saveWebSnap(webFlow, webSnapInProgress, !!options.silent);
                }
            }

            return phaseOutputs;
        } catch (error) {
            throw ensureErrorAndPrependMessage(error, `WebFlow '${webFlow.flowKey}' failed:`);
        }
    } finally {
        if (createdPage) {
            await page.close();
        }
    }
}
