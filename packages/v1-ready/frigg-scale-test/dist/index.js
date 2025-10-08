"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FriggScaleTestAPI = exports.authDef = void 0;
const api_1 = require("./api");
Object.defineProperty(exports, "FriggScaleTestAPI", { enumerable: true, get: function () { return api_1.FriggScaleTestAPI; } });
exports.authDef = {
    API: api_1.FriggScaleTestAPI,
    getName: () => "Frigg Scale Test (Mock CRM)",
    moduleName: "frigg-scale-test",
    requiredAuthMethods: {
        apiPropertiesToPersist: { credential: ["apiKey"], entity: [] },
        getToken: async () => undefined,
        getEntityDetails: async (_api, params) => ({
            identifiers: { externalId: `frigg-scale-test:${params?.accountId || "default"}` },
            details: { name: "Frigg Scale Test Mock CRM" }
        }),
        getCredentialDetails: async () => ({ identifiers: { externalId: "frigg-scale-test-cred" }, details: {} }),
        testAuthRequest: async (api) => {
            await api.health();
        }
    },
    env: {
        FRIGG_SCALE_TEST_BASE_URL: process.env.FRIGG_SCALE_TEST_BASE_URL,
        FRIGG_SCALE_TEST_API_KEY: process.env.FRIGG_SCALE_TEST_API_KEY
    }
};
exports.default = exports.authDef;
