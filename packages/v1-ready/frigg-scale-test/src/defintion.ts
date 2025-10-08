import { FriggModuleAuthDefinition } from "@friggframework/core";
import FriggScaleTestAPI from "./api";

const definition: FriggModuleAuthDefinition = {
  API: FriggScaleTestAPI,
  getName: () => "Frgg Scale Test API",
  moduleName: "scale-test",
  requiredAuthMethods: {
    getToken: async (
      api: FriggScaleTestAPI,
      params: { data: { apiKey?: string; access_token?: string } }
    ) => {
      // For scale test API, use API key authentication
      const apiKey = params.data?.apiKey || params.data?.access_token;
      return { access_token: apiKey };
    },
    getEntityDetails: async (
      api: FriggScaleTestAPI,
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
    getCredentialDetails: async (api: FriggScaleTestAPI, userId: string) => {
      return {
        identifiers: {
          externalId: "scale-test-account",
          user: userId,
        },
        details: {},
      };
    },
    testAuthRequest: async (api: FriggScaleTestAPI) => api.health(),
  },
  env: {
    apiKey: process.env.SCALE_TEST_API_KEY,
  },
};

export default definition;
