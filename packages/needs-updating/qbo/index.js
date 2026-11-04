const {
    Api,
    DEFAULT_MINOR_VERSION,
    MINOR_VERSIONS_DOCS_URL,
} = require('./api');
const {Credential} = require('./models/credential');
const {Entity} = require('./models/entity');
const ModuleManager = require('./manager');
const Config = require('./defaultConfig');

module.exports = {
    Api,
    Credential,
    Entity,
    ModuleManager,
    Config,
    DEFAULT_MINOR_VERSION,
    MINOR_VERSIONS_DOCS_URL,
};
