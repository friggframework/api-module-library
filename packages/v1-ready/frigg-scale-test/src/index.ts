import { FriggModuleAuthDefinition } from "@friggframework/core";
import { FriggScaleTestAPI } from "./api";

export const authDef: FriggModuleAuthDefinition = {
  API: FriggScaleTestAPI,
  getName: () => "Frigg Scale Test (Mock CRM)",
  moduleName: "frigg-scale-test",
  requiredAuthMethods: {
    apiPropertiesToPersist: { credential: ["apiKey"], entity: [] },
    getToken: async () => undefined,
    getEntityDetails: async (_api: FriggScaleTestAPI, params?: any) => ({
      identifiers: { externalId: `frigg-scale-test:${params?.accountId || "default"}` },
      details: { name: "Frigg Scale Test Mock CRM" }
    }),
    getCredentialDetails: async () => ({ identifiers: { externalId: "frigg-scale-test-cred" }, details: {} }),
    testAuthRequest: async (api: FriggScaleTestAPI) => {
      await api.health();
    }
  },
  env: {
    FRIGG_SCALE_TEST_BASE_URL: process.env.FRIGG_SCALE_TEST_BASE_URL,
    FRIGG_SCALE_TEST_API_KEY: process.env.FRIGG_SCALE_TEST_API_KEY
  }
};

export { FriggScaleTestAPI };
export default authDef;
