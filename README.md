# web-snaps

A simple library for browser automation with snapshot saving after each stop of the automation script. Closed Shadow DOM piercing is also enabled.

Uses Playwright under the hood.

## Install

```sh
npm i web-snaps
```

## Usage

Here's an example script to step you through the primary way this package is meant to be used:

<!-- example-link: src/readme-examples/snap-suite.example.ts -->

```TypeScript
import {defineSnapSuite} from 'web-snaps';

/** # 1. Define Context (if any) and Output (if any) types. */

type MyContext = {
    credentialsClient: {
        getCredentials(key: string): Promise<Record<string, string>>;
    };
};

type MyOutput = {
    parsedData: Record<string, string>;
};

/** # 2. Define a SnapSuite. */

const {defineWebFlow, runWebFlows} = defineSnapSuite<MyContext, MyOutput>(
    'my/dir/to/save/snapshots',
);

/** # 3. Define your WebFlows. */

const myWebFlows = [
    defineWebFlow({
        flowKey: 'my-flow-1',
        startUrl: 'https://example.com',
        phases: [
            {
                name: 'initial load',
                async run({page}) {
                    await page.getByText('example domain').waitFor({state: 'visible'});
                },
            },
            {
                name: 'iana site',
                /** Optionally sanitize the snapshot before it is saved. */
                sanitizeSnapshot(params) {
                    return '';
                },
                async run({page, context}) {
                    await page.getByText('Learn more').click();
                    await page.getByText('example domains').first().waitFor({state: 'visible'});
                    return {
                        output: {
                            parsedData: {},
                        },
                    };
                },
            },
        ],
    }),
    // ...etc.
] as const;

/** # 4. Run your WebFlows. */

await runWebFlows({
    /** Pass in your actual context here. */
    context: {} as MyContext,
    webFlows: myWebFlows,
    /** The directory of your browser's user data. This is required. */
    userDataDirPath: '',
    /** Pass in extra options here. */
    options: {},
});
```
