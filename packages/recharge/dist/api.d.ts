import { ApiKeyRequester } from '@friggframework/core';
interface RechargeApiParams {
    api_key: string;
}
interface PaginationOptions {
    page?: number;
    limit?: number;
    sort_by?: string;
    direction?: 'asc' | 'desc';
}
interface QueryOptions extends PaginationOptions {
    [key: string]: any;
}
declare class Api extends ApiKeyRequester {
    private api_key;
    private readonly API_VERSION;
    URLs: {
        customers: string;
        customerById: (customerId: string | number) => string;
        customerAddresses: (customerId: string | number) => string;
        customerPaymentMethods: (customerId: string | number) => string;
        customerSubscriptions: (customerId: string | number) => string;
        subscriptions: string;
        subscriptionById: (subscriptionId: string | number) => string;
        subscriptionCancel: (subscriptionId: string | number) => string;
        subscriptionActivate: (subscriptionId: string | number) => string;
        subscriptionSkip: (subscriptionId: string | number) => string;
        subscriptionUnskip: (subscriptionId: string | number) => string;
        subscriptionPause: (subscriptionId: string | number) => string;
        subscriptionUnpause: (subscriptionId: string | number) => string;
        orders: string;
        orderById: (orderId: string | number) => string;
        orderCharges: (orderId: string | number) => string;
        charges: string;
        chargeById: (chargeId: string | number) => string;
        chargeCapture: (chargeId: string | number) => string;
        chargeRefund: (chargeId: string | number) => string;
        products: string;
        productById: (productId: string | number) => string;
        addresses: string;
        addressById: (addressId: string | number) => string;
        paymentMethods: string;
        paymentMethodById: (paymentMethodId: string | number) => string;
        webhooks: string;
        webhookById: (webhookId: string | number) => string;
        metafields: string;
        metafieldById: (metafieldId: string | number) => string;
        shop: string;
        discounts: string;
        discountById: (discountId: string | number) => string;
        collections: string;
        collectionById: (collectionId: string | number) => string;
        collectionProducts: (collectionId: string | number) => string;
        asyncBatches: string;
        asyncBatchById: (batchId: string | number) => string;
        asyncBatchTasks: (batchId: string | number) => string;
        checkouts: string;
        checkoutById: (checkoutToken: string) => string;
        checkoutCharge: (checkoutToken: string) => string;
        notifications: string;
        notificationById: (notificationId: string | number) => string;
        notificationSend: (notificationId: string | number) => string;
    };
    constructor(params: RechargeApiParams);
    addAuthHeaders(headers?: Record<string, string>): Record<string, string>;
    private _cleanParams;
    private _buildPaginationParams;
    private _buildQueryParams;
    testAuth(): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getShop(): Promise<any>;
    listCustomers(options?: QueryOptions): Promise<any>;
    getCustomer(customerId: string | number): Promise<any>;
    createCustomer(customerData: any): Promise<any>;
    updateCustomer(customerId: string | number, customerData: any): Promise<any>;
    deleteCustomer(customerId: string | number): Promise<any>;
    listSubscriptions(options?: QueryOptions): Promise<any>;
    getSubscription(subscriptionId: string | number): Promise<any>;
    createSubscription(subscriptionData: any): Promise<any>;
    updateSubscription(subscriptionId: string | number, subscriptionData: any): Promise<any>;
    cancelSubscription(subscriptionId: string | number, cancelData?: any): Promise<any>;
    activateSubscription(subscriptionId: string | number): Promise<any>;
    listOrders(options?: QueryOptions): Promise<any>;
    getOrder(orderId: string | number): Promise<any>;
    updateOrder(orderId: string | number, orderData: any): Promise<any>;
    listCharges(options?: QueryOptions): Promise<any>;
    getCharge(chargeId: string | number): Promise<any>;
    listProducts(options?: QueryOptions): Promise<any>;
    getProduct(productId: string | number): Promise<any>;
    listWebhooks(options?: QueryOptions): Promise<any>;
    getWebhook(webhookId: string | number): Promise<any>;
    createWebhook(webhookData: any): Promise<any>;
    updateWebhook(webhookId: string | number, webhookData: any): Promise<any>;
    deleteWebhook(webhookId: string | number): Promise<any>;
    listAddresses(options?: QueryOptions): Promise<any>;
    getAddress(addressId: string | number): Promise<any>;
    createAddress(addressData: any): Promise<any>;
    updateAddress(addressId: string | number, addressData: any): Promise<any>;
    deleteAddress(addressId: string | number): Promise<any>;
}
export { Api };
//# sourceMappingURL=api.d.ts.map