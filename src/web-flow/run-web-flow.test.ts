import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {join} from 'node:path';
import {userDataDirPath} from '../repo-paths.mock.js';
import {defineSnapSuite} from '../snap-suite/snap-suite.js';

function createFixtureUrl(marker: string): string {
    return [
        'data:text/html,',
        encodeURIComponent(`<!doctype html><html><body><h1>${marker}</h1></body></html>`),
    ].join('');
}

/** Where the reused page already sits before the flow runs. */
const existingPageUrl = createFixtureUrl('existing-page');
/** The flow's declared `startUrl`, which the page is deliberately not on to begin with. */
const startUrl = createFixtureUrl('start-page');

const suite = defineSnapSuite<undefined, undefined>();

/**
 * Runs a single-phase flow on a page that is already on {@link existingPageUrl} and reports what
 * that phase saw, so the assertions can tell whether `runWebFlow` navigated to `startUrl` first.
 */
async function runObservedFlow(
    skipStartNavigation: boolean | undefined,
): Promise<{phasePageUrl: string | undefined; phaseOriginalUrl: string | undefined}> {
    return await suite.withBrowserContext(
        {
            context: undefined,
            userDataDirPath: join(
                userDataDirPath,
                `run-web-flow-skip-${String(skipStartNavigation)}`,
            ),
        },
        async (browserParams) => {
            const page =
                browserParams.browserContext.pages()[0] ??
                (await browserParams.browserContext.newPage());
            await page.goto(existingPageUrl);

            const observed: {phasePageUrl: string; phaseOriginalUrl: string}[] = [];

            await suite.runWebFlow({
                browserParams,
                webFlow: suite.defineWebFlow({
                    flowKey: 'skip-start-navigation-flow',
                    startUrl,
                    phases: [
                        {
                            name: 'observe location',
                            run({page, originalUrl}) {
                                observed.push({
                                    phasePageUrl: page.url(),
                                    phaseOriginalUrl: originalUrl,
                                });
                            },
                        },
                    ],
                }),
                options: {
                    existingPage: page,
                    silent: true,
                    skipStartNavigation,
                },
            });

            return {
                phasePageUrl: observed[0]?.phasePageUrl,
                phaseOriginalUrl: observed[0]?.phaseOriginalUrl,
            };
        },
    );
}

describe('runWebFlow', () => {
    it('navigates to startUrl before the first phase by default', async () => {
        assert.deepEquals(await runObservedFlow(undefined), {
            phasePageUrl: startUrl,
            phaseOriginalUrl: startUrl,
        });
    });

    it('leaves the page where it is when skipStartNavigation is set', async () => {
        assert.deepEquals(await runObservedFlow(true), {
            phasePageUrl: existingPageUrl,
            /** `originalUrl` still reports the declared `startUrl` so a phase can navigate itself. */
            phaseOriginalUrl: startUrl,
        });
    });
});
