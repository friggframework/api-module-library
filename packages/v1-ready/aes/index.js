const { Api } = require('./api');
const { Definition } = require('./definition');
const Config = require('./defaultConfig.json');
const contactMapping = require('./mappings/contact');

module.exports = {
    Api,
    Config,
    Definition,
    extensions: {
        mapping: {
            schemas: {
                business: {
                    schema: 'business@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...contactMapping.objects,
                    },
                },
            },
        },
    },
};
