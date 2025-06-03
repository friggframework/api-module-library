"use strict";
require('dotenv').config();
jest.setTimeout(30000);
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
//# sourceMappingURL=jest-setup.js.map