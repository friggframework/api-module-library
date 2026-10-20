import { FriggModuleAuthDefinition } from "@friggframework/core";
import FriggScaleTestAPI from "./api";

const definition: FriggModuleAuthDefinition = {
  API: FriggScaleTestAPI,
  getName: () => "scale-test",
  moduleName: "scale-test",
  requiredAuthMethods: {
    getAuthorizationRequirements: (api: FriggScaleTestAPI) => {
      return {
        type: "apiKey",
        data: {
          jsonSchema: {
            title: "Scale Test API Authorization",
            type: "object",
            required: ["apiKey"],
            properties: {
              apiKey: {
                type: "string",
                title: "API Key",
              },
            },
          },
          uiSchema: {
            apiKey: {
              "ui:widget": "password",
              "ui:help": "Your Scale Test API key",
              "ui:placeholder": "Enter your API key...",
            },
          },
        },
      };
    },
    getToken: async (
      api: FriggScaleTestAPI,
      params: { data: { apiKey?: string; access_token?: string } }
    ) => {
      // For scale test API, use API key authentication
      const apiKey = params.data?.apiKey || params.data?.access_token;
      return { access_token: apiKey };
    },
    setAuthParams: async (
      api: FriggScaleTestAPI,
      params: { apiKey?: string; access_token?: string }
    ) => {
      // For API key authentication, set the key on the API instance
      // params IS the data object, so access apiKey directly
      const apiKey = params.apiKey || params.access_token;
      if (!apiKey) {
        throw new Error("API key is required for Scale Test authentication");
      }
      // Set the apiKey on the API instance (assuming it has an opts property)
      (api as any).opts = { ...(api as any).opts, apiKey };
      (api as any).access_token = apiKey;
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
          userId,
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
          userId,
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
