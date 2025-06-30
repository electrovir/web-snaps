import {assert} from '@augment-vir/assert';
import {log, stringify} from '@augment-vir/common';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {type WebFlow} from '../web-flow/web-flow.js';
import {type InProgressWebSnap, type WebSnap} from './web-snap.js';

/**
 * Save a {@link WebSnap} to the file system.
 *
 * @category Internal
 */
export async function saveWebSnap(
    webFlow: Readonly<Pick<WebFlow, 'webSnapPaths'>>,
    webSnap: Readonly<InProgressWebSnap>,
    debug: boolean,
) {
    assert.isDefined(webFlow.webSnapPaths, 'WebFlow has no snapshot paths.');
    await mkdir(dirname(webFlow.webSnapPaths.js), {
        recursive: true,
    });
    await writeFile(webFlow.webSnapPaths.ts, createWebSnapFileContents(webSnap));
    log.if(debug).faint(`${webSnap.webFlow.flowKey}: snapshot saved.`);
}

function createWebSnapFileContents(webSnap: Readonly<InProgressWebSnap>) {
    const snapshotsContent: string[] = webSnap.phaseSnaps.map((phaseSnap) => {
        const escapedPageHtml = phaseSnap.pageHtml.replaceAll('`', '\\`');

        return [
            '        {',
            `            phaseName: '${phaseSnap.phaseName}',`,
            `            pageHtml: html\`\n${escapedPageHtml}\n\`,`,
            '        },',
        ].join('\n');
    });

    const lines = [
        '// This file is generated via script. Do not manually edit!',
        '',
        "import {type WebSnap, html} from 'web-snaps';",
        '',
        'export default {',
        `    webFlow: ${stringify(webSnap.webFlow)},`,
        `    generatedAt: '${webSnap.generatedAt}',`,
        `    phaseSnaps: [`,
        ...snapshotsContent,
        '    ],',
        '} satisfies WebSnap;',
        '',
    ];

    return lines.join('\n');
}
