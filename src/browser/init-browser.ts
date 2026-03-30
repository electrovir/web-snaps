import {type Truthy} from '@augment-vir/assert';
import {type AnyFunction, type AnyObject} from '@augment-vir/common';
import {type QueryThroughShadowOptions} from '@augment-vir/web';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'rebrowser-playwright';
import {type DataStore} from './data-store.js';

/**
 * Options for initializing a persistent browser content.
 *
 * @category Internal
 */
export type BrowserOptions = Parameters<typeof chromium.launchPersistentContext>[1];

/**
 * Initialize a browser and browser context with scripts inserted for handling elements with closed
 * Shadow DOMs.
 *
 * @category Internal
 */
export async function initBrowser({
    userDataDirPath,
    storeKey,
    options = {},
}: {
    userDataDirPath: string;
    storeKey: string;
    options?: Readonly<BrowserOptions> | undefined;
}) {
    await mkdir(userDataDirPath, {
        recursive: true,
    });

    /** WebKit is typically faster but `rebrowser-playwright` seems to only work with Chromium. */
    const browserContext = await chromium.launchPersistentContext(userDataDirPath, options);
    try {
        browserContext.setDefaultTimeout(10_000);

        await browserContext.addInitScript((storeKey) => {
            /** https://github.com/evanw/esbuild/issues/2605#issuecomment-2146054255 */
            (globalThis as any).__name = (func: AnyFunction) => func;

            const dataStore: DataStore = {
                closedShadows: new Map(),
                queryThroughShadow,
            };

            function getShadowRoot(node: Node): ShadowRoot | undefined {
                return node instanceof HTMLElement && node.shadowRoot
                    ? node.shadowRoot
                    : dataStore.closedShadows.get(node);
            }

            /** Copied from @augment-vir/web and modified to support closed Shadow Roots. */
            function queryThroughShadow(
                element: Element | ShadowRoot,
                query: string | {tagName: string},
                options: {
                    all: true;
                },
            ): Element[];
            function queryThroughShadow(
                element: Element | ShadowRoot,
                query: string | {tagName: string},
                options?: {
                    all?: false | undefined;
                },
            ): Element | undefined;
            function queryThroughShadow(
                element: Element | ShadowRoot,
                query: string | {tagName: string},
                options?: QueryThroughShadowOptions,
            ): Element | Element[] | undefined;
            /**
             * Perform
             * [`.querySelector()`](https://developer.mozilla.org/docs/Web/API/Document/querySelector)
             * on the given element with support for elements that contain an open Shadow Root.
             *
             * @category Web : Elements
             * @category Package : @augment-vir/web
             * @package [`@augment-vir/web`](https://www.npmjs.com/package/@augment-vir/web)
             */
            function queryThroughShadow(
                element: Element | ShadowRoot,
                rawQuery: string | {tagName: string},
                options: QueryThroughShadowOptions = {},
            ): Element | Element[] | undefined {
                if (!rawQuery) {
                    if (element instanceof Element) {
                        return element;
                    } else {
                        return element.host;
                    }
                }
                const query: string = typeof rawQuery === 'string' ? rawQuery : rawQuery.tagName;

                const splitQuery: string[] = query.split(' ').filter((value) => !!value);
                const shadowRoot = getShadowRoot(element);

                if (splitQuery.length > 1) {
                    return handleNestedQueries(element, query, options, splitQuery);
                } else if (shadowRoot) {
                    return queryThroughShadow(shadowRoot, query, options);
                }

                const shadowRootChildren = getShadowRootChildren(element);

                if (options.all) {
                    const outerResults = Array.from(element.querySelectorAll(query));
                    const nestedResults = shadowRootChildren.flatMap((shadowRootChild) => {
                        return queryThroughShadow(shadowRootChild, query, options) as Element[];
                    });
                    return [
                        ...outerResults,
                        ...nestedResults,
                    ];
                } else {
                    const basicResult = element.querySelector(query);

                    if (basicResult) {
                        return basicResult;
                    } else {
                        for (const shadowRootChild of shadowRootChildren) {
                            const nestedResult = queryThroughShadow(
                                shadowRootChild,
                                query,
                                options,
                            );
                            if (nestedResult) {
                                return nestedResult;
                            }
                        }

                        return undefined;
                    }
                }
            }
            function getShadowRootChildren(element: Element | ShadowRoot) {
                return Array.from(element.querySelectorAll('*'))
                    .map((child) => getShadowRoot(child))
                    .filter((value): value is Truthy<typeof value> => !!value);
            }
            function handleNestedQueries(
                element: Element | ShadowRoot,
                originalQuery: string | {tagName: string},
                options: QueryThroughShadowOptions,
                queries: string[],
            ): Element | Element[] | undefined {
                const firstQuery = queries[0];

                /**
                 * No way to intentionally trigger this edge case, we're just catching it here for
                 * type purposes.
                 */
                /* node:coverage ignore next 7 */
                if (!firstQuery) {
                    throw new Error(
                        `Somehow the first query was empty in '[${queries.join(',')}]' for query '${JSON.stringify(originalQuery)}'`,
                    );
                }
                const results = queryThroughShadow(element, firstQuery, options);

                if (queries.length <= 1) {
                    return results;
                } else if (Array.isArray(results)) {
                    return results
                        .flatMap((result) => {
                            return handleNestedQueries(
                                result,
                                originalQuery,
                                options,
                                queries.slice(1),
                            );
                        })
                        .filter((value): value is Truthy<typeof value> => !!value);
                } else if (results) {
                    return handleNestedQueries(results, originalQuery, options, queries.slice(1));
                } else {
                    return undefined;
                }
            }
            ((globalThis as AnyObject)[storeKey] as DataStore) = dataStore;
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const original = Element.prototype.attachShadow;

            Element.prototype.attachShadow = function (init) {
                const shadow = original.call(this, init);

                if (init.mode === 'closed') {
                    dataStore.closedShadows.set(this, shadow);
                }

                return shadow;
            };
        }, storeKey);

        return {
            browserContext,
        };
    } catch (error) {
        await browserContext.close();
        throw error;
    }
}
