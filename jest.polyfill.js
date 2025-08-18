// Polyfill setImmediate for JSDOM environment which is used by Jest.
// This needs to be in a separate file that runs before jest.setup.js
// to ensure the global is available before any other modules are imported.
import { setImmediate } from 'timers';

global.setImmediate = setImmediate;
global.clearImmediate = global.clearTimeout; // pino-roll also needs clearImmediate
