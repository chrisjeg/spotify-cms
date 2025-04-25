#!/usr/bin/env node

/**
 * Deploy script for building and pushing a Docker image
 * Uses FOUNDRY_TOKEN environment variable to authenticate with the Palantir Foundry registry
 */

const { execSync } = require('child_process');
const path = require('path');

// Patch console.log to never show the token

// Get package.json from the parent directory where this script is run from
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const pkg = require(packageJsonPath);

// Get token from environment variable
const token = process.env.FOUNDRY_TOKEN;
// Patch console.log to never show the token
console.log = (function (originalLog) {
    return function (...args) {
        const filteredArgs = args.map(arg => {
            if (typeof arg === 'string' && arg.includes(token)) {
                return arg.replace(token, '****');
            }
            return arg;
        });
        originalLog.apply(console, filteredArgs);
    };
})(console.log);

console.log('Using token:', token);

if (!token) {
    console.error('ERROR: FOUNDRY_TOKEN environment variable is not set');
    console.error('Please set it with: $env:FOUNDRY_TOKEN = "your-token-value"');
    process.exit(1);
}

// Build the docker command
const cmd = `docker build --build-arg FOUNDRY_TOKEN=${token} -t charm-container-registry.palantirfoundry.co.uk/${pkg.name}:${pkg.version} .`;
console.log('Executing command:');
console.log(cmd);

try {
    // Increment version
    console.log('Incrementing package version...');
    execSync('npm version patch', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    // Execute docker build
    console.log('Building docker image...');
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    console.log(`Successfully built ${pkg.name}:${pkg.version}`);
} catch (error) {
    console.error('Error during deployment:', error.message);
    process.exit(1);
}