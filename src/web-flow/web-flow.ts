import {arrayToObject, type ArrayElement} from '@augment-vir/common';
import {type WebFlowPhase} from './web-flow-phase.js';

/**
 * Init for an individual {@link WebFlow}.
 *
 * The `flowKey` property must be unique between all {@link WebFlow} instances in a suite.
 *
 * @category Internal
 */
export type WebFlowInit<Context = any, Output = any> = {
    flowKey: string;
    startUrl: string;
    phases: WebFlowPhase<Context, Output>[];
};

/**
 * All phase names from a {@link WebFlow}.
 *
 * @category Internal
 */
export type PhaseNames<Init extends Readonly<WebFlowInit>> = ArrayElement<Init['phases']>['name'];

/**
 * All phase names from a {@link WebFlow} organized into an enum-like object.
 *
 * @category Internal
 */
export type PhaseNamesEnum<Init extends Readonly<WebFlowInit>> = {
    [Key in PhaseNames<Init>]: Key;
};

/**
 * Create a {@link PhaseNamesEnum} value from the given {@link WebFlow}.
 *
 * @category Internal
 */
export function createPhaseNamesEnum<const Init extends Readonly<WebFlowInit>>(
    this: void,
    webFlow: Readonly<Init>,
): PhaseNamesEnum<Init> {
    const duplicatePhaseNames = webFlow.phases.reduce(
        (accum, phase) => {
            if (phase.name in accum.allNames) {
                accum.duplicateNames.add(phase.name);
            } else {
                accum.allNames.add(phase.name);
            }

            return accum;
        },
        {
            allNames: new Set<string>(),
            duplicateNames: new Set<string>(),
        },
    ).duplicateNames;

    if (duplicatePhaseNames.size) {
        throw new Error(
            `Duplicate phase names given in WebFlow '${webFlow.flowKey}': ${Array.from(duplicatePhaseNames).join(',')}`,
        );
    }

    return arrayToObject(webFlow.phases, ({name}) => {
        return {
            key: name,
            value: name,
        };
    }) as PhaseNamesEnum<Init>;
}

/**
 * A fully defined {@link WebFlow} instance. Obtain one of these by calling `defineWebFlow` from
 * `defineSnapSuite`.
 *
 * @category Internal
 */
export type WebFlow<
    Context = any,
    Output = any,
    Init extends Readonly<WebFlowInit<Context, Output>> = Readonly<WebFlowInit<Context, Output>>,
> = Init & {
    phaseNames: PhaseNamesEnum<Init>;
    flowKey: string;
    ContextType: Context;
    OutputType: Output;
};
