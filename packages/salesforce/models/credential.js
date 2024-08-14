const {Credential: Parent, mongoose} = require('@friggframework/core');

const schema = new mongoose.Schema({
    accessToken: {
        type: String,
        required: true,
        lhEncrypt: true,
    },
    refreshToken: {
        type: String,
        required: true,
        lhEncrypt: true,
    },
    instanceUrl: {type: String, required: true},
});

const name = 'SalesforceCredential';
const Credential =
    Parent.discriminators?.[name] || Parent.discriminator(name, schema);
module.exports = {Credential};
