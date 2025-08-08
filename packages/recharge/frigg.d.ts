/// <reference types="node" />

declare module '@friggframework/core' {
  export interface RequestOptions {
    url: string;
    query?: Record<string, any>;
    body?: any;
    headers?: Record<string, string>;
    method?: string;
  }

  export interface ApiKeyRequesterParams {
    api_key?: string;
    [key: string]: any;
  }

  export class Requester {
    baseUrl: string;
    
    protected _get(options: RequestOptions): Promise<any>;
    protected _post(options: RequestOptions): Promise<any>;
    protected _put(options: RequestOptions): Promise<any>;
    protected _patch(options: RequestOptions): Promise<any>;
    protected _delete(options: RequestOptions): Promise<any>;
    protected _request(options: RequestOptions): Promise<any>;
  }

  export class ApiKeyRequester extends Requester {
    constructor(params: ApiKeyRequesterParams);
    
    addAuthHeaders(headers?: Record<string, string>): Record<string, string>;
  }

  export class OAuth2Requester extends Requester {
    access_token: string;
    refresh_token: string;
    
    constructor(params: any);
    
    addAuthHeaders(headers?: Record<string, string>): Record<string, string>;
    refreshAccessToken(): Promise<any>;
  }

  export function get(obj: any, path: string, defaultValue?: any): any;
  export function set(obj: any, path: string, value: any): void;

  export class Entity {
    static findById(id: string): Promise<any>;
    static find(query: any): Promise<any[]>;
    static findOne(query: any): Promise<any>;
    static create(data: any): Promise<any>;
    static updateById(id: string, data: any): Promise<any>;
    static deleteById(id: string): Promise<any>;
    
    save(): Promise<any>;
    delete(): Promise<any>;
  }

  export class Credential extends Entity {
    user: string;
    auth_is_valid: boolean;
    
    getAuthorizationRequirements(): any;
    testAuth(): Promise<{ success: boolean; error?: string }>;
  }

  export class Manager {
    api: any;
    entity: any;
    credential: any;
    
    constructor(params: any);
    
    testAuth(): Promise<{ success: boolean; error?: string }>;
  }

  export interface ModuleDefinition {
    API: any;
    getName(): string;
    getDisplayName(): string;
    getDescription(): string;
    getCategory(): string;
    getIcon(): string;
    getAuthType(): string;
    getAuthCategory(): string;
    getConfigOptions(): any;
    getAuthFields(): any[];
  }
}