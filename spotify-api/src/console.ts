import * as packageJson from "../package.json";

// Create a wrapper for console to prepend version
const originalConsole = { ...console };
const version = packageJson.version;

// Override console methods
console.log = (...args) => originalConsole.log(`[v${version}]`, ...args);
console.info = (...args) => originalConsole.info(`[v${version}]`, ...args);
console.warn = (...args) => originalConsole.warn(`[v${version}]`, ...args);
console.error = (...args) => originalConsole.error(`[v${version}]`, ...args);
console.debug = (...args) => originalConsole.debug(`[v${version}]`, ...args);

// Export the version in case it's needed elsewhere
export const appVersion = version;
