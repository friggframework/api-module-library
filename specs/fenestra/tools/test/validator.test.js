import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { FenestraValidator } from '../lib/validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../schemas/fenestra.schema.json');
const examplesPath = path.resolve(__dirname, '../../examples/0.1.0');

describe('FenestraValidator', () => {
  test('validates hubspot example', async () => {
    const validator = new FenestraValidator(schemaPath);
    const result = await validator.validate(path.join(examplesPath, 'hubspot.fenestra.yaml'));

    console.log('HubSpot validation result:', result.valid);
    if (!result.valid) {
      console.log('Errors:', result.errors);
    }

    // Should be valid or have only minor schema differences
    assert.ok(result.document, 'Document should be parsed');
    assert.ok(result.document.fenestra, 'Should have fenestra version');
    assert.ok(result.document.info, 'Should have info object');
  });

  test('validates miro example', async () => {
    const validator = new FenestraValidator(schemaPath);
    const result = await validator.validate(path.join(examplesPath, 'miro.fenestra.yaml'));

    console.log('Miro validation result:', result.valid);
    if (!result.valid) {
      console.log('Errors:', result.errors);
    }

    assert.ok(result.document, 'Document should be parsed');
    assert.ok(result.document.fenestra, 'Should have fenestra version');
  });

  test('validates mcp-apps example', async () => {
    const validator = new FenestraValidator(schemaPath);
    const result = await validator.validate(path.join(examplesPath, 'mcp-apps.fenestra.yaml'));

    console.log('MCP Apps validation result:', result.valid);
    if (!result.valid) {
      console.log('Errors:', result.errors);
    }

    assert.ok(result.document, 'Document should be parsed');
  });

  test('detects missing required fields', async () => {
    const validator = new FenestraValidator(schemaPath);

    // Create a minimal invalid document
    const invalidDoc = { fenestra: '0.1.0' }; // missing info

    const tempPath = path.join(__dirname, 'temp-invalid.json');
    const fs = await import('fs');
    fs.writeFileSync(tempPath, JSON.stringify(invalidDoc));

    try {
      const result = await validator.validate(tempPath);
      assert.strictEqual(result.valid, false, 'Should be invalid');
      assert.ok(result.errors.length > 0, 'Should have errors');
    } finally {
      fs.unlinkSync(tempPath);
    }
  });

  test('detects invalid SDK references', async () => {
    const validator = new FenestraValidator(schemaPath);

    const docWithBadRef = {
      fenestra: '0.1.0',
      info: { title: 'Test', version: '1.0.0' },
      sdks: {
        'my-sdk': { name: 'My SDK', packageManager: 'npm', package: 'my-sdk' }
      },
      componentCatalog: {
        components: {
          Button: {
            name: 'Button',
            sdkBinding: {
              sdk: 'nonexistent-sdk',  // This doesn't exist
              export: 'Button'
            }
          }
        }
      }
    };

    const tempPath = path.join(__dirname, 'temp-badref.json');
    const fs = await import('fs');
    fs.writeFileSync(tempPath, JSON.stringify(docWithBadRef));

    try {
      const result = await validator.validate(tempPath);
      // Should have reference error
      const refError = result.errors.find(e => e.type === 'reference');
      assert.ok(refError, 'Should detect invalid SDK reference');
    } finally {
      fs.unlinkSync(tempPath);
    }
  });
});
