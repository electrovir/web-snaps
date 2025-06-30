import {
    awaitedForEach,
    chunkArray,
    type MaybePromise,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {join} from 'node:path';
import {type InitBrowserOptions} from '../browser/init-browser.js';
import {type LoadedBrowser} from '../browser/loaded-browser.js';
import {withBrowserContext} from '../browser/run-browser.js';
import {runWebFlow, type RunWebFlowOptions} from '../web-flow/run-web-flow.js';
import {createPhaseNamesEnum, type WebFlow, type WebFlowInit} from '../web-flow/web-flow.js';

/**
 * Options for {@link runWebFlows}.
 *
 * @category Internal
 */
export type RunWebFlowsOptions = RunWebFlowOptions &
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
    /** Defines a {@link WebFlow} with the suite's `Context` and `Output` type parameters already set. */
    defineWebFlow<const Init extends Readonly<WebFlowInit<Context, Output>>>(
        this: void,
        init: Init,
    ): WebFlow<Context, Output, Init>;
    /**
     * Executes multiple {@link WebFlow} instances with the suite's `Context` and `Output` type
     * parameters already set.
     */
    runWebFlows(
        this: void,
        context: Context,
        webFlows: ReadonlyArray<Readonly<WebFlow<Context, Output>>>,
        options?: Readonly<Omit<RunWebFlowsOptions, 'webSnapDirPath'>>,
    ): Promise<(Output | undefined)[]>;
    /** Runs {@link withBrowserContext} with the suite's `Context` type parameter already set. */
    withBrowserContext<T = void>(
        context: Context,
        /** Calls this callback and then automatically closes the browser afterwards. */
        callback: (params: Readonly<LoadedBrowser<Context>>) => MaybePromise<T>,
        options?: Readonly<PartialWithUndefined<InitBrowserOptions>>,
    ): Promise<T>;
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
        async runWebFlows(
            this: void,
            context: Context,
            webFlows: ReadonlyArray<Readonly<WebFlow<Context, Output>>>,
            options: Readonly<Omit<RunWebFlowsOptions, 'webSnapDirPath'>> = {},
        ) {
            return runWebFlows<Context, Output>(context, webFlows, {
                ...options,
                webSnapDirPath,
            } as RunWebFlowsOptions);
        },
        /** Runs {@link withBrowserContext} with the suite's `Context` type parameter already set. */
        async withBrowserContext<T = void>(
            context: Context,
            /** Calls this callback and then automatically closes the browser afterwards. */
            callback: (params: Readonly<LoadedBrowser<Context>>) => MaybePromise<T>,
            options: Readonly<PartialWithUndefined<InitBrowserOptions>> = {},
        ) {
            return await withBrowserContext(context, callback, options);
        },
    };
}

/**
 * Runs an array of {@link WebFlow} instances. Use {@link defineSnapSuite} instead of calling this
 * function directly for cleaner Type Parameter inference.
 *
 * @category Internal
 */
export async function runWebFlows<Context, Output>(
    context: Context,
    webFlows: ReadonlyArray<Readonly<WebFlow<Context, Output>>>,
    options: Readonly<RunWebFlowsOptions>,
): Promise<(Output | undefined)[]> {
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

    return await withBrowserContext(context, async (browserParams) => {
        const chunks = chunkArray(webFlows, {
            chunkSize: options.serial ? 1 : options.batchSize || 10,
        });

        const outputs: (Output | undefined)[] = [];

        await awaitedForEach(chunks, async (chunk) => {
            const chunkOutputs = await Promise.all(
                chunk.map(async (webFlow) => {
                    return await runWebFlow<Context, Output>(browserParams, webFlow, options);
                }),
            );
            outputs.push(...chunkOutputs);
        });

        return outputs;
    });
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
    return {
        ...init,
        phaseNames: createPhaseNamesEnum(init),
        webSnapPaths: webSnapDirPath
            ? {
                  ts: join(webSnapDirPath, init.flowKey + '.mock.ts'),
                  js: join(webSnapDirPath, init.flowKey + '.mock.js'),
              }
            : undefined,
        get ContextType(): Context {
            throw new Error('Cannot read ContextType as a runtime value: it is a type only.');
        },
        get OutputType(): Output {
            throw new Error('Cannot read OutputType as a runtime value: it is a type only.');
        },
    };
}
