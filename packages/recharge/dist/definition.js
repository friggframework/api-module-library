"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Definition = void 0;
require("dotenv/config");
const api_1 = require("./api");
const core_1 = require("@friggframework/core");
const defaultConfig_json_1 = __importDefault(require("./defaultConfig.json"));
const Definition = {
    API: api_1.Api,
    getName: function () {
        return defaultConfig_json_1.default.name;
    },
    moduleName: defaultConfig_json_1.default.name,
    modelName: 'Recharge',
    requiredAuthMethods: {
        getToken: async function (_api, params) {
            const api_key = (0, core_1.get)(params.data, 'api_key');
            if (!api_key) {
                throw new Error('API key is required');
            }
            return { api_key };
        },
        getEntityDetails: async function (api, _callbackParams, _tokenResponse, userId) {
            const shopDetails = await api.getShop();
            if (typeof userId === 'object' && userId.userId) {
                userId = userId.userId;
            }
            return {
                identifiers: {
                    externalId: shopDetails.shop?.id || shopDetails.id,
                    user: userId
                },
                details: {
                    name: shopDetails.shop?.name || shopDetails.name,
                    email: shopDetails.shop?.email || shopDetails.email,
                    domain: shopDetails.shop?.domain || shopDetails.domain,
                    timezone: shopDetails.shop?.timezone || shopDetails.timezone,
                    currency: shopDetails.shop?.currency || shopDetails.currency,
                }
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const shopDetails = await api.getShop();
            if (typeof userId === 'object' && userId.userId) {
                userId = userId.userId;
            }
            return {
                identifiers: {
                    externalId: shopDetails.shop?.id || shopDetails.id,
                    user: userId
                },
                details: {}
            };
        },
        testAuthRequest: function (api) {
            return api.testAuth();
        },
    },
    env: {
        api_key: process.env.RECHARGE_API_KEY,
    }
};
exports.Definition = Definition;
exports.default = Definition;
//# sourceMappingURL=definition.js.map