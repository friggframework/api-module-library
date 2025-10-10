import Api from "../src/api";

const api = new Api();

describe("Frigg Scale Test Mock CRM - Synthetic Data Generator", () => {
  it("health check returns ok", async () => {
    const health = await api.health();
    expect(health.ok).toBe(true);
  });

  it("listContacts generates contacts with pagination", async () => {
    const page = await api.listContacts({ accountId: "demo", limit: 10 });
    expect(Array.isArray(page.items)).toBe(true);
    expect(page.items.length).toBe(10);
    expect(page.nextCursor).toBeTruthy();
  });

  it("contacts have required fields", async () => {
    const page = await api.listContacts({ accountId: "demo", limit: 1 });
    const contact = page.items[0];

    expect(contact.id).toBeTruthy();
    expect(contact.email).toMatch(/@/);
    expect(contact.firstName).toBeTruthy();
    expect(contact.lastName).toBeTruthy();
    expect(contact.phone).toBeTruthy();
    expect(contact.company).toBeTruthy();
    expect(contact.address).toBeTruthy();
    expect(contact.city).toBeTruthy();
    expect(contact.region).toBeTruthy();
    expect(contact.country).toBeTruthy();
    expect(contact.postalCode).toBeTruthy();
    expect(contact.updatedAt).toBeTruthy();
  });

  it("generates deterministic results (same params = same data)", async () => {
    const page1 = await api.listContacts({ accountId: "demo", limit: 5 });
    const page2 = await api.listContacts({ accountId: "demo", limit: 5 });

    expect(page1.items).toEqual(page2.items);
  });

  it("generates different contacts for different accountIds", async () => {
    const page1 = await api.listContacts({ accountId: "account-1", limit: 5 });
    const page2 = await api.listContacts({ accountId: "account-2", limit: 5 });

    expect(page1.items[0].email).not.toEqual(page2.items[0].email);
  });

  it("pagination cursor works correctly", async () => {
    const page1 = await api.listContacts({ accountId: "demo", limit: 10 });
    const page2 = await api.listContacts({
      accountId: "demo",
      limit: 10,
      cursor: page1.nextCursor!
    });

    expect(page2.items.length).toBe(10);
    expect(page1.items[0].id).not.toEqual(page2.items[0].id);
    expect(page1.items[9].id).not.toEqual(page2.items[0].id);
  });

  it("generates unique contact IDs across pages", async () => {
    const page1 = await api.listContacts({ accountId: "demo", limit: 100 });
    const page2 = await api.listContacts({
      accountId: "demo",
      limit: 100,
      cursor: page1.nextCursor!
    });

    const ids1 = new Set(page1.items.map(c => c.id));
    const ids2 = new Set(page2.items.map(c => c.id));

    // Check no overlap
    const intersection = [...ids1].filter(id => ids2.has(id));
    expect(intersection.length).toBe(0);
  });

  it("respects limit parameter", async () => {
    const limits = [1, 10, 50, 100, 500];

    for (const limit of limits) {
      const page = await api.listContacts({ accountId: "demo", limit });
      expect(page.items.length).toBe(limit);
    }
  });

  it("supports up to 3 million contacts", async () => {
    // Jump to near the end
    const offset = 2999990;
    const page = await api.listContacts({
      accountId: "demo",
      limit: 20,
      cursor: offset.toString()
    });

    expect(page.items.length).toBe(10); // Only 10 left (2999990 to 2999999)
    expect(page.nextCursor).toBeNull(); // No more pages
    expect(page.items[page.items.length - 1].id).toBe("contact-2999999");
  });

  it("generates unique emails across multiple contacts", async () => {
    const page = await api.listContacts({ accountId: "demo", limit: 1000 });
    const emails = new Set(page.items.map(c => c.email));

    expect(emails.size).toBe(1000); // All emails should be unique
  });

  it("updatedSince filter works correctly", async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const page = await api.listContacts({
      accountId: "demo",
      limit: 100,
      updatedSince: futureDate
    });

    // All contacts should be filtered out since they're in the past
    expect(page.items.length).toBe(0);
  });
});
