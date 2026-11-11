// Expose only the runtime handler; named exports in worker.mjs support isolated tests.
export {default} from './worker.mjs';
