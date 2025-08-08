// Mock data for Recharge API testing

export const mockCustomer = {
    id: '123456',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    billing_address1: '123 Main St',
    billing_address2: '',
    billing_city: 'New York',
    billing_province: 'NY',
    billing_zip: '10001',
    billing_country: 'United States',
    billing_phone: '555-0123',
    processor_type: 'stripe',
    status: 'active',
    stripe_customer_token: 'cus_1234567890',
    has_valid_payment_method: true,
    has_card_error_in_dunning: false,
    subscriptions_count: 2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockAddress = {
    id: '456789',
    customer_id: '123456',
    address1: '123 Main St',
    address2: 'Apt 4B',
    city: 'New York',
    province: 'NY',
    zip: '10001',
    country: 'United States',
    first_name: 'John',
    last_name: 'Doe',
    phone: '555-0123',
    company: 'ACME Corp',
    cart_note: 'Please leave at front door',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockSubscription = {
    id: '789012',
    address_id: '456789',
    customer_id: '123456',
    status: 'active',
    next_charge_scheduled_at: '2024-02-01T00:00:00Z',
    cancelled_at: null,
    product_title: 'Premium Subscription',
    variant_title: 'Monthly Plan',
    price: 29.99,
    quantity: 1,
    charge_interval_frequency: 30,
    order_interval_frequency: 30,
    order_interval_unit: 'day',
    order_day_of_week: null,
    order_day_of_month: null,
    shopify_product_id: '1234567890',
    shopify_variant_id: '0987654321',
    sku: 'PREM-SUB-001',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockOrder = {
    id: '345678',
    customer_id: '123456',
    address_id: '456789',
    charge_id: '234567',
    email: 'test@example.com',
    transaction_id: 'ch_1234567890',
    charge_status: 'success',
    payment_processor: 'stripe',
    status: 'success',
    type: 'recurring',
    first_name: 'John',
    last_name: 'Doe',
    is_prepaid: false,
    line_items: [
        {
            subscription_id: '789012',
            shopify_product_id: '1234567890',
            shopify_variant_id: '0987654321',
            title: 'Premium Subscription',
            variant_title: 'Monthly Plan',
            sku: 'PREM-SUB-001',
            quantity: 1,
            price: 29.99,
            subtotal_price: 29.99,
            total_price: 29.99
        }
    ],
    subtotal_price: 29.99,
    total_discounts: 0.00,
    total_tax: 2.40,
    total_price: 32.39,
    total_refunds: 0.00,
    currency: 'USD',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    processed_at: '2024-01-01T00:00:00Z',
    scheduled_at: '2024-01-01T00:00:00Z',
    shipped_date: '2024-01-02T00:00:00Z'
};

export const mockCharge = {
    id: '234567',
    customer_id: '123456',
    address_id: '456789',
    type: 'recurring',
    status: 'success',
    error: null,
    error_type: null,
    processor_name: 'stripe',
    transaction_id: 'ch_1234567890',
    email: 'test@example.com',
    subtotal_price: 29.99,
    tax_lines: [
        {
            price: 2.40,
            rate: 0.08,
            title: 'State Tax'
        }
    ],
    total_discounts: 0.00,
    total_line_items_price: 29.99,
    total_price: 32.39,
    total_refunds: 0.00,
    total_tax: 2.40,
    total_weight: 1000,
    currency: 'USD',
    payment_processor: 'stripe',
    line_items: [
        {
            subscription_id: '789012',
            quantity: 1,
            price: 29.99
        }
    ],
    note: 'Monthly subscription charge',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    processed_at: '2024-01-01T00:00:00Z',
    scheduled_at: '2024-01-01T00:00:00Z',
    retry_date: null,
    shipments_count: 1
};

export const mockProduct = {
    id: '567890',
    title: 'Premium Subscription Box',
    images: {
        large: 'https://example.com/images/product-large.jpg',
        medium: 'https://example.com/images/product-medium.jpg',
        small: 'https://example.com/images/product-small.jpg',
        original: 'https://example.com/images/product-original.jpg'
    },
    collection_id: null,
    shopify_product_id: '1234567890',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockWebhook = {
    id: '987654',
    address: 'https://example.com/webhooks/recharge',
    topic: 'subscription/created',
    api_version: '2021-11',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockShop = {
    shop: {
        id: 12345,
        name: 'Test Shop',
        email: 'admin@testshop.com',
        domain: 'test-shop.myshopify.com',
        currency: 'USD',
        timezone: 'America/New_York',
        iana_timezone: 'America/New_York',
        my_shopify_domain: 'test-shop.myshopify.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
    }
};

export const mockMetafield = {
    id: '111222',
    key: 'custom_data',
    value: '{"preference": "monthly"}',
    value_type: 'json_string',
    namespace: 'customer_preferences',
    owner_resource: 'customer',
    owner_id: '123456',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockDiscount = {
    id: '333444',
    code: 'SAVE20',
    value: 20,
    status: 'active',
    discount_type: 'percentage',
    starts_at: '2024-01-01T00:00:00Z',
    ends_at: '2024-12-31T23:59:59Z',
    applies_to_resource: 'shopify_product',
    applies_to_id: '1234567890',
    applies_to_product_type: 'subscription',
    minimum_order_amount: null,
    usage_limit: null,
    usage_count: 42,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockCollection = {
    id: '555666',
    name: 'Monthly Boxes',
    description: 'Our selection of monthly subscription boxes',
    sort_order: 'manual',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockAsyncBatch = {
    id: '777888',
    status: 'completed',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T00:05:00Z',
    batch_type: 'bulk_subscriptions_update',
    tasks_count: 100,
    completed_tasks_count: 100,
    failed_tasks_count: 0
};

export const mockCheckout = {
    checkout_token: 'tok_1234567890',
    email: 'test@example.com',
    line_items: [
        {
            variant_id: '0987654321',
            quantity: 1,
            price: 29.99,
            product_id: '1234567890',
            title: 'Premium Subscription',
            variant_title: 'Monthly Plan'
        }
    ],
    subtotal_price: 29.99,
    total_tax: 2.40,
    total_price: 32.39,
    currency: 'USD',
    completed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockNotification = {
    id: '999000',
    customer_id: '123456',
    type: 'upcoming_charge',
    sent_at: null,
    scheduled_at: '2024-01-28T00:00:00Z',
    template_type: 'email',
    template_name: 'upcoming_charge_notification',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

// Error responses
export const mockErrors = {
    unauthorized: {
        error: 'Unauthorized',
        message: 'Invalid API key'
    },
    notFound: {
        error: 'Not Found',
        message: 'The requested resource was not found'
    },
    validationError: {
        error: 'Unprocessable Entity',
        errors: {
            email: ['is invalid', 'has already been taken'],
            first_name: ['is required']
        }
    },
    rateLimit: {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please retry after 60 seconds.'
    },
    serverError: {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.'
    }
};

// Pagination metadata
export const mockPaginationMeta = {
    page: 1,
    limit: 50,
    pages: 4,
    total: 175,
    prev_page: null,
    next_page: 2
};

// Helper functions to generate mock data
export const generateMockCustomer = (overrides: Partial<typeof mockCustomer> = {}) => ({
    ...mockCustomer,
    ...overrides,
    id: overrides.id || Math.random().toString(36).substr(2, 9),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
});

export const generateMockSubscription = (overrides: Partial<typeof mockSubscription> = {}) => ({
    ...mockSubscription,
    ...overrides,
    id: overrides.id || Math.random().toString(36).substr(2, 9),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
});

export const generateMockOrder = (overrides: Partial<typeof mockOrder> = {}) => ({
    ...mockOrder,
    ...overrides,
    id: overrides.id || Math.random().toString(36).substr(2, 9),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
});

export const generateMockWebhook = (overrides: Partial<typeof mockWebhook> = {}) => ({
    ...mockWebhook,
    ...overrides,
    id: overrides.id || Math.random().toString(36).substr(2, 9),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
});

// Batch response generators
export const generateMockCustomerList = (count: number, page: number = 1, limit: number = 50) => ({
    customers: Array.from({ length: Math.min(count, limit) }, (_, i) => 
        generateMockCustomer({ id: `customer_${(page - 1) * limit + i + 1}` })
    ),
    meta: {
        page,
        limit,
        pages: Math.ceil(count / limit),
        total: count
    }
});

export const generateMockSubscriptionList = (count: number, page: number = 1, limit: number = 50) => ({
    subscriptions: Array.from({ length: Math.min(count, limit) }, (_, i) => 
        generateMockSubscription({ id: `subscription_${(page - 1) * limit + i + 1}` })
    ),
    meta: {
        page,
        limit,
        pages: Math.ceil(count / limit),
        total: count
    }
});