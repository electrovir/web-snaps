import {assert} from '@augment-vir/assert';
import {collapseWhiteSpace} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {existsSync} from 'node:fs';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {
    convertTemplateToString,
    defineSnapSuite,
    type JSDOM,
    loadWebSnap,
    type PhaseRunParams,
    type SanitizeSnapshotParams,
    type WebFlow,
} from '../index.js';
import {testSnapshotDirPath, userDataDirPath} from '../repo-paths.mock.js';
import {loadPhaseSnapshot} from '../web-snap/load-web-snap.js';
import {
    type MockContext,
    mockContext,
    type MockOutput,
    mockSnapSuite,
    mockWebFlows,
} from './snap-suite.mock.js';

describe(defineSnapSuite.name, () => {
    it('defines type safe WebFlows', () => {
        assert.tsType(mockWebFlows).equals<
            Readonly<
                [
                    WebFlow<
                        MockContext,
                        MockOutput,
                        {
                            readonly flowKey: 'mock-web-flow-1';
                            readonly startUrl: 'https://example.com';
                            readonly phases: [
                                {
                                    readonly name: 'initial load';
                                    readonly run: ({
                                        page,
                                    }: Readonly<PhaseRunParams<MockContext>>) => Promise<void>;
                                },
                                {
                                    readonly name: 'iana site';
                                    readonly run: ({
                                        page,
                                    }: Readonly<PhaseRunParams<MockContext>>) => Promise<{
                                        output: {
                                            wordCount: number;
                                        };
                                    }>;
                                },
                            ];
                        }
                    >,
                    WebFlow<
                        MockContext,
                        MockOutput,
                        {
                            readonly flowKey: 'mock-web-flow-2';
                            readonly startUrl: 'https://example.com';
                            readonly phases: [
                                {
                                    readonly name: 'initial load';
                                    readonly sanitizeSnapshot: ({
                                        dom,
                                    }: SanitizeSnapshotParams<MockContext>) => JSDOM;
                                    readonly run: ({
                                        page,
                                    }: Readonly<PhaseRunParams<MockContext>>) => Promise<void>;
                                },
                                {
                                    readonly name: 'iana site';
                                    readonly sanitizeSnapshot: ({
                                        domString,
                                    }: SanitizeSnapshotParams<MockContext>) => string;
                                    readonly run: ({
                                        page,
                                    }: Readonly<PhaseRunParams<MockContext>>) => Promise<{
                                        output: MockOutput;
                                    }>;
                                },
                            ];
                        }
                    >,
                ]
            >
        >();

        assert.tsType<(typeof mockWebFlows)[0]['ContextType']>().equals<MockContext>();
        assert.tsType<(typeof mockWebFlows)[0]['OutputType']>().equals<MockOutput>();
        assert.tsType<(typeof mockWebFlows)[0]['flowKey']>().equals<'mock-web-flow-1'>();

        assert.tsType<(typeof mockWebFlows)[0]['phaseNames']>().equals<{
            'initial load': 'initial load';
            'iana site': 'iana site';
        }>();
        assert.deepEquals(mockWebFlows[0].phaseNames, {
            'initial load': 'initial load',
            'iana site': 'iana site',
        });

        assert.tsType<(typeof mockWebFlows)[0]['webSnapPaths']>().equals<
            | undefined
            | {
                  ts: string;
                  js: string;
              }
        >();
        assert.deepEquals(mockWebFlows[0].webSnapPaths, {
            ts: join(testSnapshotDirPath, 'mock-web-flow-1.mock.ts'),
            js: join(testSnapshotDirPath, 'mock-web-flow-1.mock.js'),
        });
    });

    it('prevents access to type-only properties', () => {
        assert.throws(() => mockWebFlows[0].ContextType);
        assert.throws(() => mockWebFlows[0].OutputType);
    });

    it('runs web flows', async () => {
        await rm(testSnapshotDirPath, {recursive: true, force: true});
        assert.isLengthAtLeast(mockWebFlows, 1);

        const outputs = await mockSnapSuite.runWebFlows({
            context: mockContext,
            webFlows: mockWebFlows,
            userDataDirPath,
        });
        assert.deepEquals(outputs, [
            [
                undefined,
                {
                    wordCount: 115,
                },
            ],
            [
                undefined,
                {
                    wordCount: 115,
                },
            ],
        ]);

        /**
         * # ================
         *
         * Test that snapshot files were created.
         */
        mockWebFlows.forEach((mockWebFlow) => {
            assert.isDefined(mockWebFlow.webSnapPaths);
            assert.isTrue(
                existsSync(mockWebFlow.webSnapPaths.ts),
                `file does not exist: ${mockWebFlow.webSnapPaths.ts}`,
            );
        });

        /**
         * # ================
         *
         * Test that snapshots were sanitized.
         */
        const webSnap2 = await loadWebSnap(mockWebFlows[1]);
        assert.isLengthExactly(webSnap2.phaseSnaps, 2);
        assert.hasValue(
            collapseWhiteSpace(convertTemplateToString(webSnap2.phaseSnaps[0].pageHtml)),
            '<p>REDACTED</p>',
        );
        assert.hasValue(
            collapseWhiteSpace(convertTemplateToString(webSnap2.phaseSnaps[1].pageHtml)),
            '<p>REDACTED</p>',
        );

        /**
         * # ================
         *
         * Test that snapshots can be loaded into a browser.
         */
        const {dom} = await loadPhaseSnapshot(
            mockWebFlows[1],
            mockWebFlows[1].phaseNames['iana site'],
        );
        assert.isDefined(
            dom.window.document.evaluate(
                '//*[text()="REDACTED"]',
                dom.window.document,
                null,
                dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE,
            ),
        );
    });
});
