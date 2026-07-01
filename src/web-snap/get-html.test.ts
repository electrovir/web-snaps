import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {join} from 'node:path';
import {withBrowserContext} from '../browser/run-browser.js';
import {userDataDirPath} from '../repo-paths.mock.js';
import {getAllPageHtml} from './get-html.js';

const openShadowContent = 'open-shadow-content-marker';
const closedShadowContent = 'closed-shadow-content-marker';

/**
 * Split a marker across a string concatenation so the full marker literal never appears in the
 * fixture's inline `<script>` source. The script's text content is itself serialized into the
 * snapshot, so an un-split marker would satisfy the `includes` assertions regardless of whether the
 * shadow root was actually captured. Only the rendered shadow `<span>` should hold the full
 * marker.
 */
function embedMarkerInScript(marker: string): string {
    const midpoint = Math.ceil(marker.length / 2);
    return `'${marker.slice(0, midpoint)}' + '${marker.slice(midpoint)}'`;
}

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
            `'<span>' + ${embedMarkerInScript(openShadowContent)} + '</span>';`,
            "document.getElementById('closed-host').attachShadow({mode: 'closed'}).innerHTML =",
            `'<span>' + ${embedMarkerInScript(closedShadowContent)} + '</span>';`,
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
            async ({browserContext}) => {
                const page = browserContext.pages()[0] ?? (await browserContext.newPage());
                await page.goto(shadowFixtureUrl, {
                    waitUntil: 'domcontentloaded',
                });
                const cdpSession = await page.context().newCDPSession(page);
                try {
                    return await getAllPageHtml(cdpSession);
                } finally {
                    await cdpSession.detach();
                }
            },
        );
    } finally {
        delete process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE;
    }
}

describe(getAllPageHtml.name, () => {
    it('captures open and closed shadow DOM', async () => {
        const html = await snapshotShadowFixture(undefined);

        assert.isTrue(html.includes(openShadowContent), 'open shadow content missing');
        assert.isTrue(html.includes(closedShadowContent), 'closed shadow content missing');
    });

    it('captures closed shadow DOM even in an isolated world', async () => {
        const html = await snapshotShadowFixture('alwaysIsolated');

        /** CDP reads the DOM from the browser, so the JavaScript world does not matter. */
        assert.isTrue(html.includes(openShadowContent), 'open shadow content missing');
        assert.isTrue(html.includes(closedShadowContent), 'closed shadow content missing');
    });
});
