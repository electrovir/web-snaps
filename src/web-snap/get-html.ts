import {checkWrap} from '@augment-vir/assert';
import {type PartialWithUndefined} from '@augment-vir/common';
import {type CDPSession} from '@electrovir/rebrowser-playwright';

/**
 * The subset of a CDP
 * [`DOM.Node`](https://chromedevtools.github.io/devtools-protocol/tot/DOM/#type-Node) that HTML
 * serialization needs. The full `Protocol.DOM.Node` from Playwright is not exported from the
 * package's public API, so only the consumed fields are declared here. A full `DOM.Node`
 * structurally satisfies this type.
 *
 * @category Internal
 */
export type SerializableDomNode = {
    nodeType: number;
    nodeName: string;
    localName: string;
    nodeValue: string;
} & PartialWithUndefined<{
    /** Element attributes as a flat `[name1, value1, name2, value2]` array. */
    attributes: string[];
    children: SerializableDomNode[];
    /** Shadow roots hosted by this element. CDP includes closed shadow roots here. */
    shadowRoots: SerializableDomNode[];
}>;

/** Standard DOM `nodeType` values that serialization handles. */
enum DomNodeType {
    Element = 1,
    Text = 3,
    Comment = 8,
    Document = 9,
    DocumentType = 10,
    DocumentFragment = 11,
}

/** HTML void elements that have no closing tag or children. */
const voidElements = [
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
];

function serializeAttributes(attributes: ReadonlyArray<string>): string {
    return attributes
        .filter((_entry, index) => index % 2 === 0)
        .map((name, pairIndex) => {
            const value = attributes[pairIndex * 2 + 1] || '';
            return ` ${name}="${value}"`;
        })
        .join('');
}

function serializeChildren(node: Readonly<SerializableDomNode>, includeComments: boolean): string {
    return (node.children || []).map((child) => serializeNode(child, includeComments)).join('');
}

function serializeElement(node: Readonly<SerializableDomNode>, includeComments: boolean): string {
    const tagName = (node.localName || node.nodeName).toLowerCase();
    const attributeString = serializeAttributes(node.attributes || []);

    if (voidElements.includes(tagName)) {
        return `<${tagName}${attributeString}>`;
    }

    /**
     * Shadow content is serialized ahead of the element's light-DOM children so open and closed
     * shadow roots (both provided by CDP's pierced tree) appear inline in the snapshot.
     */
    const shadowChildren = (node.shadowRoots || []).flatMap(
        (shadowRoot) => shadowRoot.children || [],
    );
    const innerHtml = [
        ...shadowChildren,
        ...(node.children || []),
    ]
        .map((child) => serializeNode(child, includeComments))
        .join('');

    return `<${tagName}${attributeString}>${innerHtml}</${tagName}>`;
}

const nodeSerializers: Record<
    DomNodeType,
    (node: Readonly<SerializableDomNode>, includeComments: boolean) => string
> = {
    [DomNodeType.Element]: serializeElement,
    [DomNodeType.Text]: (node) => node.nodeValue || '',
    [DomNodeType.Comment]: (node, includeComments) =>
        includeComments ? `<!--${node.nodeValue}-->` : '',
    [DomNodeType.Document]: serializeChildren,
    [DomNodeType.DocumentType]: (node) => `<!doctype ${node.nodeName.toLowerCase()}>`,
    [DomNodeType.DocumentFragment]: serializeChildren,
};

function serializeNode(node: Readonly<SerializableDomNode>, includeComments: boolean): string {
    const nodeType = checkWrap.isEnumValue(node.nodeType, DomNodeType);
    return nodeType == undefined ? '' : nodeSerializers[nodeType](node, includeComments);
}

/**
 * Extract all HTML from a page via a Chrome DevTools Protocol session, including all shadow DOM
 * HTML. Because CDP's `DOM.getDocument` reads the DOM from the browser rather than through page
 * JavaScript, it pierces both open and closed shadow roots regardless of which JavaScript world the
 * page's scripts run in.
 *
 * Obtain the `cdpSession` with `page.context().newCDPSession(page)`.
 *
 * @category Internal
 */
export async function getAllPageHtml(
    cdpSession: Readonly<CDPSession>,
    includeComments: boolean = false,
): Promise<string> {
    const {root} = await cdpSession.send('DOM.getDocument', {
        depth: -1,
        pierce: true,
    });

    return serializeNode(root, includeComments);
}
