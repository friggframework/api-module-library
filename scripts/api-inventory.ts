// API Inventory Types and Manager for 4000+ API scale

export interface APIEntry {
  id: string;                // Unique identifier (slug)
  name: string;              // Display name
  implemented: boolean;      // Is it implemented in our library?
  openapi: boolean;          // Has OpenAPI/Swagger spec?
  fenestra: boolean;         // Has Fenestra UI spec?
  frigg: boolean;            // Has Frigg extensions?
  auth: AuthType;            // Authentication method
  cat: Category;             // Main category
  subcat?: string;           // Subcategory
  notes?: string;            // Additional notes
  priority?: Priority;       // Implementation priority
  lefthook?: string;         // Lefthook status
  updated: string;           // ISO date string
  
  // Optional extended fields for scale
  version?: string;          // API version we support
  deprecated?: boolean;      // Is this API deprecated?
  alternatives?: string[];   // Alternative API IDs
  dependencies?: string[];   // Other APIs this depends on
  enterprise?: boolean;      // Enterprise-only API?
  region?: string[];         // Geographic restrictions
  pricing?: PricingTier;     // Free, Paid, Enterprise
  rateLimit?: RateLimit;     // Rate limiting info
}

export type AuthType = 
  | 'OAuth2' 
  | 'OAuth1' 
  | 'API Key' 
  | 'Bearer Token' 
  | 'Basic Auth' 
  | 'JWT' 
  | 'Custom' 
  | 'None'
  | 'Unknown';

export type Category = 
  | 'AI/ML'
  | 'Analytics'
  | 'Communication'
  | 'CRM'
  | 'Developer'
  | 'E-commerce'
  | 'Education'
  | 'Finance'
  | 'Gaming'
  | 'Healthcare'
  | 'HR'
  | 'Legal'
  | 'Marketing'
  | 'Media'
  | 'Productivity'
  | 'Real Estate'
  | 'Security'
  | 'Social'
  | 'Travel'
  | 'Other';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PricingTier = 'FREE' | 'FREEMIUM' | 'PAID' | 'ENTERPRISE';

export interface RateLimit {
  requests: number;
  window: string; // e.g., "1h", "1d"
  tier?: string;
}

export interface APIIndex {
  version: string;
  last_updated: string;
  stats: {
    total: number;
    implemented: number;
    with_openapi: number;
    with_fenestra: number;
    with_frigg: number;
    by_category: Record<Category, number>;
    by_auth: Record<AuthType, number>;
    by_priority: Record<Priority, number>;
  };
  categories: Record<Category, string[]>;
  quick_lookup: Record<string, number>; // id -> line number
  
  // Bloom filter for fast existence checks at scale
  bloom_filter?: {
    size: number;
    hash_count: number;
    bits: string; // Base64 encoded bit array
  };
}

// Optimized storage strategies for 4000+ APIs
export interface StorageStrategy {
  // Primary storage: JSONL for streaming and append-only operations
  primary: 'jsonl';
  
  // Index storage: JSON with compressed options
  index: 'json' | 'msgpack' | 'protobuf';
  
  // Cache strategy
  cache: {
    type: 'memory' | 'redis' | 'sqlite';
    max_items: number;
    ttl: number; // seconds
  };
  
  // Sharding strategy for massive scale
  sharding?: {
    enabled: boolean;
    strategy: 'alphabetical' | 'hash' | 'category';
    shards: number;
  };
}

// Query interface for efficient lookups
export interface QueryOptions {
  // Filters
  implemented?: boolean;
  category?: Category | Category[];
  auth?: AuthType | AuthType[];
  hasOpenAPI?: boolean;
  priority?: Priority | Priority[];
  
  // Pagination
  offset?: number;
  limit?: number;
  
  // Sorting
  sortBy?: keyof APIEntry;
  sortOrder?: 'asc' | 'desc';
  
  // Performance hints
  useCache?: boolean;
  parallel?: boolean;
}

// Batch operations for efficiency
export interface BatchOperation {
  type: 'upsert' | 'delete' | 'update';
  apis: Partial<APIEntry>[];
  options?: {
    validate?: boolean;
    atomic?: boolean;
    skipIndex?: boolean; // Rebuild index after all ops
  };
}

// Migration utilities for converting from other formats
export interface MigrationSource {
  type: 'markdown' | 'csv' | 'json' | 'lefthook' | 'postman';
  path?: string;
  url?: string;
  mapping?: Record<string, keyof APIEntry>;
}

// Export formats for different use cases
export interface ExportOptions {
  format: 'json' | 'jsonl' | 'csv' | 'markdown' | 'sql' | 'parquet';
  filters?: QueryOptions;
  fields?: (keyof APIEntry)[];
  pretty?: boolean;
  compress?: boolean;
}