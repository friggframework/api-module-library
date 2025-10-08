export type ListParams = {
    accountId: string;
    limit?: number;
    cursor?: string;
    updatedSince?: string;
};
export type ListActivitiesParams = ListParams & {
    type?: "phone_call" | "email" | "sms";
    contactId?: string;
};
export declare class FriggScaleTestAPI {
    readonly opts: {
        baseUrl?: string;
        apiKey?: string;
    };
    constructor(opts?: {
        baseUrl?: string;
        apiKey?: string;
    });
    private get base();
    private headers;
    health(): Promise<any>;
    getConfig(accountId: string): Promise<any>;
    putConfig(accountId: string, cfg: any): Promise<any>;
    listContacts(params: ListParams): Promise<any>;
    listActivities(params: ListActivitiesParams): Promise<any>;
    createActivity(body: any): Promise<any>;
    requestContactsExport(body: {
        accountId: string;
        format?: "ndjson" | "csv";
        fields?: string[];
    }): Promise<any>;
    requestActivitiesExport(body: {
        accountId: string;
        format?: "ndjson" | "csv";
        fields?: string[];
    }): Promise<any>;
    getExportJob(jobId: string): Promise<any>;
}
