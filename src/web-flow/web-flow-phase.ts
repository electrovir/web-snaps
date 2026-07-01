import {type MaybePromise} from '@augment-vir/common';
import {type CDPSession} from '@electrovir/rebrowser-playwright';
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
    /**
     * A single CDP session, persisted for the entire flow and reused for every phase's HTML
     * snapshot. Phases may use it to issue their own Chrome DevTools Protocol commands. It is
     * automatically closed after the flow completes.
     */
    cdpSession: Readonly<CDPSession>;
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
