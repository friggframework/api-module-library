declare module '@friggframework/core' {
  export interface FriggModuleAuthDefinition {
    API: new (...args: any[]) => any;
    getName: () => string;
    moduleName: string;
    modelName?: string;
    requiredAuthMethods: {
      getToken?: (api: any, params: any) => Promise<any>;
      getEntityDetails?: (
        api: any,
        callbackParams: any,
        tokenResponse: any,
        userId: string
      ) => Promise<{
        identifiers: { externalId: string; user: string };
        details: Record<string, any>;
      }>;
      getCredentialDetails?: (
        api: any,
        userId: string
      ) => Promise<{
        identifiers: { externalId: string; user: string };
        details: Record<string, any>;
      }>;
      apiPropertiesToPersist?: {
        credential: string[];
        entity: string[];
      };
      testAuthRequest?: (api: any) => Promise<any>;
      [key: string]: any;
    };
    env?: Record<string, any>;
  }

  export interface RequestOptions {
    url: string;
    body?: any;
    query?: Record<string, any>;
    headers?: Record<string, string>;
  }

  export class OAuth2Requester {
    access_token: string | null;
    refresh_token: string | null;
    baseUrl: string;
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    scope: string;
    authorizationUri: string;
    tokenUri: string;

    constructor(params: any);

    protected _get(options: RequestOptions): Promise<any>;
    protected _post(options: RequestOptions): Promise<any>;
    protected _patch(options: RequestOptions): Promise<any>;
    protected _delete(options: RequestOptions): Promise<any>;

    setTokens(params: any): Promise<any>;
    getTokenFromCode(code: string): Promise<any>;
  }

  export function get<T>(obj: any, path: string, defaultValue?: T): T;
}
