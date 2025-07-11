import {assert} from '@augment-vir/assert';
import {ensureErrorAndPrependMessage, type Values} from '@augment-vir/common';
import {convertTemplateToString} from 'element-vir';
import {JSDOM} from 'jsdom';
import {existsSync} from 'node:fs';
import {relative} from 'node:path';
import {type WebFlow} from '../web-flow/web-flow.js';
import {type WebSnap} from './web-snap.js';

/**
 * Load a saved {@link WebSnap} from the file system.
 *
 * @category Main
 */
export async function loadWebSnap(
    webFlow: Readonly<Pick<WebFlow, 'flowKey' | 'webSnapPaths'>>,
): Promise<WebSnap> {
    if (!webFlow.webSnapPaths) {
        throw new Error(
            `Cannot load WebSnap from WebFlow ${webFlow.flowKey}: no snapshot directory was defined.`,
        );
    }

    /** Only used for error messages. */
    const relativePath = relative(process.cwd(), webFlow.webSnapPaths.ts);

    if (!existsSync(webFlow.webSnapPaths.ts) && !existsSync(webFlow.webSnapPaths.js)) {
        throw new Error(`Missing snapshot file: ${relativePath}`);
    }

    try {
        /** Always import from `.js` (importing from `.ts` will fail). */
        const webSnap = (await import(webFlow.webSnapPaths.js)).default;

        return webSnap;
    } catch (error) {
        throw ensureErrorAndPrependMessage(error, `Malformed snapshot file '${relativePath}': `);
    }
}

/**
 * Output of {@link loadPhaseSnapshot}.
 *
 * @category Internal
 */
export type LoadedPhaseSnapshot = {
    domString: string;
    dom: JSDOM;
};

/**
 * Load a saved {@link WebSnap} phase snapshot from the file system for testing purposes.
 *
 * @category Main
 */
export async function loadPhaseSnapshot<const SpecificWebFlow extends Readonly<WebFlow>>(
    webFlow: Readonly<SpecificWebFlow>,
    phaseName: Values<SpecificWebFlow['phaseNames']>,
): Promise<LoadedPhaseSnapshot> {
    const webSnap = await loadWebSnap(webFlow);

    const phaseSnapshot = webSnap.phaseSnaps.find((snapshot) => snapshot.phaseName === phaseName);

    assert.isDefined(
        phaseSnapshot,
        `WebSnap '${webFlow.flowKey}' has no saved snapshot for phase '${phaseName}'`,
    );

    const domString = convertTemplateToString(phaseSnapshot.pageHtml);

    return {
        domString: domString,
        /** This is a getter so that we don't construct `JSDOM` until necessary. */
        get dom() {
            return new JSDOM(domString);
        },
    };
}
