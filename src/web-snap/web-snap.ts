import {type Overwrite} from '@augment-vir/common';
import {type UtcIsoString} from 'date-vir';
import {type HTMLTemplateResult} from 'element-vir';
import {type WebFlowPhase} from '../web-flow/web-flow-phase.js';
import {type WebFlow} from '../web-flow/web-flow.js';

/**
 * An individual {@link WebFlowPhase} snapshot.
 *
 * @category Internal
 */
export type PhaseSnap = {
    phaseName: string;
    pageHtml: HTMLTemplateResult;
};

/**
 * A set of saved snapshots generated from a {@link WebFlow}.
 *
 * @category Internal
 */
export type WebSnap = Readonly<{
    webFlow: Pick<WebFlow, 'flowKey' | 'startUrl' | 'phaseNames'>;
    generatedAt: UtcIsoString;
    phaseSnaps: ReadonlyArray<Readonly<PhaseSnap>>;
}>;

/**
 * A {@link WebSnap} that is still in the progress of being generated. This is used inside of
 * `runWebFlow`.
 *
 * @category Internal
 */
export type InProgressWebSnap = Overwrite<
    WebSnap,
    {
        phaseSnaps: Overwrite<
            PhaseSnap,
            {
                pageHtml: string;
            }
        >[];
    }
>;
