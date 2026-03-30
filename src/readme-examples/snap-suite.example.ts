import {defineSnapSuite} from '../index.js';

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

const {defineWebFlow, runWebFlows} = defineSnapSuite<MyContext, MyOutput>();

/** # 3. Define your WebFlows. */

const myWebFlows = [
    defineWebFlow({
        flowKey: 'my-flow-1',
        startUrl: 'https://example.com',
        phases: [
            {
                name: 'initial load',
                async run({page}) {
                    await page.getByText('example domain').waitFor({
                        state: 'visible',
                    });
                },
            },
            {
                name: 'iana site',
                async run({page, context}) {
                    await page.getByText('Learn more').click();
                    await page.getByText('example domains').first().waitFor({
                        state: 'visible',
                    });
                    return {
                        parsedData: {},
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
