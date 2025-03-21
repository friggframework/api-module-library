const {OAuth2Requester, get} = require('@friggframework/core');
const fetch = require('node-fetch');
const querystring = require('node:querystring');
const FormData = require('node:form-data');

/**
 * Frontify API client
 * @extends OAuth2Requester
 */
class Api extends OAuth2Requester {
    /**
     * Creates a new Frontify API client
     * @param {Object} params - Configuration parameters
     * @param {string} [params.domain] - Frontify domain
     */
    constructor(params) {
        super(params);
        this.domain = get(params, 'domain', null);

        if (this.domain) {
            this.baseUrl = `https://${this.domain}/graphql`;
            this.tokenUri = `https://${this.domain}/api/oauth/accesstoken`;
            this.tokenRefresh = `https://${this.domain}/api/oauth/refresh`;
        }
    }

    /**
     * Sets the Frontify domain and updates related URLs
     * @param {string} domain - Frontify domain
     */
    setDomain(domain) {
        this.domain = domain;
        this.baseUrl = `https://${this.domain}/graphql`;
        this.tokenUri = `https://${this.domain}/api/oauth/accesstoken`;
        this.tokenRefresh = `https://${this.domain}/api/oauth/refresh`;
    }

    /**
     * Gets the authorization URI for OAuth2 flow
     * @returns {string} The authorization URI
     */
    getAuthUri() {
        const query = {
            client_id: this.client_id,
            response_type: 'code',
            redirect_uri: this.redirect_uri,
            scope: this.scope,
            state: this.state,
        };

        let authorizationUri;

        if (this.domain) {
            authorizationUri = `https://${this.domain}/api/oauth/authorize`;
        } else {
            authorizationUri = 'https://{{domain}}/api/oauth/authorize';
        }

        return `${authorizationUri}?${querystring.stringify(query)}`;
    }

    /**
     * Refreshes the access token using a refresh token
     * @param {Object} refreshTokenObject - Object containing the refresh token
     * @param {string} refreshTokenObject.refresh_token - The refresh token
     * @returns {Promise<Object>} The response containing new tokens
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('refresh_token', refreshTokenObject.refresh_token);
        params.append('redirect_uri', this.redirect_uri);

        const options = {
            body: params,
            url: this.tokenRefresh,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /**
     * Builds GraphQL request options
     * @param {string} query - GraphQL query
     * @returns {Object} Request options for GraphQL query
     */
    buildRequestOptions(query) {
        return {
            url: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
            },
            body: {
                query,
            },
        };
    }

    /**
     * Asserts that a GraphQL response is valid
     * @private
     * @param {Object} response - GraphQL response
     * @throws {Error} If the response contains errors
     */
    assertResponse(response) {
        if (response.errors) {
            const {errors} = response;
            throw new Error(errors[0].message);
        }
    }

    /**
     * Gets the current user's information
     * @returns {Promise<Object>} User information
     */
    async getUser() {
        const query = `query CurrentUser {
                         currentUser {
                           id
                           email
                           name
                         }
                       }`;

        const response = await this._post(this.buildRequestOptions(query));
        this.assertResponse(response);
        return {
            user: response.data.currentUser,
        };
    }

    /**
     * Gets an asset by ID
     * @param {Object} query - Query parameters
     * @param {string} query.assetId - ID of the asset
     * @returns {Promise<Object>} Asset details
     */
    async getAsset(query) {
        const ql = `query Asset {
                      asset(id: "${query.assetId}") {
                        id
                        title
                        status
                        __typename
                        tags {
                          source
                          value
                        }
                        ${this._filesQuery()}
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        return response.data.asset;
    }

    /**
     * Gets permissions for an asset
     * @param {Object} query - Query parameters
     * @param {string} query.assetId - ID of the asset
     * @returns {Promise<Object>} Asset permissions
     */
    async getAssetPermissions(query) {
        const ql = `query AssetPermissions {
                      asset(id: "${query.assetId}") {
                          currentUserPermissions {
                            canEdit
                            canDelete
                            canComment
                            canDownload
                          }
                        }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        return {
            permissions: response.data.asset.currentUserPermissions,
        };
    }

    /**
     * Gets permissions for a library
     * @param {Object} query - Query parameters
     * @param {string} query.libraryId - ID of the library
     * @returns {Promise<Object>} Library permissions
     */
    async getLibraryPermissions(query) {
        const ql = `query LibraryPermissions {
                      library(id: "${query.libraryId}") {
                          currentUserPermissions {
                            canCreateAssets
                            canViewCollaborators
                            canCreateCollections
                          }
                        }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        return {
            permissions: response.data.library.currentUserPermissions,
        };
    }

    /**
     * Gets permissions for a project
     * @param {Object} query - Query parameters
     * @param {string} query.projectId - ID of the project
     * @returns {Promise<Object>} Project permissions
     */
    async getProjectPermissions(query) {
        const ql = `query ProjectPermissions {
                      workspaceProject(id: "${query.projectId}") {
                          currentUserPermissions {
                            canCreateAssets
                            canViewCollaborators
                          }
                        }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        return {
            permissions: response.data.workspaceProject.currentUserPermissions,
        };
    }

    /**
     * Lists permissions for all libraries and projects in a brand
     * @param {Object} query - Query parameters
     * @param {string} query.brandId - ID of the brand
     * @returns {Promise<Object>} Object containing libraries and projects with their permissions
     */
    async listBrandPermissions(query) {
        const ql = `query Brands {
                      brand(id: "${query.brandId}") {
                        libraries {
                          items {
                            id
                            name
                            currentUserPermissions {
                              canCreateAssets
                              canViewCollaborators
                              canCreateCollections
                            }
                          }
                        }
                        workspaceProjects{
                          items{
                            id
                            name
                            currentUserPermissions{
                              canCreateAssets
                              canViewCollaborators
                            }
                          }
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const {brand} = response.data;

        const libraries = brand.libraries.items.map(item => ({
            id: item.id,
            name: item.name,
            permissions: item.currentUserPermissions
        }));

        const projects = brand.workspaceProjects.items.map(item => ({
            id: item.id,
            name: item.name,
            permissions: item.currentUserPermissions
        }));

        return {libraries, projects};
    }

    /**
     * Gets available search filter options
     * @returns {Promise<Object>} Available filter options
     */
    async getSearchFilterOptions() {
        return {
            status: ['FINISHED', 'PROCESSING', 'PROCESSING_FAILED'],
            fileTypes: [
                'Audio',
                'Document',
                'File',
                'Image',
                'Video',
                'EmbeddedContent'
            ]
        };
    }

    /**
     * Lists all brands
     * @returns {Promise<Object>} List of brands
     */
    async listBrands() {
        const ql = `query Brands {
                      brands {
                        id
                        avatar
                        name
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        return response.data;
    }

    /**
     * Lists assets in a brand
     * @param {Object} query - Query parameters
     * @param {string} query.brandId - ID of the brand
     * @param {number} [query.limit=10] - Number of items per page
     * @param {string} [query.searchTerm='off'] - Search term
     * @returns {Promise<Object>} List of brand assets
     */
    async listBrandAssets({ brandId, limit = 10, searchTerm = 'off' }) {
        const query = `query BrandLevelSearch {
            brand(id: "${brandId}") {
                id
                name
                search(page: 1, limit: ${limit}, query: {term: "${searchTerm}"}) {
                    total
                    edges {
                        title
                    }
                }
            }
        }`;

        const response = await this._post(this.buildRequestOptions(query));
        this.assertResponse(response);
        return response.data.brand;
    }

    /**
     * Lists projects in a brand
     * @param {Object} query - Query parameters
     * @param {string} query.brandId - ID of the brand
     * @param {number} [query.page=1] - Page number
     * @param {number} [query.limit=25] - Items per page
     * @returns {Promise<Object>} Paginated list of projects
     */
    async listProjects(query) {
        const ql = `query Projects {
                      brand(id: "${query.brandId}") {
                        workspaceProjects(${this._paginationParamsQuery(query)}) {
                          items {
                            id
                            name
                            currentUserPermissions {
                              canCreateAssets
                              canViewCollaborators
                            }
                          }
                          ${this._paginationPropsQuery()}
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const {
            items,
            total,
            page,
            hasNextPage
        } = response.data.brand.workspaceProjects;

        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Lists libraries in a brand
     * @param {Object} query - Query parameters
     * @param {string} query.brandId - ID of the brand
     * @param {number} [query.page=1] - Page number
     * @param {number} [query.limit=25] - Items per page
     * @returns {Promise<Object>} Paginated list of libraries
     */
    async listLibraries(query) {
        const ql = `query Libraries {
                      brand(id: "${query.brandId}") {
                        libraries(${this._paginationParamsQuery(query)}) {
                          items {
                            id
                            name
                            currentUserPermissions {
                              canCreateAssets
                              canViewCollaborators
                              canCreateCollections
                            }
                          }
                          ${this._paginationPropsQuery()}
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const {
            items,
            total,
            page,
            hasNextPage
        } = response.data.brand.libraries;

        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Lists collections in a library
     * @param {Object} query - Query parameters
     * @param {string} query.libraryId - ID of the library
     * @returns {Promise<Object>} List of collections
     */
    async listCollections(query) {
        const ql = `query Collections {
                    library(id: "${query.libraryId}") {
                      collections {
                        items {
                          id
                          name
                          __typename
                        }
                      }
                    }
                  }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        return response.data.library.collections;
    }

    /**
     * Lists assets in a project
     * @param {Object} query - Query parameters
     * @param {string} query.projectId - ID of the project
     * @param {number} [query.page=1] - Page number
     * @param {number} [query.limit=25] - Items per page
     * @returns {Promise<Object>} Paginated list of assets
     */
    async listProjectAssets(query) {
        const ql = `query ProjectAssets {
                      workspaceProject(id: "${query.projectId}") {
                        assets(${this._paginationParamsQuery(query)}) {
                          items {
                            id
                            title
                            description
                            tags {
                              source
                              value
                            }
                            __typename
                            ${this._filesQuery()}
                          }
                          ${this._paginationPropsQuery()}
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const {
            items,
            total,
            page,
            hasNextPage
        } = response.data.workspaceProject.assets;

        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Lists assets in a library
     * @param {Object} query - Query parameters
     * @param {string} query.libraryId - ID of the library
     * @param {number} [query.page=1] - Page number
     * @param {number} [query.limit=25] - Items per page
     * @returns {Promise<Object>} Paginated list of assets
     */
    async listLibraryAssets(query) {
        const ql = `query LibraryAssets {
                      library(id: "${query.libraryId}") {
                        assets(${this._paginationParamsQuery(query)}) {
                          items {
                            id
                            title
                            description
                            tags {
                              source
                              value
                            }
                            __typename
                            ${this._filesQuery()}
                          }
                          ${this._paginationPropsQuery()}
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const {
            items,
            total,
            page,
            hasNextPage
        } = response.data.library.assets;

        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Lists assets in a collection
     * @param {Object} query - Query parameters
     * @param {string} query.libraryId - ID of the library
     * @param {string} query.collectionId - ID of the collection
     * @param {number} [query.page=1] - Page number
     * @param {number} [query.limit=25] - Items per page
     * @returns {Promise<Object>} Paginated list of assets
     * @throws {Error} If collection is not found
     */
    async listCollectionsAssets(query) {
        const ql = `query ListCollectionsAssetsForLibrary {
                      library(id: "${query.libraryId}") {
                        id
                        name
                        collections {
                          items {
                            id
                            name
                            __typename
                            assets(${this._paginationParamsQuery(query)})	{
                              items {
                                id
                                title
                                description
                                tags {
                                  source
                                  value
                                }
                                __typename
                                ${this._filesQuery()}
                              }
                              ${this._paginationPropsQuery()}
                            }
                          }
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const collection = response.data.library.collections.items.find(collection => collection.id === query.collectionId);

        if (!collection) {
            throw new Error('Collection not found');
        }

        const {
            items,
            total,
            page,
            hasNextPage
        } = collection.assets;

        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Lists folders in a project with optional recursive nesting
     * @param {Object} query - Query parameters
     * @param {string} query.projectId - ID of the project
     * @param {number} [query.page=1] - Page number for pagination
     * @param {number} [query.limit=25] - Number of items per page
     * @param {number} [query.nested=0] - Depth of nested folders to retrieve (max 10)
     * @param {number} [query.recursive=0] - Alias for nested
     * @returns {Promise<Object>} Paginated list of folders with nested structure if requested
     */
    async listProjectFolders(query) {
        const depth = Math.min(query?.nested || query?.recursive || 0, 10);
        const ql = `query ProjectFolders {
                      workspaceProject(id: "${query.projectId}") {
                        browse {
                          folders(${this._paginationParamsQuery(query)}) {
                            items {
                              id
                              name
                              __typename
                              ${this._nestedFoldersQuery(depth)}
                            }
                            ${this._paginationPropsQuery()}
                          }
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const {
            items,
            total,
            page,
            hasNextPage
        } = response.data.workspaceProject.browse.folders;

        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Lists folders in a library with optional recursive nesting
     * @param {Object} query - Query parameters
     * @param {string} query.libraryId - ID of the library
     * @param {number} [query.page=1] - Page number for pagination
     * @param {number} [query.limit=25] - Number of items per page
     * @param {number} [query.nested=0] - Depth of nested folders to retrieve (max 10)
     * @param {number} [query.recursive=0] - Alias for nested
     * @returns {Promise<Object>} Paginated list of folders with nested structure if requested
     */
    async listLibraryFolders(query) {
        const depth = Math.min(query?.nested || query?.recursive || 0, 10);
        const ql = `query LibraryFolders {
                      library(id: "${query.libraryId}") {
                        browse {
                          folders(${this._paginationParamsQuery(query)}) {
                            items {
                              id
                              name
                              createdAt
                              modifiedAt
                              __typename
                              ${this._nestedFoldersQuery(depth)}
                            }
                            ${this._paginationPropsQuery()}
                          }
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const {
            items,
            total,
            page,
            hasNextPage
        } = response.data.library.browse.folders;

        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Lists subfolders within a folder with optional recursive nesting
     * @param {Object} query - Query parameters
     * @param {string} query.subFolderId - ID of the parent folder
     * @param {number} [query.page=1] - Page number for pagination
     * @param {number} [query.limit=25] - Number of items per page
     * @param {number} [query.nested=0] - Depth of nested folders to retrieve (max 10)
     * @param {number} [query.recursive=0] - Alias for nested
     * @returns {Promise<Object>} Paginated list of subfolders with nested structure if requested
     */
    async listSubFolderFolders(query) {
        const depth = Math.min(query?.nested || query?.recursive || 0, 10);
        const ql = `query FolderById {
                      node(id: "${query.subFolderId}") {
                        ... on Folder {
                          name
                          folders(${this._paginationParamsQuery(query)}) {
                            items {
                              id
                              name
                              __typename
                              ${this._nestedFoldersQuery(depth)}
                            }
                            ${this._paginationPropsQuery()}
                          }
                        }
                      }
                    }`;
        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const {
            items,
            total,
            page,
            hasNextPage
        } = response.data.node.folders;

        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Executes a custom GraphQL query
     * @param {string} ql - GraphQL query
     * @returns {Promise<Object>} Query response
     */
    async getResponseUsingQuery(ql) {
        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        return response;
    }

    /**
     * Searches for assets in a brand
     * @param {Object} query - Query parameters
     * @param {string} query.brandId - ID of the brand
     * @param {string} query.term - Search term
     * @param {number} [query.page=1] - Page number
     * @param {number} [query.limit=25] - Items per page
     * @returns {Promise<Object>} Paginated search results
     */
    async searchInBrand(query) {
        const ql = `query BrandLevelSearch {
                      brand(id: "${query.brandId}") {
                        id
                        name
                        search(${this._paginationParamsQuery(query)}, query: {term: "${query.term}"}) {
                          edges {
                            title
                            node {
                              ... on Asset {
                                id,
                              modifiedAt,
                              description,
                              createdAt,
                              tags {
                                source,
                                value,
                              },
                              metadataValues {
                                id
                              },
                                externalId,
                                title,
                                status,
                                __typename,
                                creator {
                                  id,
                                  name,
                                  email
                                }

                              },
                              ${this._filesQuery()}
                            }
                          }
                          ${this._paginationPropsQuery()}
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);

        const {
            edges: items,
            total,
            page,
            hasNextPage
        } = response.data.brand.search;

        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Searches for assets in a library
     * @param {Object} query - Query parameters
     * @param {string} query.libraryId - ID of the library
     * @param {string} [query.search] - Search term
     * @param {string[]} [query.types] - Asset types to filter by
     * @param {string} [query.externalId] - External ID to filter by
     * @param {string} [query.sortBy] - Sort field
     * @param {Object} [query.filter] - Additional filters
     * @param {Object} [query.inFolder] - Folder to search in
     * @param {number} [query.page=1] - Page number
     * @param {number} [query.limit=25] - Items per page
     * @returns {Promise<Object>} Paginated search results
     */
    async searchLibraryAssets(query) {
        // Build the query parameters based on the AssetQueryInput structure
        const assetQueryParams = [];
        
        if (query.search) assetQueryParams.push(`search: "${query.search}"`);
        if (query.types && Array.isArray(query.types)) assetQueryParams.push(`types: [${query.types.join(', ')}]`);
        if (query.externalId) assetQueryParams.push(`externalId: "${query.externalId}"`);
        if (query.sortBy) assetQueryParams.push(`sortBy: ${query.sortBy}`);
        
        // Handle filter if provided
        if (query.filter) {
            const filterParams = [];
            if (query.filter.status) filterParams.push(`status: ${query.filter.status}`);
            if (query.filter.createdAt) filterParams.push(`createdAt: "${query.filter.createdAt}"`);
            if (query.filter.modifiedAt) filterParams.push(`modifiedAt: "${query.filter.modifiedAt}"`);
            
            if (filterParams.length > 0) {
                assetQueryParams.push(`filter: {${filterParams.join(', ')}}`);
            }
        }
        
        // Handle inFolder if provided
        if (query.inFolder) {
            assetQueryParams.push(`inFolder: {id: "${query.inFolder.id}"}`);
        }
        
        const assetQueryString = assetQueryParams.length > 0 ? `query: {${assetQueryParams.join(', ')}}` : '';
        
        const ql = `query LibraryAssetSearch {
                      library(id: "${query.libraryId}") {
                        assets(${this._paginationParamsQuery(query)}${assetQueryString ? `, ${assetQueryString}` : ''}) {
                          items {
                            id
                            title
                            description
                            status
                            externalId
                            createdAt
                            modifiedAt                          
                            tags {
                              source
                              value
                            }
                            __typename
                            ${this._filesQuery()}
                          }
                          ${this._paginationPropsQuery()}
                        }
                      }
                    }`;
        
        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        
        const {
            items,
            total,
            page,
            hasNextPage
        } = response.data.library.assets;
        
        return {
            items,
            total,
            page,
            hasNextPage
        };
    }
    
    /**
     * Searches for assets in a workspace
     * @param {Object} query - Query parameters
     * @param {string} query.projectId - ID of the project
     * @param {string} [query.search] - Search term
     * @param {string[]} [query.types] - Asset types to filter by
     * @param {string} [query.externalId] - External ID to filter by
     * @param {string} [query.sortBy] - Sort field
     * @param {Object} [query.filter] - Additional filters
     * @param {Object} [query.inFolder] - Folder to search in
     * @param {number} [query.page=1] - Page number
     * @param {number} [query.limit=25] - Items per page
     * @returns {Promise<Object>} Paginated search results
     */
    async searchWorkspaceAssets(query) {
        // Build the query parameters based on the AssetQueryInput structure
        const assetQueryParams = [];
        
        if (query.search) assetQueryParams.push(`search: "${query.search}"`);
        if (query.types && Array.isArray(query.types)) assetQueryParams.push(`types: [${query.types.join(', ')}]`);
        if (query.externalId) assetQueryParams.push(`externalId: "${query.externalId}"`);
        if (query.sortBy) assetQueryParams.push(`sortBy: ${query.sortBy}`);
        
        // Handle filter if provided
        if (query.filter) {
            const filterParams = [];
            if (query.filter.status) filterParams.push(`status: ${query.filter.status}`);
            if (query.filter.createdAt) filterParams.push(`createdAt: "${query.filter.createdAt}"`);
            if (query.filter.modifiedAt) filterParams.push(`modifiedAt: "${query.filter.modifiedAt}"`);
            
            if (filterParams.length > 0) {
                assetQueryParams.push(`filter: {${filterParams.join(', ')}}`);
            }
        }
        
        // Handle inFolder if provided
        if (query.inFolder) {
            assetQueryParams.push(`inFolder: {id: "${query.inFolder.id}"}`);
        }
        
        const assetQueryString = assetQueryParams.length > 0 ? `query: {${assetQueryParams.join(', ')}}` : '';
        
        const ql = `query WorkspaceAssetSearch {
                      workspaceProject(id: "${query.projectId}") {
                        assets(${this._paginationParamsQuery(query)}${assetQueryString ? `, ${assetQueryString}` : ''}) {
                          items {
                            id
                            title
                            description
                            status
                            externalId
                            createdAt
                            modifiedAt                            
                            tags {
                              source
                              value
                            }
                            __typename
                            ${this._filesQuery()}
                          }
                          ${this._paginationPropsQuery()}
                        }
                      }
                    }`;
        
        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        
        const {
            items,
            total,
            page,
            hasNextPage
        } = response.data.workspaceProject.assets;
        
        return {
            items,
            total,
            page,
            hasNextPage
        };
    }

    /**
     * Creates a new asset
     * @param {Object} asset - Asset details
     * @param {string} asset.id - File ID
     * @param {string} asset.title - Asset title
     * @param {string} asset.projectId - ID of the parent project
     * @returns {Promise<Object>} Created asset ID
     */
    async createAsset(asset) {
        const ql = `mutation CreateAsset {
                      createAsset(input: {
                        fileId: "${asset.id}",
                        title: "${asset.title}",
                        parentId: "${asset.projectId}"
                      }) {
                        job {
                          assetId
                        }
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        return {
            id: response.data.createAsset.job.assetId
        };
    }

    /**
     * Creates a file ID for upload
     * @param {Object} input - Upload details
     * @param {string} input.filename - Name of the file
     * @param {number} input.size - Size of the file in bytes
     * @param {number} input.chunkSize - Size of each chunk in bytes
     * @returns {Promise<Object>} Upload ID and URLs
     */
    async createFileId(input) {
        const ql = `mutation UploadFile {
                      uploadFile(input: {
                        filename: "${input.filename}",
                        size: ${input.size},
                        chunkSize: ${input.chunkSize}
                      }) {
                        id
                        urls
                      }
                    }`;

        const response = await this._post(this.buildRequestOptions(ql));
        this.assertResponse(response);
        return response.data.uploadFile;
    }

    /**
     * Uploads a file using provided URLs
     * @param {ReadableStream} stream - File stream
     * @param {string[]} urls - Upload URLs
     * @returns {Promise<Object[]>} Upload responses
     */
    async uploadFile(stream, urls) {
        const responses = [];

        const url = urls.shift();

        const resp = await fetch(url, {
            method: 'PUT',
            headers: {
                'content-type': 'binary'
            },
            body: stream
        });

        responses.push(resp);

        return responses;
    }

    /**
     * Generates a nested folders query structure for GraphQL
     * @private
     * @param {number} [depth=0] - Depth of nesting (max 10)
     * @returns {string} GraphQL query fragment for nested folders
     */
    _nestedFoldersQuery(depth = 0) {
        const maxDepth = 10;
        if (depth <= 0) return '';
        const safeDepth = depth > maxDepth ? maxDepth : depth;
        
        return `
          folders {
            items {
              id
              name
              createdAt
              modifiedAt
              __typename
              ${this._nestedFoldersQuery(safeDepth - 1)}
            }
            ${this._paginationPropsQuery()}
          }
        `;
    }

    /**
     * Generates pagination parameters for GraphQL queries
     * @private
     * @param {Object} query - Query parameters
     * @param {number} [query.page=1] - Page number
     * @param {number} [query.limit=25] - Items per page
     * @returns {string} GraphQL pagination parameters
     */
    _paginationParamsQuery(query) {
        return `page: ${query.page || 1}, limit: ${query.limit || 25}`;
    }

    /**
     * Generates pagination properties for GraphQL queries
     * @private
     * @returns {string} GraphQL pagination properties
     */
    _paginationPropsQuery() {
        return `total
                page
                hasNextPage`;
    }

    /**
     * Generates file type specific fields for GraphQL queries
     * @private
     * @returns {string} GraphQL file type fields
     */
    _filesQuery() {
        const commonProps = [
            'description',
            'downloadUrl',
            'filename',
            'previewUrl',
            'size',
            'extension',
            'createdAt',
            'modifiedAt',
        ];

        const dimensionProps = [
            'height',
            'width',
        ];
        return `... on Audio {
                  ${commonProps.join(' ')}
                }
                ... on Document {
                  ${commonProps.join(' ')}
                  ${dimensionProps.join(' ')}
                }
                ... on File {
                  ${commonProps.join(' ')}
                }
                ... on Image {
                  ${commonProps.join(' ')}
                  ${dimensionProps.join(' ')}
                }
                ... on Video {
                  ${commonProps.join(' ')}
                  ${dimensionProps.join(' ')}
                  duration
                  bitrate
                }
                ... on EmbeddedContent {
                  description
                  previewUrl
                  status
                }`;
    }
}

module.exports = {Api};
