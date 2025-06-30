import {type queryThroughShadow} from '@augment-vir/web';

/**
 * A global data store stored right on the Playwright Page's internal window.
 *
 * @category Internal
 */
export type DataStore = {
    closedShadows: Map<Node, ShadowRoot>;
    queryThroughShadow: typeof queryThroughShadow;
};
