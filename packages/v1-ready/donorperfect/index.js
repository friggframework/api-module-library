const { Api } = require('./api');
const { Definition } = require('./definition');
const contactMapping = require('./mappings/contact');
const companyMapping = require('./mappings/company');

module.exports = {
    Api,
    Definition,
    extensions: {
        mapping: {
            schemas: {
                business: {
                    schema: 'business@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...contactMapping.objects,
                        // companyMapping also keys `donor` — merge the
                        // conditional branches into one array.
                        donor: [
                            ...(contactMapping.objects.donor || []),
                            ...(companyMapping.objects.donor || []),
                        ],
                    },
                },
            },
        },
    },
};
