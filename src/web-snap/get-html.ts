import {type AnyObject} from '@augment-vir/common';
import {type Page} from 'rebrowser-playwright';
import {type RequireExactlyOne} from 'type-fest';
import {type DataStore} from '../browser/data-store.js';

/**
 * Extract all HTML from a Playwright Page, including all shadow DOM HTML, even from closed shadow
 * roots! This requires a browser page that has been started with `withBrowserContext`,
 * `setupBrowser`, or `initBrowser` from this package.
 *
 * @category Internal
 */
export async function getAllPageHtml(
    page: Readonly<Page>,
    storeKey: string,
    includeComments: boolean = false,
): Promise<string> {
    const response = await page.evaluate(
        ({
            storeKey,
            includeComments,
        }): RequireExactlyOne<{error: string; result: string}> & {debug?: unknown} => {
            /** Extracted from `@augment-vir/common`. */
            function extractErrorMessage(maybeError: unknown) {
                if (!maybeError) {
                    return '';
                } else if (maybeError instanceof Error) {
                    return maybeError.message;
                } else if (typeof maybeError === 'object' && 'message' in maybeError) {
                    return String(maybeError.message);
                } else if (typeof maybeError === 'string') {
                    return maybeError;
                } else {
                    return JSON.stringify(maybeError);
                }
            }

            try {
                const dataStore = (globalThis as AnyObject)[storeKey] as DataStore;

                if (!(dataStore as DataStore | undefined)) {
                    throw new Error('missing data store');
                }

                /** A set of HTML void elements that should not have a closing tag. */
                const VOID_ELEMENTS = new Set([
                    'area',
                    'base',
                    'br',
                    'col',
                    'embed',
                    'hr',
                    'img',
                    'input',
                    'link',
                    'meta',
                    'param',
                    'source',
                    'track',
                    'wbr',
                ]);

                /**
                 * Recursively serializes a DOM Node into its HTML string representation (like
                 * outerHTML).
                 *
                 * @param {Node} node The DOM Node to serialize.
                 * @returns {string} The HTML string for the node.
                 */
                function serializeNode(node: Readonly<Node>) {
                    if (node instanceof Element) {
                        const tagName = node.tagName.toLowerCase();
                        let html = `<${tagName}`;

                        // Add attributes
                        for (const attr of node.attributes) {
                            html += ` ${attr.name}="${attr.value}"`;
                        }

                        // Handle void elements which don't have children or a closing tag
                        if (VOID_ELEMENTS.has(tagName)) {
                            html += '>';
                            return html;
                        }

                        // Add children for non-void elements
                        html += `>${getInnerHTML(node)}</${tagName}>`;
                        return html;
                    } else if (node instanceof Text) {
                        // For text nodes, escape the content and return it
                        return node.textContent || '';
                    } else if (node instanceof Comment) {
                        if (includeComments) {
                            return `<!--${node.textContent}-->`;
                        } else {
                            return '';
                        }
                    } else if (node instanceof DocumentFragment) {
                        return getInnerHTML(node);
                    } else if (node instanceof DocumentType) {
                        return `<!doctype ${node.name}>`;
                    } else {
                        return '';
                    }
                }

                /**
                 * Creates an innerHTML-like string for any given DOM Node without using the
                 * .innerHTML property.
                 *
                 * @param {Node} node The DOM node whose inner HTML should be generated.
                 * @returns {string} A string representing the inner HTML of the node.
                 */
                function getInnerHTML(node: Node): string {
                    const shadowRoot: ShadowRoot | undefined =
                        dataStore.closedShadows.get(node) ||
                        (node instanceof Element && node.shadowRoot) ||
                        undefined;
                    const allChildren = [
                        ...(shadowRoot?.childNodes || []),
                        ...node.childNodes,
                    ];

                    if (!allChildren.length) {
                        return '';
                    }

                    let innerHTMLString = '';
                    // Iterate over all child nodes
                    for (const child of allChildren) {
                        // Serialize each child node and append it to the result
                        innerHTMLString += serializeNode(child);
                    }

                    return innerHTMLString;
                }

                return {
                    result: getInnerHTML(document),
                };
            } catch (error) {
                return {
                    error: extractErrorMessage(error),
                };
            }
        },
        {
            storeKey,
            includeComments,
        },
    );
    if ('debug' in response) {
        console.info(response.debug);
    }
    if ('error' in response) {
        throw new Error(response.error);
    } else {
        return response.result;
    }
}
