#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const path = require('path');

class APIInventoryManager {
  constructor(baseDir = '.') {
    this.inventoryPath = path.join(baseDir, 'api-inventory.jsonl');
    this.indexPath = path.join(baseDir, 'api-index.json');
    this.cache = new Map();
    this.index = null;
  }

  async init() {
    // Load index
    if (fs.existsSync(this.indexPath)) {
      this.index = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
    } else {
      this.index = this.createEmptyIndex();
    }
  }

  createEmptyIndex() {
    return {
      version: "1.0.0",
      last_updated: new Date().toISOString(),
      stats: {
        total: 0,
        implemented: 0,
        with_openapi: 0,
        with_fenestra: 0,
        with_frigg: 0,
        by_category: {},
        by_auth: {}
      },
      quick_lookup: {}
    };
  }

  // Add or update an API
  async upsertAPI(api) {
    const apis = await this.loadAll();
    apis.set(api.id, api);
    await this.saveAll(apis);
    await this.rebuildIndex();
    return api;
  }

  // Batch insert for efficiency
  async batchUpsert(apis) {
    const existing = await this.loadAll();
    for (const api of apis) {
      existing.set(api.id, api);
    }
    await this.saveAll(existing);
    await this.rebuildIndex();
  }

  // Find APIs by criteria
  async find(criteria) {
    const apis = await this.loadAll();
    const results = [];
    
    for (const [id, api] of apis) {
      let match = true;
      for (const [key, value] of Object.entries(criteria)) {
        if (api[key] !== value) {
          match = false;
          break;
        }
      }
      if (match) results.push(api);
    }
    
    return results;
  }

  // Quick lookup by ID using index
  async getById(id) {
    if (this.index.quick_lookup[id] !== undefined) {
      // Use line number from index for O(1) lookup
      return await this.getByLineNumber(this.index.quick_lookup[id]);
    }
    return null;
  }

  // Get API by line number (fast for large files)
  async getByLineNumber(lineNum) {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(this.inventoryPath);
      const rl = readline.createInterface({ input: stream });
      let currentLine = 0;
      
      rl.on('line', (line) => {
        if (currentLine === lineNum) {
          rl.close();
          stream.close();
          resolve(JSON.parse(line));
        }
        currentLine++;
      });
      
      rl.on('close', () => resolve(null));
      rl.on('error', reject);
    });
  }

  // Load all APIs (with caching)
  async loadAll() {
    if (this.cache.size > 0) return this.cache;
    
    const apis = new Map();
    if (!fs.existsSync(this.inventoryPath)) return apis;
    
    const stream = fs.createReadStream(this.inventoryPath);
    const rl = readline.createInterface({ input: stream });
    
    return new Promise((resolve, reject) => {
      rl.on('line', (line) => {
        try {
          const api = JSON.parse(line);
          apis.set(api.id, api);
        } catch (e) {
          console.error('Invalid JSON line:', line);
        }
      });
      
      rl.on('close', () => {
        this.cache = apis;
        resolve(apis);
      });
      
      rl.on('error', reject);
    });
  }

  // Save all APIs
  async saveAll(apis) {
    const lines = [];
    for (const [id, api] of apis) {
      lines.push(JSON.stringify(api));
    }
    fs.writeFileSync(this.inventoryPath, lines.join('\n'));
    this.cache = apis; // Update cache
  }

  // Rebuild index for fast lookups
  async rebuildIndex() {
    const apis = await this.loadAll();
    const index = this.createEmptyIndex();
    
    let lineNum = 0;
    for (const [id, api] of apis) {
      // Quick lookup by ID
      index.quick_lookup[id] = lineNum++;
      
      // Update stats
      index.stats.total++;
      if (api.implemented) index.stats.implemented++;
      if (api.openapi) index.stats.with_openapi++;
      if (api.fenestra) index.stats.with_fenestra++;
      if (api.frigg) index.stats.with_frigg++;
      
      // Category stats
      index.stats.by_category[api.cat] = (index.stats.by_category[api.cat] || 0) + 1;
      index.stats.by_auth[api.auth] = (index.stats.by_auth[api.auth] || 0) + 1;
    }
    
    index.last_updated = new Date().toISOString();
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
    this.index = index;
  }

  // Import from Lefthook
  async importFromLefthook(url = 'https://admin.lefthook.com/api/apis') {
    const fetch = require('node-fetch');
    const response = await fetch(url);
    const data = await response.json();
    
    const apis = await this.loadAll();
    let added = 0;
    
    for (const item of data.items) {
      const id = item.slug;
      if (!apis.has(id)) {
        apis.set(id, {
          id: id,
          name: item.name,
          implemented: item.status === 'Built',
          openapi: false,
          fenestra: false,
          frigg: false,
          auth: 'Unknown',
          cat: this.normalizeCategory(item.category),
          subcat: item.category,
          notes: `Lefthook: ${item.status}`,
          lefthook: item.status,
          updated: new Date().toISOString()
        });
        added++;
      }
    }
    
    await this.saveAll(apis);
    await this.rebuildIndex();
    return { added, total: data.items.length };
  }

  normalizeCategory(category) {
    const mapping = {
      'CRM (Customer Relationship Management)': 'CRM',
      'HR Talent & Recruitment': 'HR',
      'Project Management': 'Productivity',
      'Marketing Automation': 'Marketing',
      'Email Newsletters': 'Communication',
      'Phone and SMS': 'Communication',
      'Video Conferencing': 'Communication',
      'File Management and Storage': 'Productivity',
      'Forms and Surveys': 'Productivity',
      'eCommerce': 'E-commerce',
      'Developer Tools': 'Developer',
      'Social Media Accounts': 'Social',
      'Social Media Marketing': 'Marketing',
      'Website Builders': 'Developer',
      'Task Management': 'Productivity',
      'Team Chat': 'Communication',
      'Team Collaboration': 'Productivity',
      'Customer Support': 'CRM',
      'Event Management': 'Marketing',
      'Online Courses': 'Education',
      'Scheduling and Booking': 'Productivity',
      'Security and Identity Tools': 'Security',
      'Databases': 'Developer',
      'Documents': 'Productivity',
      'Signatures': 'Productivity',
      'Proposal and Invoice Management': 'Finance',
      'Accounting': 'Finance',
      'Amazon': 'Developer',
      'Google': 'Productivity'
    };
    
    return mapping[category] || category;
  }

  // Generate reports
  async generateReport() {
    const stats = this.index.stats;
    console.log('\n=== API Inventory Report ===');
    console.log(`Total APIs: ${stats.total}`);
    console.log(`Implemented: ${stats.implemented} (${(stats.implemented/stats.total*100).toFixed(1)}%)`);
    console.log(`With OpenAPI: ${stats.with_openapi} (${(stats.with_openapi/stats.implemented*100).toFixed(1)}%)`);
    console.log(`With Fenestra: ${stats.with_fenestra} (${(stats.with_fenestra/stats.implemented*100).toFixed(1)}%)`);
    console.log('\nBy Category:');
    Object.entries(stats.by_category)
      .sort(([,a], [,b]) => b - a)
      .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
    console.log('\nBy Auth Type:');
    Object.entries(stats.by_auth)
      .sort(([,a], [,b]) => b - a)
      .forEach(([auth, count]) => console.log(`  ${auth}: ${count}`));
  }
}

// CLI Interface
if (require.main === module) {
  const manager = new APIInventoryManager();
  const command = process.argv[2];
  
  (async () => {
    await manager.init();
    
    switch (command) {
      case 'import':
        console.log('Importing from Lefthook...');
        const result = await manager.importFromLefthook();
        console.log(`Added ${result.added} new APIs from ${result.total} total`);
        break;
        
      case 'report':
        await manager.generateReport();
        break;
        
      case 'rebuild':
        console.log('Rebuilding index...');
        await manager.rebuildIndex();
        console.log('Index rebuilt successfully');
        break;
        
      case 'find':
        const criteria = JSON.parse(process.argv[3] || '{}');
        const results = await manager.find(criteria);
        console.log(`Found ${results.length} APIs:`);
        results.forEach(api => console.log(`  ${api.id}: ${api.name}`));
        break;
        
      default:
        console.log('Usage: api-inventory-manager.js [import|report|rebuild|find]');
    }
  })();
}

module.exports = APIInventoryManager;