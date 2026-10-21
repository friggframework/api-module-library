const { Api } = require('./api');
const { Definition } = require('./definition');
const { companyMapping } = require('./mappings/company');
const { contactMapping } = require('./mappings/contact');
const { invoiceMapping } = require('./mappings/invoice');
const { paymentMapping } = require('./mappings/payment');

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
                        ...companyMapping.objects,
                        ...contactMapping.objects,
                    },
                },
                billing: {
                    schema: 'billing@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...invoiceMapping.objects,
                        ...paymentMapping.objects,
                    },
                },
            },
            transforms: {},
        },
    },
};
