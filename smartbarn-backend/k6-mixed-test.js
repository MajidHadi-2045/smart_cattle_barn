import loadTest, { options as loadOptions, setup as loadSetup } from './k6-load-test.js';

export const options = loadOptions;
export const setup = loadSetup;
export default loadTest;

