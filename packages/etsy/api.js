const { OAuth2Requester, get } = require('@friggframework/core');

// Etsy Open API v3 client
// Supports OAuth2 authentication
// Documentation: https://developers.etsy.com/documentation/

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://openapi.etsy.com/v3';
        this.client_id = get(params, 'client_id', process.env.ETSY_CLIENT_ID);
        this.client_secret = get(params, 'client_secret', process.env.ETSY_CLIENT_SECRET);
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        
        // OAuth endpoints
        this.authorizationUri = 'https://www.etsy.com/oauth/connect';
        this.tokenUri = 'https://api.etsy.com/v3/public/oauth/token';

        this.URLs = {
            // Application
            ping: '/application/ping',
            
            // Shops
            shops: '/application/shops',
            shopById: (shopId) => `/application/shops/${shopId}`,
            shopSections: (shopId) => `/application/shops/${shopId}/sections`,
            shopSectionById: (shopId, sectionId) => `/application/shops/${shopId}/sections/${sectionId}`,
            shopPolicies: (shopId) => `/application/shops/${shopId}/policies`,
            shopReceipts: (shopId) => `/application/shops/${shopId}/receipts`,
            shopReceiptById: (shopId, receiptId) => `/application/shops/${shopId}/receipts/${receiptId}`,
            
            // Listings
            listings: '/application/listings',
            listingById: (listingId) => `/application/listings/${listingId}`,
            listingsByShop: (shopId) => `/application/shops/${shopId}/listings`,
            listingImages: (listingId) => `/application/listings/${listingId}/images`,
            listingImageById: (listingId, imageId) => `/application/listings/${listingId}/images/${imageId}`,
            listingInventory: (listingId) => `/application/listings/${listingId}/inventory`,
            listingProducts: (listingId) => `/application/listings/${listingId}/products`,
            listingReviews: (listingId) => `/application/listings/${listingId}/reviews`,
            listingVideos: (listingId) => `/application/listings/${listingId}/videos`,
            listingTranslation: (listingId, language) => `/application/listings/${listingId}/translations/${language}`,
            listingVariationImages: (listingId) => `/application/listings/${listingId}/variation-images`,
            
            // User/Shop Management
            user: '/application/user',
            userProfile: '/application/user/profile',
            userAddress: '/application/user/addresses',
            userAddressById: (addressId) => `/application/user/addresses/${addressId}`,
            userAccount: '/application/user/account',
            
            // Shop Management
            myShops: '/application/user/shops',
            myShopById: (shopId) => `/application/user/shops/${shopId}`,
            myShopListings: (shopId) => `/application/user/shops/${shopId}/listings`,
            myShopReceipts: (shopId) => `/application/user/shops/${shopId}/receipts`,
            myShopReceiptById: (shopId, receiptId) => `/application/user/shops/${shopId}/receipts/${receiptId}`,
            
            // Payments
            shopPaymentAccountLedgerEntries: (shopId) => `/application/shops/${shopId}/payment-account/ledger-entries`,
            shopPaymentAccountLedgerEntry: (shopId, entryId) => `/application/shops/${shopId}/payment-account/ledger-entries/${entryId}`,
            shopPaymentAccountLedgerEntryPayments: (shopId, entryId) => `/application/shops/${shopId}/payment-account/ledger-entries/${entryId}/payments`,
            
            // Shipping
            shippingCarriers: '/application/shipping-carriers',
            shippingTemplates: (shopId) => `/application/shops/${shopId}/shipping-templates`,
            shippingTemplateById: (shopId, templateId) => `/application/shops/${shopId}/shipping-templates/${templateId}`,
            shippingTemplateEntries: (shopId, templateId) => `/application/shops/${shopId}/shipping-templates/${templateId}/entries`,
            shippingTemplateUpgrades: (shopId, templateId) => `/application/shops/${shopId}/shipping-templates/${templateId}/upgrades`,
            
            // Taxonomy
            taxonomy: '/application/seller-taxonomy/nodes',
            taxonomyNode: (taxonomyId) => `/application/seller-taxonomy/nodes/${taxonomyId}`,
            taxonomyNodeProperties: (taxonomyId) => `/application/seller-taxonomy/nodes/${taxonomyId}/properties`,
            
            // Shop Production Partners
            shopProductionPartners: (shopId) => `/application/shops/${shopId}/production-partners`,
            
            // Categories and Attributes
            buyerTaxonomy: '/application/buyer-taxonomy/nodes',
            buyerTaxonomyNode: (taxonomyId) => `/application/buyer-taxonomy/nodes/${taxonomyId}`,
            buyerTaxonomyNodeProperties: (taxonomyId) => `/application/buyer-taxonomy/nodes/${taxonomyId}/properties`,
            
            // Reviews
            reviewsByShop: (shopId) => `/application/shops/${shopId}/reviews`,
            reviewById: (shopId, reviewId) => `/application/shops/${shopId}/reviews/${reviewId}`,
            
            // Favorites
            userFavoriteListings: '/application/user/favorites/listings',
            userFavoriteListingById: (listingId) => `/application/user/favorites/listings/${listingId}`,
            
            // Conversations
            conversations: '/application/user/conversations',
            conversationById: (conversationId) => `/application/user/conversations/${conversationId}`,
            conversationMessages: (conversationId) => `/application/user/conversations/${conversationId}/messages`,
            
            // Orders
            shopReceipts: (shopId) => `/application/shops/${shopId}/receipts`,
            shopReceiptById: (shopId, receiptId) => `/application/shops/${shopId}/receipts/${receiptId}`,
            receiptShipments: (shopId, receiptId) => `/application/shops/${shopId}/receipts/${receiptId}/shipments`,
            receiptTransactions: (shopId, receiptId) => `/application/shops/${shopId}/receipts/${receiptId}/transactions`,
            receiptTransactionById: (shopId, receiptId, transactionId) => `/application/shops/${shopId}/receipts/${receiptId}/transactions/${transactionId}`,
        };

        // Default scopes for Etsy API
        this.scope = get(params, 'scope', 'email_r profile_r shops_r listings_r');
    }

    // Generate OAuth authorization URL
    getAuthUri() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id,
            redirect_uri: this.redirect_uri,
            scope: this.scope,
            state: this.state || 'random_state_string',
        });
        
        return `${this.authorizationUri}?${params.toString()}`;
    }

    // Exchange authorization code for access token
    async getTokenFromCode(code) {
        const tokenData = {
            grant_type: 'authorization_code',
            client_id: this.client_id,
            redirect_uri: this.redirect_uri,
            code: code,
        };

        const options = {
            url: this.tokenUri,
            body: tokenData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${this.client_id}:${this.client_secret}`).toString('base64')}`,
            },
        };

        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // Refresh access token
    async refreshAccessToken() {
        if (!this.refresh_token) {
            throw new Error('No refresh token available');
        }

        const tokenData = {
            grant_type: 'refresh_token',
            refresh_token: this.refresh_token,
        };

        const options = {
            url: this.tokenUri,
            body: tokenData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${this.client_id}:${this.client_secret}`).toString('base64')}`,
            },
        };

        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // Set access and refresh tokens
    async setTokens(tokenResponse) {
        this.access_token = tokenResponse.access_token;
        if (tokenResponse.refresh_token) {
            this.refresh_token = tokenResponse.refresh_token;
        }
        
        if (tokenResponse.expires_in) {
            this.accessTokenExpire = new Date(Date.now() + tokenResponse.expires_in * 1000);
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    // Add authentication headers
    addAuthHeaders(options) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${this.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
    }

    async _get(options) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._get(options);
    }

    async _post(options, stringify = true) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._post(options, stringify);
    }

    async _put(options, stringify = true) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._put(options, stringify);
    }

    async _patch(options, stringify = true) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._patch(options, stringify);
    }

    async _delete(options) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._delete(options);
    }

    // **************************   Application   **********************************

    async ping() {
        const options = {
            url: this.URLs.ping,
        };
        return this._get(options);
    }

    // **************************   User Methods   **********************************

    async getUserProfile() {
        const options = {
            url: this.URLs.userProfile,
        };
        return this._get(options);
    }

    async getUser() {
        const options = {
            url: this.URLs.user,
        };
        return this._get(options);
    }

    async getUserAccount() {
        const options = {
            url: this.URLs.userAccount,
        };
        return this._get(options);
    }

    async getUserAddresses() {
        const options = {
            url: this.URLs.userAddress,
        };
        return this._get(options);
    }

    async getUserAddressById(addressId) {
        const options = {
            url: this.URLs.userAddressById(addressId),
        };
        return this._get(options);
    }

    // **************************   Shops   **********************************

    async getShopById(shopId, params = {}) {
        const options = {
            url: this.URLs.shopById(shopId),
            query: params
        };
        return this._get(options);
    }

    async findShops(params = {}) {
        const options = {
            url: this.URLs.shops,
            query: params
        };
        return this._get(options);
    }

    async getMyShops() {
        const options = {
            url: this.URLs.myShops,
        };
        return this._get(options);
    }

    async getShopSections(shopId) {
        const options = {
            url: this.URLs.shopSections(shopId),
        };
        return this._get(options);
    }

    async createShopSection(shopId, sectionData) {
        const options = {
            url: this.URLs.shopSections(shopId),
            body: sectionData,
        };
        return this._post(options);
    }

    async updateShopSection(shopId, sectionId, sectionData) {
        const options = {
            url: this.URLs.shopSectionById(shopId, sectionId),
            body: sectionData,
        };
        return this._put(options);
    }

    async deleteShopSection(shopId, sectionId) {
        const options = {
            url: this.URLs.shopSectionById(shopId, sectionId),
        };
        return this._delete(options);
    }

    async getShopPolicies(shopId) {
        const options = {
            url: this.URLs.shopPolicies(shopId),
        };
        return this._get(options);
    }

    // **************************   Listings   **********************************

    async createListing(shopId, listingData) {
        const options = {
            url: this.URLs.myShopListings(shopId),
            body: listingData,
        };
        return this._post(options);
    }

    async getListingsByShop(shopId, params = {}) {
        const options = {
            url: this.URLs.listingsByShop(shopId),
            query: params
        };
        return this._get(options);
    }

    async getMyShopListings(shopId, params = {}) {
        const options = {
            url: this.URLs.myShopListings(shopId),
            query: params
        };
        return this._get(options);
    }

    async getListingById(listingId, params = {}) {
        const options = {
            url: this.URLs.listingById(listingId),
            query: params
        };
        return this._get(options);
    }

    async updateListing(listingId, listingData) {
        const options = {
            url: this.URLs.listingById(listingId),
            body: listingData,
        };
        return this._put(options);
    }

    async deleteListing(listingId) {
        const options = {
            url: this.URLs.listingById(listingId),
        };
        return this._delete(options);
    }

    async getListingImages(listingId) {
        const options = {
            url: this.URLs.listingImages(listingId),
        };
        return this._get(options);
    }

    async uploadListingImage(listingId, imageData) {
        const options = {
            url: this.URLs.listingImages(listingId),
            body: imageData,
        };
        return this._post(options);
    }

    async deleteListingImage(listingId, imageId) {
        const options = {
            url: this.URLs.listingImageById(listingId, imageId),
        };
        return this._delete(options);
    }

    async getListingInventory(listingId) {
        const options = {
            url: this.URLs.listingInventory(listingId),
        };
        return this._get(options);
    }

    async updateListingInventory(listingId, inventoryData) {
        const options = {
            url: this.URLs.listingInventory(listingId),
            body: inventoryData,
        };
        return this._put(options);
    }

    async getListingProducts(listingId) {
        const options = {
            url: this.URLs.listingProducts(listingId),
        };
        return this._get(options);
    }

    async getListingReviews(listingId, params = {}) {
        const options = {
            url: this.URLs.listingReviews(listingId),
            query: params
        };
        return this._get(options);
    }

    // **************************   Orders / Receipts   **********************************

    async getShopReceipts(shopId, params = {}) {
        const options = {
            url: this.URLs.shopReceipts(shopId),
            query: params
        };
        return this._get(options);
    }

    async getShopReceiptById(shopId, receiptId) {
        const options = {
            url: this.URLs.shopReceiptById(shopId, receiptId),
        };
        return this._get(options);
    }

    async updateShopReceipt(shopId, receiptId, receiptData) {
        const options = {
            url: this.URLs.shopReceiptById(shopId, receiptId),
            body: receiptData,
        };
        return this._put(options);
    }

    async getReceiptTransactions(shopId, receiptId) {
        const options = {
            url: this.URLs.receiptTransactions(shopId, receiptId),
        };
        return this._get(options);
    }

    async getReceiptTransactionById(shopId, receiptId, transactionId) {
        const options = {
            url: this.URLs.receiptTransactionById(shopId, receiptId, transactionId),
        };
        return this._get(options);
    }

    async createReceiptShipment(shopId, receiptId, shipmentData) {
        const options = {
            url: this.URLs.receiptShipments(shopId, receiptId),
            body: shipmentData,
        };
        return this._post(options);
    }

    async getReceiptShipments(shopId, receiptId) {
        const options = {
            url: this.URLs.receiptShipments(shopId, receiptId),
        };
        return this._get(options);
    }

    // **************************   Reviews   **********************************

    async getShopReviews(shopId, params = {}) {
        const options = {
            url: this.URLs.reviewsByShop(shopId),
            query: params
        };
        return this._get(options);
    }

    async getShopReviewById(shopId, reviewId) {
        const options = {
            url: this.URLs.reviewById(shopId, reviewId),
        };
        return this._get(options);
    }

    // **************************   Shipping   **********************************

    async getShippingCarriers() {
        const options = {
            url: this.URLs.shippingCarriers,
        };
        return this._get(options);
    }

    async getShippingTemplates(shopId) {
        const options = {
            url: this.URLs.shippingTemplates(shopId),
        };
        return this._get(options);
    }

    async createShippingTemplate(shopId, templateData) {
        const options = {
            url: this.URLs.shippingTemplates(shopId),
            body: templateData,
        };
        return this._post(options);
    }

    async getShippingTemplateById(shopId, templateId) {
        const options = {
            url: this.URLs.shippingTemplateById(shopId, templateId),
        };
        return this._get(options);
    }

    async updateShippingTemplate(shopId, templateId, templateData) {
        const options = {
            url: this.URLs.shippingTemplateById(shopId, templateId),
            body: templateData,
        };
        return this._put(options);
    }

    async deleteShippingTemplate(shopId, templateId) {
        const options = {
            url: this.URLs.shippingTemplateById(shopId, templateId),
        };
        return this._delete(options);
    }

    async getShippingTemplateEntries(shopId, templateId) {
        const options = {
            url: this.URLs.shippingTemplateEntries(shopId, templateId),
        };
        return this._get(options);
    }

    // **************************   Taxonomy   **********************************

    async getSellerTaxonomy() {
        const options = {
            url: this.URLs.taxonomy,
        };
        return this._get(options);
    }

    async getSellerTaxonomyNode(taxonomyId) {
        const options = {
            url: this.URLs.taxonomyNode(taxonomyId),
        };
        return this._get(options);
    }

    async getSellerTaxonomyNodeProperties(taxonomyId) {
        const options = {
            url: this.URLs.taxonomyNodeProperties(taxonomyId),
        };
        return this._get(options);
    }

    async getBuyerTaxonomy() {
        const options = {
            url: this.URLs.buyerTaxonomy,
        };
        return this._get(options);
    }

    async getBuyerTaxonomyNode(taxonomyId) {
        const options = {
            url: this.URLs.buyerTaxonomyNode(taxonomyId),
        };
        return this._get(options);
    }

    // **************************   Favorites   **********************************

    async getUserFavoriteListings(params = {}) {
        const options = {
            url: this.URLs.userFavoriteListings,
            query: params
        };
        return this._get(options);
    }

    async addUserFavoriteListing(listingId) {
        const options = {
            url: this.URLs.userFavoriteListingById(listingId),
            body: {},
        };
        return this._post(options);
    }

    async removeUserFavoriteListing(listingId) {
        const options = {
            url: this.URLs.userFavoriteListingById(listingId),
        };
        return this._delete(options);
    }

    // **************************   Conversations   **********************************

    async getConversations(params = {}) {
        const options = {
            url: this.URLs.conversations,
            query: params
        };
        return this._get(options);
    }

    async getConversationById(conversationId) {
        const options = {
            url: this.URLs.conversationById(conversationId),
        };
        return this._get(options);
    }

    async getConversationMessages(conversationId, params = {}) {
        const options = {
            url: this.URLs.conversationMessages(conversationId),
            query: params
        };
        return this._get(options);
    }

    // **************************   Payments   **********************************

    async getShopPaymentAccountLedgerEntries(shopId, params = {}) {
        const options = {
            url: this.URLs.shopPaymentAccountLedgerEntries(shopId),
            query: params
        };
        return this._get(options);
    }

    async getShopPaymentAccountLedgerEntry(shopId, entryId) {
        const options = {
            url: this.URLs.shopPaymentAccountLedgerEntry(shopId, entryId),
        };
        return this._get(options);
    }
}

module.exports = { Api };