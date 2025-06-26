const nforce = require('nforce');
const {opportunityPushTopicName} = require('../../constants/StringConstants');
// All the authenication is part of the configuration for a Connected App in Salesforce

// consumerKey and consumer secret should be provided via environment variables
const org = nforce.createConnection({
    clientId: process.env.SALESFORCE_CLIENT_ID || 'YOUR_CLIENT_ID',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    redirectUri: 'http://localhost:3000/oauth/callback',
    // Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
    // Licensed under the Amazon Software License
    // http://aws.amazon.com/asl/
    // environment:'sandbox',
    apiVersion: 'v44.0',
    mode: 'multi', // was single
});
// const TOPIC = '/event/Raz_Test_Event__e';// 'OppCRUD__e';
// const REPLAY_ID = -1;
// const USERNAME = 'ryan@coderden.com.salesrightappdev';
// const PASSWORD = '5688razy';
// SNS TOPIC
// const TOPIC_ARN = 'Opportunity';
// exports.handler = function(event, context, callback) {/**/
// authenticate via oauth process to SFDC
const oauth = {
    access_token: process.env.SALESFORCE_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN',
    instance_url: process.env.SALESFORCE_INSTANCE_URL || 'https://your-instance.salesforce.com',
};
const client = org.createStreamClient({oauth});
const accs = client.subscribe({
    topic: opportunityPushTopicName,
    replayId: -1,
    retry: -1,
    oauth,
});
console.log(
    `Subscription to ${opportunityPushTopicName} supposedly successful for thing`
);
accs.on('error', (err) => {
    console.log(`Error occurred, ${err}`);
    client.disconnect();
});

accs.on('data', (data) => {
    console.log(
        `PushTopic, ${opportunityPushTopicName} detected\nEvent:${JSON.stringify(
            data
        )}`
    );
});
const exiting = () => {
    console.log('Exiting');
};
setTimeout(exiting, 90000);
