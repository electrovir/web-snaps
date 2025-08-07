import {assert, assertWrap} from '@augment-vir/assert';
import {collapseWhiteSpace} from '@augment-vir/common';
import {testSnapshotDirPath} from '../repo-paths.mock.js';
import {defineSnapSuite} from '../snap-suite/snap-suite.js';

export type MockContext = {
    something: number;
};

export const mockContext: Readonly<MockContext> = {
    something: 42,
};

export type MockOutput = {wordCount: number};

export const mockSnapSuite = defineSnapSuite<MockContext, MockOutput>(testSnapshotDirPath);

const {defineWebFlow} = mockSnapSuite;

export const mockWebFlows = [
    defineWebFlow({
        flowKey: 'mock-web-flow-1',
        startUrl: 'https://example.com',
        phases: [
            {
                name: 'initial load',
                async run({page}) {
                    await page.getByText('example domain').waitFor({state: 'visible'});
                },
            },
            {
                name: 'iana site',
                async run({page, context}) {
                    assert.tsType(context).equals<MockContext>();
                    assert.deepEquals(context, mockContext);
                    assert.strictEquals(context, mockContext);
                    await page.getByText('more information...').click();
                    await page.getByText('example domains').first().waitFor({state: 'visible'});
                    return {
                        output: {
                            wordCount: collapseWhiteSpace(
                                (await page.locator('.help-article').textContent()) || '',
                            ).split(' ').length,
                        },
                    };
                },
            },
        ],
    }),
    defineWebFlow({
        flowKey: 'mock-web-flow-2',
        startUrl: 'https://example.com',
        phases: [
            {
                name: 'initial load',
                /** Test sanitization through DOM manipulation. */
                sanitizeSnapshot({dom}) {
                    assertWrap.isDefined(dom.window.document.querySelector('p')).innerHTML =
                        'REDACTED';

                    return dom;
                },
                async run({page}) {
                    await page.getByText('example domain').waitFor({state: 'visible'});
                },
            },
            {
                name: 'iana site',
                /** Test sanitization through string manipulation. */
                sanitizeSnapshot({domString}) {
                    return domString.replace(/We provide a web service[^<]+/, 'REDACTED');
                },
                async run({page, context}) {
                    assert.tsType(context).equals<MockContext>();
                    assert.deepEquals(context, mockContext);
                    assert.strictEquals(context, mockContext);
                    await page.getByText('more information...').click();
                    await page.getByText('example domains').first().waitFor({state: 'visible'});
                    return {
                        output: {
                            wordCount: collapseWhiteSpace(
                                (await page.locator('.help-article').textContent()) || '',
                            ).split(' ').length,
                        },
                    };
                },
            },
        ],
    }),
] as const;
