import {type MaybePromise} from '@augment-vir/common';
import {type FullDate, type UtcTimezone} from 'date-vir';
import {type LoadedBrowserPage} from '../browser/loaded-browser.js';

/**
 * All parameters for a {@link WebFlowPhase} `run` method.
 *
 * @category Internal
 */
export type PhaseRunParams<Context> = LoadedBrowserPage<Context> & {
    phaseStartedAt: Readonly<FullDate<UtcTimezone>>;
    webFlowStartedAt: Readonly<FullDate<UtcTimezone>>;
    webFlowKey: string;
    silent: boolean;
};

/**
 * The {@link WebFlowPhase}'s `run` method type.
 *
 * @category Internal
 */
export type PhaseRunMethod<Context, Output> = (
    params: Readonly<PhaseRunParams<Context>>,
) => MaybePromise<Output | void | undefined>;

/**
 * A single phase in a `WebFlow`.
 *
 * @category Internal
 */
export type WebFlowPhase<Context = any, Output = any> = {
    name: string;
    run: PhaseRunMethod<Context, Output>;
};
