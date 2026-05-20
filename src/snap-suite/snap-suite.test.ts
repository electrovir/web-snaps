import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {
    defineSnapSuite,
    type PhaseRunParams,
    type WebFlow,
    type WebFlowPhaseResult,
} from '../index.js';
import {userDataDirPath} from '../repo-paths.mock.js';
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
                                        wordCount: number;
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
                                    readonly run: ({
                                        page,
                                    }: Readonly<PhaseRunParams<MockContext>>) => Promise<void>;
                                },
                                {
                                    readonly name: 'iana site';
                                    readonly run: ({
                                        page,
                                    }: Readonly<PhaseRunParams<MockContext>>) => Promise<{
                                        wordCount: number;
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
    });

    it('prevents access to type-only properties', () => {
        assert.throws(() => mockWebFlows[0].ContextType);
        assert.throws(() => mockWebFlows[0].OutputType);
    });

    it('runs web flows', async () => {
        assert.isLengthAtLeast(mockWebFlows, 1);

        const results = await mockSnapSuite.runWebFlows({
            context: mockContext,
            webFlows: mockWebFlows,
            userDataDirPath,
        });

        assert.tsType(results).equals<WebFlowPhaseResult<MockOutput>[][]>();
        assert.isLengthExactly(results, 2);

        /**
         * # ================
         *
         * Test outputs.
         */
        assert.deepEquals(
            results.map((flowResults) => {
                return flowResults.map((phaseResult) => {
                    return phaseResult.output;
                });
            }),
            [
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
            ],
        );

        /**
         * # ================
         *
         * Test that every phase has a snapshot string.
         */
        results.forEach((flowResults) => {
            flowResults.forEach((phaseResult) => {
                assert.isDefined(phaseResult.snapshot);
                assert.isNotEmpty(phaseResult.snapshot);
                assert.instanceOf(phaseResult.screenshot, Buffer);
                assert.isAbove(phaseResult.screenshot.length, 0);
                assert.isDefined(phaseResult.finalPageUrl);
                assert.isNotEmpty(phaseResult.finalPageUrl);
                assert.isNotEmpty(phaseResult.phaseName);
            });
        });
    });
});
