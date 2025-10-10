import { FriggModuleAuthDefinition } from "@friggframework/core";
import Api from "./api";
const config = require("../defaultConfig.json");

const Definition: FriggModuleAuthDefinition = {
    API: Api,
    getName: () => config.label,
    moduleName: config.name,
    requiredAuthMethods: {
        getToken: async (
            api: Api,
            params: { data: { apiKey?: string; access_token?: string } }
        ) => {
            // For scale test API, use API key authentication
            const apiKey = params.data?.apiKey || params.data?.access_token;
            return { access_token: apiKey };
        },
        getEntityDetails: async (
            api: Api,
            callbackParams: any,
            tokenResponse: any,
            userId: string
        ) => {
            const healthCheck = await api.health();
            return {
                identifiers: {
                    externalId: "scale-test-account",
                    user: userId,
                },
                details: {
                    name: "Scale Test Account",
                    status: healthCheck.ok ? "healthy" : "error",
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ["access_token"],
            entity: [],
        },
        getCredentialDetails: async (api: Api, userId: string) => {
            return {
                identifiers: {
                    externalId: "scale-test-account",
                    user: userId,
                },
                details: {},
            };
        },
        testAuthRequest: async (api: Api) => api.health(),
    },
    env: {
        apiKey: process.env.SCALE_TEST_API_KEY,
    },
};

export default Definition;

