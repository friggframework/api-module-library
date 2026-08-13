module.exports = {
    // The api/webhook suites are pure unit tests with an injected fetch and need
    // no database. jest-setup only spins up an in-memory Mongo for the Auther
    // suite, which exercises credential persistence.
    globalSetup: './jest-setup.js',
    globalTeardown: './jest-teardown.js',
};
