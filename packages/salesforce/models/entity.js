const {Entity: Parent, mongoose} = require('@friggframework/core');

const schema = new mongoose.Schema({
    isSandbox: Boolean,
    connectedUsername: String,
});

const name = 'SalesforceEntity';
const Entity =
    Parent.discriminators?.[name] || Parent.discriminator(name, schema);
module.exports = {Entity};

module.exports = {Entity};
