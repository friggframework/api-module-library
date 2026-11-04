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
        identifiers: { externalId: string; userId: string };
        details: Record<string, any>;
      }>;
      getCredentialDetails?: (
        api: any,
        userId: string
      ) => Promise<{
        identifiers: { externalId: string; userId: string };
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

  export type RateLimitScope =
    | "credential"
    | "entity"
    | "app"
    | ((requester: OAuth2Requester) => string | number | null | undefined);

  export type RateLimitSignal = {
    status?: number;
    headers?: { get(name: string): string | null } | object;
    body?: unknown;
  };

  export type RateLimitWindow = {
    name: string;
    limit?: number;
    perMs?: number;
    rollingMs?: number;
    resets?: { at: string; tz: string };
  };

  export type RateLimitHint = {
    retryAt: Date;
    waitMs: number;
    reason: "burst" | "daily" | "monthly" | "concurrency" | "unknown";
    policy?: string;
    remaining?: number;
    source: "header" | "body" | "static" | "backoff";
  };

  export type RateLimitPolicy = {
    scope?: RateLimitScope;
    windows?: RateLimitWindow[];
    maxConcurrency?: number;
    minRetryAfterMs?: number;
    maxInProcessWaitMs?: number;
    parsers?: Array<"retryAfter" | "resetHeaders" | "ietf">;
    classify?(signal: RateLimitSignal):
      | (Partial<Omit<RateLimitHint, "source">> & {
          source?: "header" | "body" | "static";
        })
      | null
      | undefined;
    userHints?: Record<
      string,
      { links?: Array<{ label: string; url: string }> }
    >;
  };

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
