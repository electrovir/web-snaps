import {type MaybePromise, type PartialWithUndefined} from '@augment-vir/common';
import {type FullDate, type UtcTimezone} from 'date-vir';
import {type JSDOM} from 'jsdom';
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
    debug: boolean;
};

/**
 * Return type of {@link PhaseRunMethod}.
 *
 * @category Internal
 */
export type PhaseRunResult<Output> = PartialWithUndefined<{
    /** @default false */
    disableSnapshot: boolean;
    output: Output;
}>;

/**
 * The {@link WebFlowPhase}'s `run` method type.
 *
 * @category Internal
 */
export type PhaseRunMethod<Context, Output> = (
    params: Readonly<PhaseRunParams<Context>>,
) => MaybePromise<PhaseRunResult<Output> | void | undefined>;

/**
 * All parameters for a {@link WebFlowPhase} `sanitizeSnapshot` method.
 *
 * @category Internal
 */
export type SanitizeSnapshotParams<Context> = {
    domString: string;
    dom: JSDOM;
} & PhaseRunParams<Context>;

/**
 * A single phase in a `WebFlow`.
 *
 * @category Internal
 */
export type WebFlowPhase<Context = any, Output = any> = {
    name: string;
    run: PhaseRunMethod<Context, Output>;
} & (
    | {
          /** Set to `true` to prevent generation of a snapshot from this phase's end HTML. */
          disableSnapshot: true;
          /** Sanitize a snapshot before it is saved. */
          sanitizeSnapshot?: never;
      }
    | {
          /** Set to `true` to prevent generation of a snapshot from this phase's end HTML. */
          disableSnapshot?: false | undefined;
          /** Sanitize a snapshot before it is saved. */
          sanitizeSnapshot?: (
              params: SanitizeSnapshotParams<Context>,
          ) => MaybePromise<string | JSDOM>;
      }
);
