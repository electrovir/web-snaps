import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {join} from 'node:path';
import {withBrowserContext} from '../browser/run-browser.js';
import {userDataDirPath} from '../repo-paths.mock.js';
import {getAllPageHtml} from './get-html.js';

const openShadowContent = 'open-shadow-content-marker';
const closedShadowContent = 'closed-shadow-content-marker';

/**
 * A page whose inline script attaches both an open and a closed shadow root, each holding a unique
 * marker string, so a snapshot can be checked for the presence of each.
 */
const shadowFixtureUrl = [
    'data:text/html,',
    encodeURIComponent(
        [
            '<!doctype html>',
            '<html><body>',
            '<div id="open-host"></div>',
            '<div id="closed-host"></div>',
            '<script>',
            "document.getElementById('open-host').attachShadow({mode: 'open'}).innerHTML =",
            `'<span>${openShadowContent}</span>';`,
            "document.getElementById('closed-host').attachShadow({mode: 'closed'}).innerHTML =",
            `'<span>${closedShadowContent}</span>';`,
            '</script>',
            '</body></html>',
        ].join(''),
    ),
].join('');

async function snapshotShadowFixture(runtimeFixMode: string | undefined): Promise<string> {
    if (runtimeFixMode) {
        process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = runtimeFixMode;
    } else {
        delete process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE;
    }

    try {
        return await withBrowserContext(
            {
                context: undefined,
                userDataDirPath: join(userDataDirPath, `get-html-${runtimeFixMode || 'default'}`),
            },
            async ({browserContext, storeKey}) => {
                const page = browserContext.pages()[0] ?? (await browserContext.newPage());
                await page.goto(shadowFixtureUrl, {
                    waitUntil: 'domcontentloaded',
                });
                return await getAllPageHtml(page, storeKey);
            },
        );
    } finally {
        delete process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE;
    }
}

describe(getAllPageHtml.name, () => {
    it('captures open and closed shadow DOM in the main world', async () => {
        const html = await snapshotShadowFixture(undefined);

        assert.isTrue(html.includes(openShadowContent), 'open shadow content missing');
        assert.isTrue(html.includes(closedShadowContent), 'closed shadow content missing');
    });

    it('falls back to open shadow DOM only when evaluated in an isolated world', async () => {
        const html = await snapshotShadowFixture('alwaysIsolated');

        /** The main-world closed-shadow store is unreachable here, so it must not throw. */
        assert.isTrue(html.includes(openShadowContent), 'open shadow content missing');
        assert.isFalse(
            html.includes(closedShadowContent),
            'closed shadow content unexpectedly captured from an isolated world',
        );
    });
});
