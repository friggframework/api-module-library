const {mongoose} = require('@friggframework/database/mongoose');
const {Credential: Parent} = require('@friggframework/module-plugin');
const schema = new mongoose.Schema({
    access_token: {
        type: String,
        trim: true,
        lhEncrypt: true,
    },
    refresh_token: {
        type: String,
        trim: true,
        lhEncrypt: true,
    },
    expires_in: {type: Number},
});
const name = 'HelpscoutCredential';
const Credential = Parent.discriminators?.[name] || Parent.discriminator(name, schema);
module.exports = {Credential};
