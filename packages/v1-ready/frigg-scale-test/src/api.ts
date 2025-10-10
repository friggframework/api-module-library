export type ListParams = {
  accountId: string;
  limit?: number;
  cursor?: string;
  updatedSince?: string;
};

// Simple seeded pseudo-random number generator for deterministic results
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// Hash function to convert string to seed
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Barbara", "David", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
  "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
  "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young",
];

const COMPANIES = [
  "Acme Corp", "Global Industries", "Tech Solutions", "Innovation Labs", "Enterprise Systems",
  "Digital Ventures", "Cloud Services", "Data Analytics", "Software Group", "Consulting Partners",
  "Strategic Solutions", "Business Dynamics", "Market Leaders", "Growth Capital", "Venture Partners",
];

const CITIES = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio",
  "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville", "Fort Worth", "Columbus",
  "Charlotte", "San Francisco", "Indianapolis", "Seattle", "Denver", "Washington",
];

const REGIONS = [
  "NY", "CA", "IL", "TX", "AZ", "PA", "FL", "OH", "NC", "WA", "CO", "DC",
];

const COUNTRIES = ["USA", "United States", "US"];

export default class Api {
  private readonly maxContacts = 3000000;

  constructor(readonly opts: { baseUrl?: string; apiKey?: string } = {}) { }

  async health() {
    return { ok: true };
  }

  async listContacts(params: ListParams) {
    const { accountId, limit = 100, cursor, updatedSince } = params;

    // Parse cursor (offset) or start at 0
    const offset = cursor ? parseInt(cursor, 10) : 0;
    const actualLimit = Math.min(limit, 1000); // Cap at 1000 per page

    // Generate contacts deterministically
    const items = [];
    const endOffset = Math.min(offset + actualLimit, this.maxContacts);

    for (let i = offset; i < endOffset; i++) {
      const contact = this.generateContact(accountId, i);

      // Filter by updatedSince if provided
      if (updatedSince) {
        const updatedSinceDate = new Date(updatedSince);
        const contactUpdatedDate = new Date(contact.updatedAt);
        if (contactUpdatedDate < updatedSinceDate) {
          continue;
        }
      }

      items.push(contact);
    }

    // Determine if there are more records
    const hasMore = endOffset < this.maxContacts;
    const nextCursor = hasMore ? endOffset.toString() : null;

    return {
      items,
      nextCursor,
    };
  }

  private generateContact(accountId: string, index: number) {
    // Create deterministic seed from accountId and index
    const seed = hashString(`${accountId}-${index}`);
    const rng = new SeededRandom(seed);

    const firstName = FIRST_NAMES[rng.nextInt(0, FIRST_NAMES.length - 1)];
    const lastName = LAST_NAMES[rng.nextInt(0, LAST_NAMES.length - 1)];
    const company = COMPANIES[rng.nextInt(0, COMPANIES.length - 1)];
    const city = CITIES[rng.nextInt(0, CITIES.length - 1)];
    const region = REGIONS[rng.nextInt(0, REGIONS.length - 1)];
    const country = COUNTRIES[rng.nextInt(0, COUNTRIES.length - 1)];

    // Generate email and phone deterministically
    const emailDomain = ["example.com", "test.com", "demo.com", "sample.com"];
    const domain = emailDomain[rng.nextInt(0, emailDomain.length - 1)];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index}@${domain}`;

    const areaCode = 200 + rng.nextInt(0, 799);
    const phone = `+1-${areaCode}-${rng.nextInt(100, 999)}-${rng.nextInt(1000, 9999)}`;

    const postalCode = `${rng.nextInt(10000, 99999)}`;
    const address = `${rng.nextInt(1, 9999)} ${["Main", "Oak", "Maple", "Cedar", "Pine"][rng.nextInt(0, 4)]} St`;

    // Generate updatedAt timestamp (spread across last year)
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const timeDiff = now.getTime() - yearAgo.getTime();
    const randomTime = yearAgo.getTime() + (rng.next() * timeDiff);
    const updatedAt = new Date(randomTime).toISOString();

    return {
      id: `contact-${index}`,
      email,
      phone,
      firstName,
      lastName,
      company,
      address,
      city,
      region,
      country,
      postalCode,
      updatedAt,
      payload: {
        generatedIndex: index,
        accountId,
      },
    };
  }
}
