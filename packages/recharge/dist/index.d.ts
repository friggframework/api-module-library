import { Api } from './api';
import Definition from './definition';
export { Api, Definition };
declare const _default: {
    Api: typeof Api;
    Definition: {
        API: typeof Api;
        getName: () => string;
        moduleName: string;
        modelName: string;
        requiredAuthMethods: {
            getToken: (_api: Api, params: import("./definition").AuthParams) => Promise<{
                api_key: any;
            }>;
            getEntityDetails: (api: Api, _callbackParams: any, _tokenResponse: any, userId: string | import("./definition").UserIdParam) => Promise<{
                identifiers: {
                    externalId: any;
                    user: string;
                };
                details: {
                    name: any;
                    email: any;
                    domain: any;
                    timezone: any;
                    currency: any;
                };
            }>;
            apiPropertiesToPersist: {
                credential: string[];
                entity: never[];
            };
            getCredentialDetails: (api: Api, userId: string | import("./definition").UserIdParam) => Promise<{
                identifiers: {
                    externalId: any;
                    user: string;
                };
                details: {};
            }>;
            testAuthRequest: (api: Api) => Promise<{
                success: boolean;
                data?: any;
                error?: string | undefined;
            }>;
        };
        env: {
            api_key: string | undefined;
        };
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map