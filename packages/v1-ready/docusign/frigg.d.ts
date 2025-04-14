// Type definitions for @friggframework/core
// Define only the parts used by the docusign module

declare module '@friggframework/core' {
    // Define the structure of the parameters expected by the OAuth2Requester constructor
    // Add properties as needed based on the actual usage in Frigg core
    interface RequesterParams {
        client_id: string;
        client_secret: string;
        redirect_uri: string;
        scope: string;
        state?: string;
        access_token?: string;
        refresh_token?: string;
        [key: string]: any; // Allow other properties
    }

    // Define the base class structure
    export class OAuth2Requester {
        protected access_token?: string;
        protected refresh_token?: string;
        protected client_id: string;
        protected client_secret: string;
        protected scope: string;
        protected redirect_uri: string;
        protected state?: string;
        protected baseUrl?: string;
        public authorizationUri?: string; // Make public if accessed directly
        public tokenUri?: string; // Make public if accessed directly

        constructor(params: RequesterParams);

        // Define methods used by the docusign Api class
        // Use 'any' for complex types initially, refine if necessary
        protected _get(options: any): Promise<any>;
        protected _post(options: any, stringify?: boolean): Promise<any>;
        protected _put(options: any, stringify?: boolean): Promise<any>;
        protected _patch(options: any, stringify?: boolean): Promise<any>;
        protected _delete(options: any): Promise<any>;

        protected addJsonHeaders(options: any): void;

        // Add other methods if used (e.g., getAuthUri, getToken, refreshAccessToken)
        public getAuthUri(): string;
        public getToken(callbackParams: any, code: string): Promise<any>;
        public refreshAccessToken(params?: any): Promise<any>;
    }

    // Define the utility 'get' function
    export function get(obj: Record<string, any> | undefined | null, path: string | string[], defaultValue?: any): any;

    // Add other exports from @friggframework/core if they are used
} 