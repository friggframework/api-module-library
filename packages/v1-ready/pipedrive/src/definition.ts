import "dotenv/config";
import { Api } from "./api";
import { get, FriggModuleAuthDefinition } from "@friggframework/core";
import config from "./defaultConfig.json";

const Definition: FriggModuleAuthDefinition = {
  API: Api,
  getName: () => config.name,
  moduleName: config.name,
  modelName: "Pipedrive",
  requiredAuthMethods: {
    getToken: async (api: Api, params: { code: string }) => {
      const code: string = get(params, "code");
      if (!code) {
        throw new Error("Authorization code is required");
      }
      return api.getTokenFromCode(code);
    },
    getEntityDetails: async (
      api: Api,
      callbackParams: any,
      tokenResponse: any,
      userId: string
    ) => {
      try {
        const userProfile = await api.getUser();

        if (!userProfile || !userProfile.data) {
          throw new Error(
            `Pipedrive /v1/users/me failed to return valid user info. Response: ${JSON.stringify(
              userProfile
            )}`
          );
        }

        return {
          identifiers: {
            externalId: String(userProfile.data.company_id),
            user: userId,
          },
          details: {
            name: userProfile.data.company_name || "Unknown Company",
            companyDomain: userProfile.data.company_domain,
          },
        };
      } catch (error: any) {
        throw new Error(
          `Failed to get Pipedrive entity details: ${error.message}`
        );
      }
    },
    apiPropertiesToPersist: {
      credential: ["access_token", "refresh_token", "companyDomain"],
      entity: [],
    },
    getCredentialDetails: async (api: Api, userId: string) => {
      try {
        const userProfile = await api.getUser();

        if (!userProfile || !userProfile.data) {
          throw new Error(
            `Pipedrive /v1/users/me failed to return valid user info. Response: ${JSON.stringify(
              userProfile
            )}`
          );
        }

        return {
          identifiers: {
            externalId: String(userProfile.data.id),
            user: userId,
          },
          details: {},
        };
      } catch (error: any) {
        throw new Error(
          `Failed to get Pipedrive credential details: ${error.message}`
        );
      }
    },
    testAuthRequest: async (api: Api) => api.getUser(),
  },
  env: {
    client_id: process.env.PIPEDRIVE_CLIENT_ID,
    client_secret: process.env.PIPEDRIVE_CLIENT_SECRET,
    scope: process.env.PIPEDRIVE_SCOPE,
    redirect_uri: `${process.env.REDIRECT_URI}/pipedrive`,
  },
};

export { Definition };
