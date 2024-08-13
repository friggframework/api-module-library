declare module '@friggframework/core' {
    export function get<T extends string | null = string>(
        o: {},
        key: string,
        defaultValue?: T,
    ): T extends undefined ? string : T;

    export class OAuth2Requester {
        static requesterType: 'oauth2';

        DLGT_TOKEN_UPDATE: string;
        DLGT_TOKEN_DEAUTHORIZED: string;

        grant_type: string;
        client_id: string | null;
        client_secret: string | null;
        redirect_uri: string | null;
        scope: string | null;
        authorizationUri: string | null;
        baseURL: string | null;
        access_token: string | null;
        refresh_token: string | null;
        accessTokenExpire: Date | null;
        refreshTokenExpire: Date | null;
        audience: string | null;
        username: string | null;
        password: string | null;
        state: string | null;

        isRefreshable: boolean;

        constructor(params: any);

        setTokens(params: any): Promise<void>;
        getAuthorizationUri(): string | null;
        getAuthorizationRequirements(): { url: string | null; type: string };

        getTokenFromCode(code: string): Promise<any>;
        getTokenFromCodeBasicAuthHeader(code: string): Promise<any>;
        refreshAccessToken(refreshTokenObject: {
            refresh_token: string;
        }): Promise<any>;

        addAuthHeaders(headers: {
            [key: string]: any;
        }): Promise<{ [key: string]: any }>;

        isAuthenticated(): boolean;
        refreshAuth(): Promise<void>;
        getTokenFromUsernamePassword(): Promise<any>;
        getTokenFromClientCredentials(): Promise<any>;
    }
}
