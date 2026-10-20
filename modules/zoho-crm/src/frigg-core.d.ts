declare module '@friggframework/core' {
    export class OAuth2Requester {
        baseUrl: string;
        authorizationUri: string;
        tokenUri: string;
        access_token: string | null;
        refresh_token: string | null;
        client_id: string;
        client_secret: string;
        redirect_uri: string;
        scope: string;
        URLs: any;

        constructor(params: any);
        setTokens(response: any): Promise<void>;
        parsedBody(response: any): Promise<any>;
        _get(options: any, stringify?: boolean): Promise<any>;
        _post(options: any, stringify?: boolean): Promise<any>;
        _patch(options: any): Promise<any>;
        _put(options: any, stringify?: boolean): Promise<any>;
        _delete(options: any): Promise<any>;
    }

    export function get(obj: any, path: string, defaultValue?: any): any;

    export class FetchError extends Error {
        constructor(message: string);
    }
}

declare module '@friggframework/test' {
    export class Authenticator {
        static oauth2(url: string): Promise<any>;
    }
    export function globalSetup(): Promise<void>;
    export function globalTeardown(): Promise<void>;
}
