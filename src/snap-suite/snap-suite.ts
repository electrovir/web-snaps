import {
    awaitedForEach,
    chunkArray,
    ensureError,
    type MaybePromise,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {join} from 'node:path';
import {type BrowserOptions} from '../browser/init-browser.js';
import {type LoadedBrowser} from '../browser/loaded-browser.js';
import {setupBrowser, withBrowserContext, type BrowserSetupParams} from '../browser/run-browser.js';
import {
    runWebFlow,
    type RunWebFlowOptions,
    type RunWebFlowParams,
} from '../web-flow/run-web-flow.js';
import {createPhaseNamesEnum, type WebFlow, type WebFlowInit} from '../web-flow/web-flow.js';

/**
 * Options for {@link runWebFlows}.
 *
 * @category Internal
 */
export type RunWebFlowsOptions = PartialWithUndefined<{
    /** Runs before the WebFlows start. */
    preHook: (params: Readonly<Pick<LoadedBrowser<any>, 'browserContext'>>) => MaybePromise<void>;
    /** Runs after the WebFlows finish, even if they error out. */
    postHook: (
        params: Readonly<
            Pick<LoadedBrowser<any>, 'browserContext'> & {
                /** If any WebFlow errored out, this is populated with that error. */
                error?: undefined | Error;
            }
        >,
    ) => MaybePromise<void>;

    browserOptions: Readonly<BrowserOptions>;
}> & {
    userDataDirPath: string;
} & RunWebFlowOptions &
    (
        | {
              /**
               * Run all given WebFlows in serial rather than in parallel. By default, all WebFlows
               * are executed in parallel.
               *
               * @default false
               */
              serial?: undefined | false;
              /**
               * Number of WebFlows to run at once (in parallel). Only relevant when `serial` is not
               * set to `true`.
               *
               * @default 10
               */
              batchSize: number;
          }
        | {
              /**
               * Run all given WebFlows in serial rather than in parallel. By default, all WebFlows
               * are executed in parallel.
               *
               * @default false
               */
              serial: true;
              /**
               * Number of WebFlows to run at once (in parallel). Only relevant when `serial` is not
               * set to `true`.
               *
               * @default 10
               */
              batchSize?: never;
          }
    );

/**
 * The output of {@link defineSnapSuite}.
 *
 * @category Internal
 */
export type SnapSuite<Context, Output> = {
    /**
     * Defines a {@link WebFlow} with the suite's `Context` and `Output` type parameters and
     * `webSnapDirPath` option already set.
     */
    defineWebFlow<const Init extends Readonly<WebFlowInit<Context, Output>>>(
        this: void,
        init: Init,
    ): WebFlow<Context, Output, Init>;
    /**
     * Executes a single {@link WebFlow} with the suite's `Context` and `Output` type parameters and
     * `webSnapDirPath` option already set.
     */
    runWebFlow(
        this: void,
        params: RunWebFlowParams<Context, Output>,
    ): Promise<(Output | undefined)[]>;
    /**
     * Executes multiple {@link WebFlow} instances with the suite's `Context` and `Output` type
     * parameters and `webSnapDirPath` option already set.
     */
    runWebFlows(
        this: void,
        params: RunWebFlowsParams<Context, Output>,
    ): Promise<(Output | undefined)[][]>;
    /** Runs {@link withBrowserContext} with the suite's `Context` type parameter already set. */
    withBrowserContext<T = void>(
        this: void,
        params: BrowserSetupParams<Context>,
        /** Calls this callback and then automatically closes the browser afterwards. */
        callback: (params: Readonly<LoadedBrowser<Context>>) => MaybePromise<T>,
    ): Promise<T>;
    /** Runs {@link setupBrowser} with the suite's `Context` type parameter already set. */
    setupBrowser(this: void, params: BrowserSetupParams<Context>): Promise<LoadedBrowser<Context>>;
};

/**
 * Define a suite of WebFlow functions with already set type parameters.
 *
 * @category Main
 */
export function defineSnapSuite<Context, Output>(
    this: void,
    /** Output directory for saved snapshots. Setting this to `undefined` disables snapshots. */
    webSnapDirPath: string | undefined,
): SnapSuite<Context, Output> {
    return {
        /**
         * Executes a single {@link WebFlow} with the suite's `Context` and `Output` type parameters
         * and `webSnapDirPath` option already set.
         */
        runWebFlow(params: Readonly<RunWebFlowParams<Context, Output>>) {
            return runWebFlow({
                ...params,
                options: {
                    webSnapDirPath,
                    ...params.options,
                },
            });
        },
        /**
         * Defines a {@link WebFlow} with the suite's `Context` and `Output` type parameters already
         * set.
         */
        defineWebFlow<const Init extends Readonly<WebFlowInit<Context, Output>>>(
            this: void,
            init: Init,
        ): WebFlow<Context, Output, Init> {
            return defineWebFlow<Context, Output, Init>(init, webSnapDirPath);
        },
        /**
         * Executes multiple {@link WebFlow} instances with the suite's `Context` and `Output` type
         * parameters already set.
         */
        async runWebFlows(this: void, params: RunWebFlowsParams<Context, Output>) {
            return runWebFlows<Context, Output>({
                ...params,
                options: {
                    webSnapDirPath,
                    ...params.options,
                },
            });
        },
        /** Runs {@link withBrowserContext} with the suite's `Context` type parameter already set. */
        async withBrowserContext<T = void>(
            this: void,
            params: BrowserSetupParams<Context>,
            /** Calls this callback and then automatically closes the browser afterwards. */
            callback: (params: Readonly<LoadedBrowser<Context>>) => MaybePromise<T>,
        ) {
            return await withBrowserContext(params, callback);
        },
        setupBrowser(this: void, params) {
            return setupBrowser(params);
        },
    };
}

/**
 * Params for {@link runWebFlows}.
 *
 * @category Internal
 */
export type RunWebFlowsParams<Context, Output> = {
    context: Context;
    webFlows: ReadonlyArray<Readonly<WebFlow<Context, Output>>>;
    userDataDirPath: string;
    options?: Readonly<Omit<RunWebFlowsOptions, 'userDataDirPath'>> | undefined;
};

/**
 * Runs an array of {@link WebFlow} instances. Use {@link defineSnapSuite} instead of calling this
 * function directly for cleaner Type Parameter inference.
 *
 * @category Internal
 */
export async function runWebFlows<Context, Output>({
    context,
    userDataDirPath,
    webFlows,
    options,
}: Readonly<RunWebFlowsParams<Context, Output>>): Promise<(Output | undefined)[][]> {
    const duplicateFlowKeys = webFlows.reduce(
        (accum, webFlow) => {
            if (webFlow.flowKey in accum.allKeys) {
                accum.duplicateKeys.add(webFlow.flowKey);
            } else {
                accum.allKeys.add(webFlow.flowKey);
            }

            return accum;
        },
        {
            allKeys: new Set<string>(),
            duplicateKeys: new Set<string>(),
        },
    ).duplicateKeys;

    if (duplicateFlowKeys.size) {
        throw new Error(`Duplicate WebFlow keys given: ${Array.from(duplicateFlowKeys).join(',')}`);
    }

    return await withBrowserContext(
        {
            context,
            userDataDirPath,
            options: options?.browserOptions,
        },
        async (browserParams) => {
            await options?.preHook?.({
                browserContext: browserParams.browserContext,
            });

            let error: undefined | Error;
            const allWebFlowPhaseOutputs: (Output | undefined)[][] = [];
            try {
                const chunks = chunkArray(webFlows, {
                    chunkSize: options?.serial ? 1 : options?.batchSize || 10,
                });

                await awaitedForEach(chunks, async (chunk) => {
                    const chunkOutputs = await Promise.all(
                        chunk.map(async (webFlow) => {
                            return await runWebFlow<Context, Output>({
                                browserParams,
                                webFlow,
                                options,
                            });
                        }),
                    );
                    allWebFlowPhaseOutputs.push(...chunkOutputs);
                });
            } catch (caught) {
                error = ensureError(caught);
            }
            await options?.postHook?.({
                browserContext: browserParams.browserContext,
                error,
            });
            if (error) {
                throw error;
            }

            return allWebFlowPhaseOutputs;
        },
    );
}

/**
 * Define a full {@link WebFlow}. Use {@link defineSnapSuite} instead of calling this function
 * directly for cleaner Type Parameter inference.
 *
 * @category Internal
 */
export function defineWebFlow<
    Context,
    Output,
    const Init extends Readonly<WebFlowInit<Context, Output>>,
>(
    this: void,
    init: Init,
    /** Directory path for saved snapshots. */
    webSnapDirPath: string | undefined,
): WebFlow<Context, Output, Init> {
    const webFlow: Omit<WebFlow, 'ContextType' | 'OutputType'> = {
        flowKey: init.flowKey,
        phases: init.phases,
        startUrl: init.startUrl,
        phaseNames: createPhaseNamesEnum(init),
        webSnapPaths: webSnapDirPath
            ? {
                  ts: join(webSnapDirPath, init.flowKey + '.mock.ts'),
                  js: join(webSnapDirPath, init.flowKey + '.mock.js'),
              }
            : undefined,
    };

    Object.defineProperties(webFlow, {
        ContextType: {
            configurable: false,
            enumerable: false,
            get(): Context {
                throw new Error('Cannot read ContextType as a runtime value: it is a type only.');
            },
        },
        OutputType: {
            configurable: false,
            enumerable: false,
            get(): Output {
                throw new Error('Cannot read OutputType as a runtime value: it is a type only.');
            },
        },
    });

    return webFlow as WebFlow<Context, Output, Init>;
}
