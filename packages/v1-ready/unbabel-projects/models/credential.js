const {Credential: Parent, mongoose} = require('@friggframework/core');
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
    expires_at: {type: Number},
});
const name = 'UnbabelProjectsCredential';
const Credential = Parent.discriminators?.[name] || Parent.discriminator(name, schema);
module.exports = {Credential};
