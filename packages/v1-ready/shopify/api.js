const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Shopify Admin API client (GraphQL Admin preferred).
 *
 * Auth: OAuth 2.0 authorization-code grant per shop (offline access token).
 *   Token requests include `expiring=1` so new public apps receive refreshable
 *   offline tokens (required for GraphQL Admin as of Shopify's expiring-token
 *   migration). Requests send `X-Shopify-Access-Token` (not Bearer).
 *
 * Base URL: https://{shop}.myshopify.com/admin/api/{version}/graphql.json
 * Docs:
 *   https://shopify.dev/docs/api/admin-graphql
 *   https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps
 *   https://shopify.dev/docs/apps/build/webhooks
 */
const API_VERSION = '2026-10';
const SHOP_DOMAIN_RE =
    /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;

/** REST topic `orders/create` → GraphQL enum `ORDERS_CREATE`. */
function toGraphqlTopic(topic) {
    if (!topic) return topic;
    if (/^[A-Z0-9_]+$/.test(topic)) return topic;
    return String(topic)
        .trim()
        .replace(/^\/+|\/+$/g, '')
        .replace(/\//g, '_')
        .toUpperCase();
}

/** `gid://shopify/Customer/123` → `123` (numeric REST-compatible id). */
function gidToRestId(gid) {
    if (gid === null || gid === undefined) return gid;
    const s = String(gid);
    const m = s.match(/\/(\d+)(?:\?.*)?$/);
    return m ? m[1] : s;
}

function moneyAmount(money) {
    if (!money) return null;
    if (typeof money === 'string' || typeof money === 'number') return String(money);
    if (money.amount !== undefined) return String(money.amount);
    if (money.shopMoney?.amount !== undefined) return String(money.shopMoney.amount);
    return null;
}

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.apiVersion = get(params, 'apiVersion', API_VERSION);
        this.shop =
            get(params, 'shop', null) ||
            get(params, 'shop_domain', null) ||
            null;

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this._applyShopUrls();
    }

    // ---- Shop / URL wiring -------------------------------------------------

    /**
     * Normalize and set the shop domain, then refresh auth + GraphQL URLs.
     * Accepts `acme` or `acme.myshopify.com`.
     */
    setShop(shop) {
        if (!shop) {
            this.shop = null;
            this._applyShopUrls();
            return;
        }
        let normalized = String(shop).trim().toLowerCase();
        normalized = normalized.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!normalized.includes('.')) {
            normalized = `${normalized}.myshopify.com`;
        }
        if (!SHOP_DOMAIN_RE.test(normalized)) {
            throw new Error(
                `Invalid Shopify shop domain "${shop}". Expected *.myshopify.com`
            );
        }
        this.shop = normalized;
        this._applyShopUrls();
    }

    _applyShopUrls() {
        const host = this.shop || '{shop}.myshopify.com';
        this.baseUrl = `https://${host}/admin/api/${this.apiVersion}/graphql.json`;
        this.tokenUri = this.shop
            ? `https://${this.shop}/admin/oauth/access_token`
            : null;
        this.authorizationUri = null;
    }

    /**
     * Build the per-shop OAuth authorize URL.
     * Docs: https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps
     */
    getAuthUri() {
        if (!this.shop) {
            return `https://{shop}.myshopify.com/admin/oauth/authorize?client_id=${
                this.client_id || ''
            }&scope=${encodeURIComponent(
                this.scope || ''
            )}&redirect_uri=${encodeURIComponent(
                this.redirect_uri || ''
            )}&state=${encodeURIComponent(this.state || '')}`;
        }
        const q = new URLSearchParams({
            client_id: this.client_id,
            scope: this.scope || '',
            redirect_uri: this.redirect_uri,
            state: this.state || '',
        });
        return `https://${this.shop}/admin/oauth/authorize?${q.toString()}`;
    }

    getAuthorizationUri() {
        return this.getAuthUri();
    }

    // ---- Auth headers / tokens ---------------------------------------------

    /**
     * Shopify Admin APIs authenticate with X-Shopify-Access-Token, not Bearer.
     * https://shopify.dev/docs/apps/build/authentication-authorization
     */
    async addAuthHeaders(headers = {}) {
        delete headers.Authorization;
        delete headers['X-Shopify-Access-Token'];
        if (this.access_token) {
            headers['X-Shopify-Access-Token'] = this.access_token;
        }
        return headers;
    }

    /**
     * Exchange an authorization code for an (expiring) offline access token.
     * Shopify's token endpoint takes client_id, client_secret, code, and
     * expiring=1 — not the standard grant_type/redirect_uri form body.
     */
    async getTokenFromCode(code) {
        if (!this.shop || !this.tokenUri) {
            throw new Error(
                'Shopify getTokenFromCode requires shop to be set (call setShop first).'
            );
        }
        delete this.access_token;
        const params = new URLSearchParams();
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('code', code);
        params.append('expiring', '1');

        const options = {
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            url: this.tokenUri,
        };
        const response = await this._post(options, false);
        await this.setTokens({
            ...response,
            // Shopify returns refresh_token_expires_in; map for OAuth2Requester.
            x_refresh_token_expires_in:
                response.refresh_token_expires_in ??
                response.x_refresh_token_expires_in,
        });
        return response;
    }

    async refreshAccessToken(refreshTokenObject) {
        if (!this.shop || !this.tokenUri) {
            throw new Error(
                'Shopify refreshAccessToken requires shop to be set.'
            );
        }
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('refresh_token', refreshTokenObject.refresh_token);

        const options = {
            body: params,
            url: this.tokenUri,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        };
        const response = await this._post(options, false);
        await this.setTokens({
            ...response,
            x_refresh_token_expires_in:
                response.refresh_token_expires_in ??
                response.x_refresh_token_expires_in,
        });
        return response;
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        const newRefreshToken = get(params, 'refresh_token', null);
        if (newRefreshToken !== null) {
            this.refresh_token = newRefreshToken;
        }
        const accessExpiresIn = get(params, 'expires_in', null);
        const refreshExpiresIn = get(
            params,
            'x_refresh_token_expires_in',
            get(params, 'refresh_token_expires_in', null)
        );
        if (accessExpiresIn !== null && accessExpiresIn !== undefined) {
            this.accessTokenExpire = new Date(
                Date.now() + Number(accessExpiresIn) * 1000
            );
        }
        if (refreshExpiresIn !== null && refreshExpiresIn !== undefined) {
            this.refreshTokenExpire = new Date(
                Date.now() + Number(refreshExpiresIn) * 1000
            );
        }
        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    // ---- GraphQL helpers ---------------------------------------------------

    buildRequestOptions(query, variables) {
        const body = { query };
        if (variables !== undefined) body.variables = variables;
        return {
            url: this.baseUrl,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
    }

    assertResponse(response) {
        if (response?.errors?.length) {
            const err = new Error(response.errors[0].message || 'GraphQL error');
            err.graphqlErrors = response.errors;
            throw err;
        }
        return response;
    }

    async graphql(query, variables) {
        const response = await this._post(
            this.buildRequestOptions(query, variables)
        );
        this.assertResponse(response);
        return response.data;
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Shop identity for entity/credential externalId.
     * GraphQL: shop { id name myshopifyDomain email currencyCode }
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/shop
     */
    async getShop() {
        const data = await this.graphql(`
            query ShopIdentity {
                shop {
                    id
                    name
                    myshopifyDomain
                    email
                    currencyCode
                    primaryDomain { url host }
                }
            }
        `);
        return data.shop;
    }

    /** Alias used by definition.testAuthRequest / getEntityDetails. */
    async getUserDetails() {
        return this.getShop();
    }

    // ---- Customers ---------------------------------------------------------

    static CUSTOMER_FIELDS = `
        id
        firstName
        lastName
        email
        phone
        note
        tags
        createdAt
        updatedAt
        numberOfOrders
        amountSpent { amount currencyCode }
        defaultAddress {
            company address1 address2 city province provinceCode
            country countryCodeV2 zip phone name
        }
        emailMarketingConsent { marketingState consentUpdatedAt marketingOptInLevel }
    `;

    _mapCustomer(node) {
        if (!node) return null;
        const consent = node.emailMarketingConsent;
        return {
            id: gidToRestId(node.id),
            admin_graphql_api_id: node.id,
            email: node.email ?? null,
            first_name: node.firstName ?? null,
            last_name: node.lastName ?? null,
            phone: node.phone ?? null,
            note: node.note ?? null,
            tags: Array.isArray(node.tags) ? node.tags.join(', ') : node.tags,
            created_at: node.createdAt,
            updated_at: node.updatedAt,
            orders_count: node.numberOfOrders != null
                ? Number(node.numberOfOrders)
                : undefined,
            total_spent: moneyAmount(node.amountSpent),
            email_marketing_consent: consent
                ? {
                      state: String(consent.marketingState || '')
                          .toLowerCase()
                          .replace(/_/g, '_'),
                      opt_in_level: consent.marketingOptInLevel,
                      consent_updated_at: consent.consentUpdatedAt,
                  }
                : undefined,
            default_address: node.defaultAddress
                ? {
                      company: node.defaultAddress.company,
                      address1: node.defaultAddress.address1,
                      city: node.defaultAddress.city,
                      province_code: node.defaultAddress.provinceCode,
                      zip: node.defaultAddress.zip,
                      country_code: node.defaultAddress.countryCodeV2,
                  }
                : null,
        };
    }

    /**
     * listCustomers — GraphQL `customers`.
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/customers
     *
     * Capability inputs: updated_at_min, limit, page_info
     * Response shape for Frigg sync: { customers, nextPageInfo }
     */
    async listCustomers(params = {}) {
        const first = Math.min(Number(params.limit) || 50, 250);
        const after = params.page_info || params.after || null;
        const queryParts = [];
        if (params.updated_at_min) {
            queryParts.push(`updated_at:>=${params.updated_at_min}`);
        }
        if (params.query) queryParts.push(params.query);
        const search = queryParts.length ? queryParts.join(' ') : null;

        const data = await this.graphql(
            `
            query ListCustomers($first: Int!, $after: String, $query: String) {
                customers(first: $first, after: $after, query: $query) {
                    nodes { ${Api.CUSTOMER_FIELDS} }
                    pageInfo { hasNextPage endCursor }
                }
            }
        `,
            { first, after, query: search }
        );
        const conn = data.customers;
        return {
            customers: (conn.nodes || []).map((n) => this._mapCustomer(n)),
            nextPageInfo: conn.pageInfo?.hasNextPage
                ? conn.pageInfo.endCursor
                : null,
            pageInfo: conn.pageInfo,
        };
    }

    /**
     * getCustomer — GraphQL `customer(id:)`.
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/customer
     */
    async getCustomer({ id } = {}) {
        const gid = this._toGid('Customer', id);
        const data = await this.graphql(
            `
            query GetCustomer($id: ID!) {
                customer(id: $id) { ${Api.CUSTOMER_FIELDS} }
            }
        `,
            { id: gid }
        );
        return { customer: this._mapCustomer(data.customer) };
    }

    /**
     * searchCustomers — GraphQL `customers` with a search query string.
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/customers
     */
    async searchCustomers({ query, limit } = {}) {
        const result = await this.listCustomers({
            query,
            limit: limit || 50,
        });
        return result.customers;
    }

    /**
     * createCustomer — GraphQL `customerCreate`.
     * https://shopify.dev/docs/api/admin-graphql/latest/mutations/customerCreate
     */
    async createCustomer({ customer } = {}) {
        const input = this._customerInput(customer);
        const data = await this.graphql(
            `
            mutation CreateCustomer($input: CustomerInput!) {
                customerCreate(input: $input) {
                    customer { ${Api.CUSTOMER_FIELDS} }
                    userErrors { field message }
                }
            }
        `,
            { input }
        );
        this._assertUserErrors(data.customerCreate?.userErrors);
        return { customer: this._mapCustomer(data.customerCreate.customer) };
    }

    /**
     * updateCustomer — GraphQL `customerUpdate`.
     * https://shopify.dev/docs/api/admin-graphql/latest/mutations/customerUpdate
     */
    async updateCustomer({ id, customer } = {}) {
        const input = { id: this._toGid('Customer', id), ...this._customerInput(customer) };
        const data = await this.graphql(
            `
            mutation UpdateCustomer($input: CustomerInput!) {
                customerUpdate(input: $input) {
                    customer { ${Api.CUSTOMER_FIELDS} }
                    userErrors { field message }
                }
            }
        `,
            { input }
        );
        this._assertUserErrors(data.customerUpdate?.userErrors);
        return { customer: this._mapCustomer(data.customerUpdate.customer) };
    }

    _customerInput(customer = {}) {
        const input = {};
        if (customer.email !== undefined) input.email = customer.email;
        if (customer.first_name !== undefined || customer.firstName !== undefined) {
            input.firstName = customer.first_name ?? customer.firstName;
        }
        if (customer.last_name !== undefined || customer.lastName !== undefined) {
            input.lastName = customer.last_name ?? customer.lastName;
        }
        if (customer.phone !== undefined) input.phone = customer.phone;
        if (customer.note !== undefined) input.note = customer.note;
        if (customer.tags !== undefined) {
            input.tags =
                typeof customer.tags === 'string'
                    ? customer.tags.split(',').map((t) => t.trim()).filter(Boolean)
                    : customer.tags;
        }
        return input;
    }

    // ---- Orders ------------------------------------------------------------

    static ORDER_FIELDS = `
        id
        name
        email
        createdAt
        processedAt
        updatedAt
        note
        tags
        sourceName
        displayFinancialStatus
        displayFulfillmentStatus
        currencyCode
        subtotalPriceSet { shopMoney { amount currencyCode } }
        totalDiscountsSet { shopMoney { amount currencyCode } }
        totalTaxSet { shopMoney { amount currencyCode } }
        totalPriceSet { shopMoney { amount currencyCode } }
        totalShippingPriceSet { shopMoney { amount currencyCode } }
        customer { id email firstName lastName }
        shippingAddress {
            name address1 city provinceCode zip countryCodeV2 phone
        }
        lineItems(first: 100) {
            nodes {
                id
                sku
                title
                variantTitle
                quantity
                originalUnitPriceSet { shopMoney { amount currencyCode } }
                totalDiscountSet { shopMoney { amount currencyCode } }
                variant { id }
                product { id }
            }
        }
        discountCodes
    `;

    _mapOrder(node) {
        if (!node) return null;
        const lineItems = (node.lineItems?.nodes || []).map((li) => ({
            id: gidToRestId(li.id),
            variant_id: gidToRestId(li.variant?.id),
            product_id: gidToRestId(li.product?.id),
            sku: li.sku,
            title: li.title,
            variant_title: li.variantTitle,
            quantity: li.quantity,
            price: moneyAmount(li.originalUnitPriceSet?.shopMoney),
            total_discount: moneyAmount(li.totalDiscountSet?.shopMoney),
        }));
        const nameMatch = String(node.name || '').match(/(\d+)\s*$/);
        return {
            id: gidToRestId(node.id),
            admin_graphql_api_id: node.id,
            name: node.name,
            order_number: nameMatch ? Number(nameMatch[1]) : undefined,
            email: node.email,
            created_at: node.createdAt,
            processed_at: node.processedAt,
            updated_at: node.updatedAt,
            currency: node.currencyCode,
            financial_status: node.displayFinancialStatus
                ? String(node.displayFinancialStatus).toLowerCase()
                : null,
            fulfillment_status: node.displayFulfillmentStatus
                ? String(node.displayFulfillmentStatus).toLowerCase()
                : null,
            subtotal_price: moneyAmount(node.subtotalPriceSet?.shopMoney),
            total_discounts: moneyAmount(node.totalDiscountsSet?.shopMoney),
            total_tax: moneyAmount(node.totalTaxSet?.shopMoney),
            total_price: moneyAmount(node.totalPriceSet?.shopMoney),
            total_shipping_price_set: node.totalShippingPriceSet
                ? {
                      shop_money: {
                          amount: moneyAmount(
                              node.totalShippingPriceSet.shopMoney
                          ),
                          currency_code:
                              node.totalShippingPriceSet.shopMoney
                                  ?.currencyCode,
                      },
                  }
                : undefined,
            customer: node.customer
                ? {
                      id: gidToRestId(node.customer.id),
                      email: node.customer.email,
                      first_name: node.customer.firstName,
                      last_name: node.customer.lastName,
                  }
                : null,
            line_items: lineItems,
            discount_codes: node.discountCodes || [],
            shipping_address: node.shippingAddress
                ? {
                      name: node.shippingAddress.name,
                      address1: node.shippingAddress.address1,
                      city: node.shippingAddress.city,
                      province_code: node.shippingAddress.provinceCode,
                      zip: node.shippingAddress.zip,
                      country_code: node.shippingAddress.countryCodeV2,
                      phone: node.shippingAddress.phone,
                  }
                : null,
            note: node.note,
            tags: Array.isArray(node.tags) ? node.tags.join(', ') : node.tags,
            source_name: node.sourceName,
        };
    }

    /**
     * listOrders — GraphQL `orders`.
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/orders
     */
    async listOrders(params = {}) {
        const first = Math.min(Number(params.limit) || 50, 250);
        const after = params.page_info || params.after || null;
        const queryParts = [];
        if (params.status) queryParts.push(`status:${params.status}`);
        if (params.created_at_min) {
            queryParts.push(`created_at:>=${params.created_at_min}`);
        }
        if (params.updated_at_min) {
            queryParts.push(`updated_at:>=${params.updated_at_min}`);
        }
        if (params.query) queryParts.push(params.query);
        const search = queryParts.length ? queryParts.join(' ') : null;

        const data = await this.graphql(
            `
            query ListOrders($first: Int!, $after: String, $query: String) {
                orders(first: $first, after: $after, query: $query) {
                    nodes { ${Api.ORDER_FIELDS} }
                    pageInfo { hasNextPage endCursor }
                }
            }
        `,
            { first, after, query: search }
        );
        const conn = data.orders;
        return {
            orders: (conn.nodes || []).map((n) => this._mapOrder(n)),
            nextPageInfo: conn.pageInfo?.hasNextPage
                ? conn.pageInfo.endCursor
                : null,
            pageInfo: conn.pageInfo,
        };
    }

    /**
     * getOrder — GraphQL `order(id:)`.
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/order
     */
    async getOrder({ id, fields } = {}) {
        // `fields` is accepted for capability-manifest compatibility; GraphQL
        // selection is fixed to the core order shape above.
        void fields;
        const gid = this._toGid('Order', id);
        const data = await this.graphql(
            `
            query GetOrder($id: ID!) {
                order(id: $id) { ${Api.ORDER_FIELDS} }
            }
        `,
            { id: gid }
        );
        return { order: this._mapOrder(data.order) };
    }

    /**
     * updateOrder — GraphQL `orderUpdate`.
     * https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderUpdate
     */
    async updateOrder({ id, order } = {}) {
        const input = { id: this._toGid('Order', id) };
        if (order?.note !== undefined) input.note = order.note;
        if (order?.tags !== undefined) {
            input.tags =
                typeof order.tags === 'string'
                    ? order.tags.split(',').map((t) => t.trim()).filter(Boolean)
                    : order.tags;
        }
        if (order?.email !== undefined) input.email = order.email;

        const data = await this.graphql(
            `
            mutation UpdateOrder($input: OrderInput!) {
                orderUpdate(input: $input) {
                    order { ${Api.ORDER_FIELDS} }
                    userErrors { field message }
                }
            }
        `,
            { input }
        );
        this._assertUserErrors(data.orderUpdate?.userErrors);
        return { order: this._mapOrder(data.orderUpdate.order) };
    }

    /**
     * listFulfillmentOrders — GraphQL `order.fulfillmentOrders`.
     * https://shopify.dev/docs/api/admin-graphql/latest/objects/Order#field-fulfillmentOrders
     */
    async listFulfillmentOrders({ orderId } = {}) {
        const gid = this._toGid('Order', orderId);
        const data = await this.graphql(
            `
            query ListFulfillmentOrders($id: ID!) {
                order(id: $id) {
                    fulfillmentOrders(first: 50) {
                        nodes {
                            id
                            status
                            assignedLocation {
                                name
                                location { id name }
                            }
                            lineItems(first: 50) {
                                nodes {
                                    id
                                    remainingQuantity
                                    totalQuantity
                                    lineItem { id sku title }
                                }
                            }
                        }
                    }
                }
            }
        `,
            { id: gid }
        );
        return (data.order?.fulfillmentOrders?.nodes || []).map((fo) => ({
            id: fo.id,
            status: fo.status,
            assigned_location: fo.assignedLocation,
            line_items: fo.lineItems?.nodes || [],
        }));
    }

    /**
     * createFulfillment — GraphQL `fulfillmentCreate`.
     * https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentCreate
     */
    async createFulfillment({
        fulfillmentOrderId,
        trackingInfo,
        notifyCustomer,
    } = {}) {
        const fulfillment = {
            lineItemsByFulfillmentOrder: [
                {
                    fulfillmentOrderId: this._toGid(
                        'FulfillmentOrder',
                        fulfillmentOrderId
                    ),
                },
            ],
            notifyCustomer: notifyCustomer !== false,
        };
        if (trackingInfo) {
            fulfillment.trackingInfo = {
                company: trackingInfo.company || trackingInfo.tracking_company,
                number: trackingInfo.number || trackingInfo.tracking_number,
                url: trackingInfo.url || trackingInfo.tracking_url,
            };
        }
        const data = await this.graphql(
            `
            mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
                fulfillmentCreate(fulfillment: $fulfillment) {
                    fulfillment {
                        id
                        status
                        trackingInfo { company number url }
                        createdAt
                        order { id }
                    }
                    userErrors { field message }
                }
            }
        `,
            { fulfillment }
        );
        this._assertUserErrors(data.fulfillmentCreate?.userErrors);
        const f = data.fulfillmentCreate.fulfillment;
        const tracking = Array.isArray(f.trackingInfo)
            ? f.trackingInfo[0]
            : f.trackingInfo;
        return {
            id: gidToRestId(f.id),
            admin_graphql_api_id: f.id,
            order_id: gidToRestId(f.order?.id),
            status: f.status ? String(f.status).toLowerCase() : null,
            tracking_company: tracking?.company,
            tracking_number: tracking?.number,
            tracking_url: tracking?.url,
            created_at: f.createdAt,
        };
    }

    // ---- Checkouts / inventory / locations ---------------------------------

    /**
     * listAbandonedCheckouts — GraphQL `abandonedCheckouts`.
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/abandonedCheckouts
     */
    async listAbandonedCheckouts(params = {}) {
        const first = Math.min(Number(params.limit) || 50, 250);
        const after = params.page_info || params.after || null;
        const queryParts = [];
        if (params.created_at_min) {
            queryParts.push(`created_at:>=${params.created_at_min}`);
        }
        const search = queryParts.length ? queryParts.join(' ') : null;

        const data = await this.graphql(
            `
            query ListAbandonedCheckouts($first: Int!, $after: String, $query: String) {
                abandonedCheckouts(first: $first, after: $after, query: $query) {
                    nodes {
                        id
                        abandonedCheckoutUrl
                        createdAt
                        completedAt
                        updatedAt
                        totalPriceSet { shopMoney { amount currencyCode } }
                        customer { id email }
                        lineItems(first: 50) {
                            nodes {
                                title
                                quantity
                                sku
                                variant { id }
                                originalUnitPriceSet { shopMoney { amount currencyCode } }
                            }
                        }
                    }
                    pageInfo { hasNextPage endCursor }
                }
            }
        `,
            { first, after, query: search }
        );
        const nodes = data.abandonedCheckouts?.nodes || [];
        return nodes.map((n) => ({
            id: gidToRestId(n.id),
            admin_graphql_api_id: n.id,
            abandoned_checkout_url: n.abandonedCheckoutUrl,
            created_at: n.createdAt,
            completed_at: n.completedAt,
            total_price: moneyAmount(n.totalPriceSet?.shopMoney),
            currency: n.totalPriceSet?.shopMoney?.currencyCode,
            customer: n.customer
                ? { id: gidToRestId(n.customer.id), email: n.customer.email }
                : null,
            line_items: (n.lineItems?.nodes || []).map((li) => ({
                variant_id: gidToRestId(li.variant?.id),
                sku: li.sku,
                title: li.title,
                quantity: li.quantity,
                price: moneyAmount(li.originalUnitPriceSet?.shopMoney),
            })),
        }));
    }

    /**
     * getVariantByInventoryItemId — GraphQL `inventoryItem { variant }`.
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/inventoryItem
     */
    async getVariantByInventoryItemId({ inventoryItemId } = {}) {
        const gid = this._toGid('InventoryItem', inventoryItemId);
        const data = await this.graphql(
            `
            query VariantByInventoryItem($id: ID!) {
                inventoryItem(id: $id) {
                    id
                    variant {
                        id
                        title
                        sku
                        product { id title }
                    }
                }
            }
        `,
            { id: gid }
        );
        const variant = data.inventoryItem?.variant;
        if (!variant) return null;
        return {
            id: gidToRestId(variant.id),
            admin_graphql_api_id: variant.id,
            title: variant.title,
            sku: variant.sku,
            product_id: gidToRestId(variant.product?.id),
            inventory_item_id: gidToRestId(data.inventoryItem.id),
        };
    }

    /**
     * listLocations — GraphQL `locations`.
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/locations
     */
    async listLocations(params = {}) {
        const first = Math.min(Number(params.limit) || 50, 250);
        const data = await this.graphql(
            `
            query ListLocations($first: Int!) {
                locations(first: $first) {
                    nodes {
                        id
                        name
                        isActive
                        address {
                            address1 city provinceCode countryCode zip
                        }
                    }
                }
            }
        `,
            { first }
        );
        return (data.locations?.nodes || []).map((loc) => ({
            id: gidToRestId(loc.id),
            admin_graphql_api_id: loc.id,
            name: loc.name,
            active: loc.isActive,
            address: loc.address,
        }));
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * createWebhook — GraphQL `webhookSubscriptionCreate`.
     * https://shopify.dev/docs/api/admin-graphql/latest/mutations/webhookSubscriptionCreate
     *
     * Capability inputs: topic, address, format
     */
    async createWebhook({ topic, address, format } = {}) {
        const gqlTopic = toGraphqlTopic(topic);
        const webhookSubscription = {
            callbackUrl: address,
            format: (format || 'JSON').toUpperCase(),
        };
        const data = await this.graphql(
            `
            mutation CreateWebhook(
                $topic: WebhookSubscriptionTopic!
                $webhookSubscription: WebhookSubscriptionInput!
            ) {
                webhookSubscriptionCreate(
                    topic: $topic
                    webhookSubscription: $webhookSubscription
                ) {
                    webhookSubscription {
                        id
                        topic
                        endpoint {
                            __typename
                            ... on WebhookHttpEndpoint { callbackUrl }
                        }
                        createdAt
                        format
                    }
                    userErrors { field message }
                }
            }
        `,
            { topic: gqlTopic, webhookSubscription }
        );
        this._assertUserErrors(data.webhookSubscriptionCreate?.userErrors);
        const wh = data.webhookSubscriptionCreate.webhookSubscription;
        return {
            webhook: {
                id: gidToRestId(wh.id),
                admin_graphql_api_id: wh.id,
                topic: wh.topic,
                address: wh.endpoint?.callbackUrl || address,
                format: wh.format,
                created_at: wh.createdAt,
            },
        };
    }

    /**
     * deleteWebhook — GraphQL `webhookSubscriptionDelete`.
     * https://shopify.dev/docs/api/admin-graphql/latest/mutations/webhookSubscriptionDelete
     */
    async deleteWebhook({ id } = {}) {
        const gid = this._toGid('WebhookSubscription', id);
        const data = await this.graphql(
            `
            mutation DeleteWebhook($id: ID!) {
                webhookSubscriptionDelete(id: $id) {
                    deletedWebhookSubscriptionId
                    userErrors { field message }
                }
            }
        `,
            { id: gid }
        );
        this._assertUserErrors(data.webhookSubscriptionDelete?.userErrors);
        return {
            deletedWebhookSubscriptionId:
                data.webhookSubscriptionDelete.deletedWebhookSubscriptionId,
        };
    }

    /**
     * listWebhookSubscriptions — GraphQL `webhookSubscriptions`.
     * https://shopify.dev/docs/api/admin-graphql/latest/queries/webhookSubscriptions
     */
    async listWebhookSubscriptions(params = {}) {
        const first = Math.min(Number(params.limit) || 50, 250);
        const data = await this.graphql(
            `
            query ListWebhooks($first: Int!) {
                webhookSubscriptions(first: $first) {
                    nodes {
                        id
                        topic
                        format
                        createdAt
                        endpoint {
                            __typename
                            ... on WebhookHttpEndpoint { callbackUrl }
                        }
                    }
                }
            }
        `,
            { first }
        );
        return (data.webhookSubscriptions?.nodes || []).map((wh) => ({
            id: gidToRestId(wh.id),
            admin_graphql_api_id: wh.id,
            topic: wh.topic,
            address: wh.endpoint?.callbackUrl,
            format: wh.format,
            created_at: wh.createdAt,
        }));
    }

    /**
     * Verify an HTTPS webhook delivery HMAC.
     * https://shopify.dev/docs/apps/build/webhooks/subscribe/https
     *
     * Capability contract: ({ headers, body, query }) -> true
     */
    verifyWebhookSignature({ headers = {}, body } = {}) {
        const headerName = Object.keys(headers).find(
            (k) => k.toLowerCase() === 'x-shopify-hmac-sha256'
        );
        const hmacHeader = headerName ? headers[headerName] : undefined;
        if (!hmacHeader || !this.client_secret) return false;

        let raw;
        if (Buffer.isBuffer(body)) raw = body;
        else if (typeof body === 'string') raw = Buffer.from(body, 'utf8');
        else if (body === undefined || body === null) raw = Buffer.from('');
        else raw = Buffer.from(JSON.stringify(body), 'utf8');

        const digest = crypto
            .createHmac('sha256', this.client_secret)
            .update(raw)
            .digest('base64');

        try {
            const a = Buffer.from(digest, 'base64');
            const b = Buffer.from(String(hmacHeader), 'base64');
            return a.length === b.length && crypto.timingSafeEqual(a, b);
        } catch {
            return false;
        }
    }

    // ---- Internals ---------------------------------------------------------

    _toGid(type, id) {
        if (id === null || id === undefined) return id;
        const s = String(id);
        if (s.startsWith('gid://')) return s;
        return `gid://shopify/${type}/${s}`;
    }

    _assertUserErrors(userErrors) {
        if (Array.isArray(userErrors) && userErrors.length > 0) {
            const err = new Error(
                userErrors.map((e) => e.message).join('; ') || 'Shopify userErrors'
            );
            err.userErrors = userErrors;
            throw err;
        }
    }
}

module.exports = { Api, API_VERSION, toGraphqlTopic, gidToRestId };
