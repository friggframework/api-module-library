#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Our current implemented APIs with their specs status
const IMPLEMENTED_APIS = [
  // Analytics (6)
  {id:'amplitude',name:'Amplitude',cat:'Analytics',auth:'API Key'},
  {id:'fathom',name:'Fathom',cat:'Analytics',auth:'API Key'},
  {id:'google-analytics-4',name:'Google Analytics 4',cat:'Analytics',auth:'OAuth2'},
  {id:'mixpanel',name:'Mixpanel',cat:'Analytics',auth:'Service Account'},
  {id:'posthog',name:'PostHog',cat:'Analytics',auth:'API Key'},
  {id:'segment',name:'Segment',cat:'Analytics',auth:'Write Key'},
  
  // AI/ML (5)
  {id:'anthropic',name:'Anthropic',cat:'AI/ML',auth:'API Key'},
  {id:'cohere',name:'Cohere',cat:'AI/ML',auth:'API Key'},
  {id:'huggingface',name:'Hugging Face',cat:'AI/ML',auth:'API Token'},
  {id:'openai',name:'OpenAI',cat:'AI/ML',auth:'API Key'},
  {id:'replicate',name:'Replicate',cat:'AI/ML',auth:'API Token'},
  
  // Communication (12)
  {id:'discord',name:'Discord',cat:'Communication',auth:'OAuth2',openapi:true},
  {id:'intercom',name:'Intercom',cat:'Communication',auth:'OAuth2'},
  {id:'microsoft-teams',name:'Microsoft Teams',cat:'Communication',auth:'OAuth2',openapi:true,fenestra:true},
  {id:'onesignal',name:'OneSignal',cat:'Communication',auth:'API Key'},
  {id:'pusher',name:'Pusher',cat:'Communication',auth:'App Key/Secret'},
  {id:'sendgrid',name:'SendGrid',cat:'Communication',auth:'API Key'},
  {id:'slack',name:'Slack',cat:'Communication',auth:'OAuth2',openapi:true},
  {id:'telegram',name:'Telegram',cat:'Communication',auth:'Bot Token'},
  {id:'twilio',name:'Twilio',cat:'Communication',auth:'API Key/Secret',openapi:true},
  {id:'vonage',name:'Vonage',cat:'Communication',auth:'API Key/Secret'},
  {id:'whatsapp-business',name:'WhatsApp Business',cat:'Communication',auth:'Access Token'},
  {id:'zoom',name:'Zoom',cat:'Communication',auth:'OAuth2'},
  
  // CRM (11)
  {id:'activecampaign',name:'ActiveCampaign',cat:'CRM',auth:'API Key'},
  {id:'attentive',name:'Attentive',cat:'CRM',auth:'OAuth2'},
  {id:'attio',name:'Attio',cat:'CRM',auth:'OAuth2'},
  {id:'crossbeam',name:'Crossbeam',cat:'CRM',auth:'API Key'},
  {id:'hubspot',name:'HubSpot',cat:'CRM',auth:'OAuth2',openapi:true,fenestra:true},
  {id:'marketo',name:'Marketo',cat:'CRM',auth:'API Key'},
  {id:'outreach',name:'Outreach',cat:'CRM',auth:'OAuth2'},
  {id:'pipedrive',name:'Pipedrive',cat:'CRM',auth:'OAuth2',fenestra:true},
  {id:'salesforce',name:'Salesforce',cat:'CRM',auth:'OAuth2',fenestra:true},
  {id:'salesloft',name:'Salesloft',cat:'CRM',auth:'OAuth2'},
  {id:'zoho-crm',name:'Zoho CRM',cat:'CRM',auth:'OAuth2',fenestra:true},
  
  // Customer Support (3)
  {id:'freshdesk',name:'Freshdesk',cat:'Support',auth:'API Key'},
  {id:'helpscout',name:'Help Scout',cat:'Support',auth:'OAuth2'},
  {id:'zendesk',name:'Zendesk',cat:'Support',auth:'OAuth2/API Key'},
  
  // Design (2)
  {id:'canva',name:'Canva',cat:'Design',auth:'OAuth2',fenestra:true},
  {id:'figma',name:'Figma',cat:'Design',auth:'OAuth2',fenestra:true},
  
  // Developer (4)
  {id:'github',name:'GitHub',cat:'Developer',auth:'OAuth2',openapi:true,fenestra:true},
  {id:'gitlab',name:'GitLab',cat:'Developer',auth:'OAuth2',openapi:true},
  {id:'linear',name:'Linear',cat:'Developer',auth:'OAuth2'},
  {id:'rollworks',name:'Rollworks',cat:'Developer',auth:'API Key'},
  
  // E-commerce (11)
  {id:'42matters',name:'42matters',cat:'E-commerce',auth:'API Key'},
  {id:'bigcommerce',name:'BigCommerce',cat:'E-commerce',auth:'OAuth2'},
  {id:'clyde',name:'Clyde',cat:'E-commerce',auth:'Client Key/Secret'},
  {id:'etsy',name:'Etsy',cat:'E-commerce',auth:'OAuth2'},
  {id:'fastspring-iq',name:'FastSpring',cat:'E-commerce',auth:'OAuth2'},
  {id:'gorgias',name:'Gorgias',cat:'E-commerce',auth:'OAuth2',fenestra:true},
  {id:'payjunction',name:'PayJunction',cat:'E-commerce',auth:'API Key'},
  {id:'recharge',name:'Recharge',cat:'E-commerce',auth:'API Key'},
  {id:'shopify',name:'Shopify',cat:'E-commerce',auth:'OAuth2',openapi:true,fenestra:true},
  {id:'woocommerce',name:'WooCommerce',cat:'E-commerce',auth:'Consumer Key/Secret'},
  {id:'yotpo',name:'Yotpo',cat:'E-commerce',auth:'API Key'},
  
  // Email Marketing (1)
  {id:'mailchimp',name:'Mailchimp',cat:'Marketing',auth:'OAuth2'},
  
  // File Storage (4)
  {id:'box',name:'Box',cat:'Storage',auth:'OAuth2',openapi:true},
  {id:'dropbox',name:'Dropbox',cat:'Storage',auth:'OAuth2'},
  {id:'google-drive',name:'Google Drive',cat:'Storage',auth:'OAuth2'},
  {id:'sharepoint',name:'SharePoint',cat:'Storage',auth:'OAuth2'},
  
  // Finance (10)
  {id:'airwallex',name:'Airwallex',cat:'Finance',auth:'OAuth2'},
  {id:'coinbase',name:'Coinbase',cat:'Finance',auth:'OAuth2/API Key'},
  {id:'freshbooks',name:'FreshBooks',cat:'Finance',auth:'OAuth2'},
  {id:'paypal',name:'PayPal',cat:'Finance',auth:'OAuth2',openapi:true},
  {id:'plaid',name:'Plaid',cat:'Finance',auth:'Client ID/Secret'},
  {id:'qbo',name:'QuickBooks Online',cat:'Finance',auth:'OAuth2'},
  {id:'square',name:'Square',cat:'Finance',auth:'OAuth2',openapi:true},
  {id:'stripe',name:'Stripe',cat:'Finance',auth:'API Key',openapi:true},
  {id:'wise',name:'Wise',cat:'Finance',auth:'API Token'},
  {id:'xero',name:'Xero',cat:'Finance',auth:'OAuth2'},
  
  // HR (3)
  {id:'deel',name:'Deel',cat:'HR',auth:'OAuth2'},
  {id:'huggg',name:'Huggg',cat:'HR',auth:'Username/Password'},
  {id:'personio',name:'Personio',cat:'HR',auth:'API Key'},
  
  // Legal (2)
  {id:'docusign',name:'DocuSign',cat:'Legal',auth:'OAuth2'},
  {id:'ironclad',name:'Ironclad',cat:'Legal',auth:'OAuth2'},
  
  // Other (5)
  {id:'connectwise',name:'ConnectWise',cat:'Other',auth:'API Key'},
  {id:'netx',name:'Netx',cat:'Other',auth:'OAuth2'},
  {id:'revio',name:'Revio',cat:'Other',auth:'API Key'},
  {id:'terminus',name:'Terminus',cat:'Other',auth:'API Key'},
  {id:'unbabel-projects',name:'Unbabel Projects',cat:'Other',auth:'API Key'},
  
  // Phone (1)
  {id:'openphone',name:'OpenPhone',cat:'Phone',auth:'API Key'},
  
  // Productivity (13)
  {id:'airtable',name:'Airtable',cat:'Productivity',auth:'API Key',fenestra:true},
  {id:'asana',name:'Asana',cat:'Productivity',auth:'OAuth2',openapi:true,fenestra:true},
  {id:'calendly',name:'Calendly',cat:'Productivity',auth:'OAuth2'},
  {id:'clickup',name:'ClickUp',cat:'Productivity',auth:'OAuth2'},
  {id:'evernote',name:'Evernote',cat:'Productivity',auth:'OAuth 1.0a'},
  {id:'google-calendar',name:'Google Calendar',cat:'Productivity',auth:'OAuth2',openapi:true,fenestra:true},
  {id:'google-workspace',name:'Google Workspace',cat:'Productivity',auth:'OAuth2',fenestra:true},
  {id:'miro',name:'Miro',cat:'Productivity',auth:'OAuth2'},
  {id:'monday',name:'Monday.com',cat:'Productivity',auth:'OAuth2',fenestra:true},
  {id:'notion',name:'Notion',cat:'Productivity',auth:'OAuth2',openapi:true,fenestra:true},
  {id:'todoist',name:'Todoist',cat:'Productivity',auth:'API Token/OAuth2'},
  {id:'trello',name:'Trello',cat:'Productivity',auth:'OAuth2',openapi:true,fenestra:true},
  {id:'typeform',name:'Typeform',cat:'Productivity',auth:'OAuth2'},
  
  // Social (3)
  {id:'linkedin',name:'LinkedIn',cat:'Social',auth:'OAuth2'},
  {id:'reddit',name:'Reddit',cat:'Social',auth:'OAuth2'},
  {id:'youtube',name:'YouTube',cat:'Social',auth:'OAuth2'},
  
  // System Integration (3)
  {id:'frontify',name:'Frontify',cat:'System',auth:'OAuth2'},
  {id:'front',name:'Front',cat:'System',auth:'OAuth2',fenestra:true},
  {id:'jira',name:'Jira',cat:'System',auth:'OAuth2'},
  
  // Content (3)
  {id:'contentful',name:'Contentful',cat:'Content',auth:'API Key'},
  {id:'contentstack',name:'Contentstack',cat:'Content',auth:'API Key'},
  {id:'unbabel',name:'Unbabel',cat:'Content',auth:'API Key'},
];

// Create JSONL entries
const entries = IMPLEMENTED_APIS.map(api => ({
  id: api.id,
  name: api.name,
  implemented: true,
  openapi: api.openapi || false,
  fenestra: api.fenestra || false,
  frigg: false, // None have Frigg extensions yet
  auth: api.auth,
  cat: api.cat,
  subcat: api.subcat || '',
  notes: api.notes || '',
  updated: new Date().toISOString()
}));

// Write JSONL file
const jsonlPath = path.join(__dirname, '..', 'api-inventory.jsonl');
const jsonlContent = entries.map(e => JSON.stringify(e)).join('\n');
fs.writeFileSync(jsonlPath, jsonlContent);

console.log(`✅ Migrated ${entries.length} APIs to JSONL format`);

// Create index
const index = {
  version: '1.0.0',
  last_updated: new Date().toISOString(),
  stats: {
    total: entries.length,
    implemented: entries.filter(e => e.implemented).length,
    with_openapi: entries.filter(e => e.openapi).length,
    with_fenestra: entries.filter(e => e.fenestra).length,
    with_frigg: 0,
    by_category: {},
    by_auth: {}
  },
  quick_lookup: {}
};

// Build stats
entries.forEach((entry, idx) => {
  index.quick_lookup[entry.id] = idx;
  index.stats.by_category[entry.cat] = (index.stats.by_category[entry.cat] || 0) + 1;
  index.stats.by_auth[entry.auth] = (index.stats.by_auth[entry.auth] || 0) + 1;
});

// Write index
const indexPath = path.join(__dirname, '..', 'api-index.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

console.log('✅ Created index with stats:');
console.log(`   Total: ${index.stats.total}`);
console.log(`   With OpenAPI: ${index.stats.with_openapi}`);
console.log(`   With Fenestra: ${index.stats.with_fenestra}`);
console.log('\\n📊 By Category:');
Object.entries(index.stats.by_category)
  .sort(([,a], [,b]) => b - a)
  .forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));