import 'dotenv/config';
import { Api } from './api';
export interface AuthParams {
    data: {
        api_key?: string;
        [key: string]: any;
    };
}
export interface UserIdParam {
    userId?: string;
}
declare const Definition: {
    API: typeof Api;
    getName: () => string;
    moduleName: string;
    modelName: string;
    requiredAuthMethods: {
        getToken: (_api: Api, params: AuthParams) => Promise<{
            api_key: any;
        }>;
        getEntityDetails: (api: Api, _callbackParams: any, _tokenResponse: any, userId: string | UserIdParam) => Promise<{
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
        getCredentialDetails: (api: Api, userId: string | UserIdParam) => Promise<{
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
export default Definition;
export { Definition };
//# sourceMappingURL=definition.d.ts.map