import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import YAML from 'yaml';

export class FenestraValidator {
  constructor(schemaPath) {
    this.schemaPath = schemaPath;
    this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    // Initialize AJV with JSON Schema Draft 2020-12 support
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });

    // Add format validators (uri, email, etc.)
    addFormats(this.ajv);

    // Compile schema
    this.validate_schema = this.ajv.compile(this.schema);
  }

  async validate(filePath) {
    const result = {
      valid: false,
      errors: [],
      warnings: [],
      info: [],
      document: null
    };

    try {
      // Read and parse file
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      let document;
      try {
        if (ext === '.json') {
          document = JSON.parse(content);
        } else if (ext === '.yaml' || ext === '.yml') {
          document = YAML.parse(content);
        } else {
          // Try YAML first (more permissive), then JSON
          try {
            document = YAML.parse(content);
          } catch {
            document = JSON.parse(content);
          }
        }
      } catch (parseError) {
        result.errors.push({
          type: 'parse',
          message: `Failed to parse file: ${parseError.message}`
        });
        return result;
      }

      result.document = document;

      // Schema validation
      const schemaValid = this.validate_schema(document);

      if (!schemaValid) {
        for (const error of this.validate_schema.errors || []) {
          result.errors.push({
            type: 'schema',
            message: error.message || 'Schema validation failed',
            path: error.instancePath || '/',
            keyword: error.keyword,
            params: error.params
          });
        }
      }

      // Additional semantic validations
      this.validateSemantics(document, result);

      // Collect info
      this.collectInfo(document, result);

      // Determine overall validity
      result.valid = result.errors.length === 0;

      return result;

    } catch (error) {
      result.errors.push({
        type: 'internal',
        message: `Validation error: ${error.message}`
      });
      return result;
    }
  }

  validateSemantics(document, result) {
    // Check fenestra version
    if (document.fenestra) {
      const version = document.fenestra;
      if (!version.match(/^0\.1\./)) {
        result.warnings.push({
          type: 'version',
          message: `Fenestra version ${version} may not be fully supported`,
          suggestion: 'Use version 0.1.x for compatibility'
        });
      }
    }

    // Check SDK references in components
    if (document.componentCatalog?.components && document.sdks) {
      const sdkIds = new Set(Object.keys(document.sdks));

      for (const [componentId, component] of Object.entries(document.componentCatalog.components)) {
        if (component.sdkBinding?.sdk) {
          if (!sdkIds.has(component.sdkBinding.sdk)) {
            result.errors.push({
              type: 'reference',
              message: `Component '${componentId}' references undefined SDK '${component.sdkBinding.sdk}'`,
              path: `/componentCatalog/components/${componentId}/sdkBinding/sdk`
            });
          }
        }
      }
    }

    // Check extension point SDK references
    if (document.extensionPoints && document.sdks) {
      const sdkIds = new Set(Object.keys(document.sdks));

      for (let i = 0; i < document.extensionPoints.length; i++) {
        const ep = document.extensionPoints[i];
        const config = ep.extensionTypeConfig;

        if (config?.sdk && typeof config.sdk === 'string') {
          if (!sdkIds.has(config.sdk)) {
            result.warnings.push({
              type: 'reference',
              message: `Extension point '${ep.id}' references SDK '${config.sdk}' not defined in sdks`,
              path: `/extensionPoints/${i}/extensionTypeConfig/sdk`
            });
          }
        }
      }
    }

    // Warn about missing recommended fields
    if (!document.platform) {
      result.warnings.push({
        type: 'completeness',
        message: 'No platform object defined',
        suggestion: 'Add platform info for better documentation'
      });
    }

    if (!document.sdks || Object.keys(document.sdks).length === 0) {
      result.warnings.push({
        type: 'completeness',
        message: 'No SDKs defined',
        suggestion: 'Add SDK definitions for component bindings'
      });
    }

    if (!document.extensionPoints || document.extensionPoints.length === 0) {
      result.warnings.push({
        type: 'completeness',
        message: 'No extension points defined',
        suggestion: 'Add extension points to describe where UI can be injected'
      });
    }

    // Check for extension type consistency
    if (document.extensionPoints) {
      const validTypes = ['jsonResponse', 'codedComponents', 'iframe', 'embeddedSdk', 'agentUI'];
      for (const ep of document.extensionPoints) {
        if (ep.extensionType && !validTypes.includes(ep.extensionType)) {
          result.warnings.push({
            type: 'enum',
            message: `Extension point '${ep.id}' has unknown extensionType '${ep.extensionType}'`,
            suggestion: `Valid types: ${validTypes.join(', ')}`
          });
        }
      }
    }
  }

  collectInfo(document, result) {
    // Component count
    if (document.componentCatalog?.components) {
      const count = Object.keys(document.componentCatalog.components).length;
      result.info.push({
        type: 'stats',
        message: `${count} component(s) defined`
      });
    }

    // Extension points
    if (document.extensionPoints) {
      const types = {};
      for (const ep of document.extensionPoints) {
        types[ep.extensionType] = (types[ep.extensionType] || 0) + 1;
      }
      const summary = Object.entries(types)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      result.info.push({
        type: 'stats',
        message: `${document.extensionPoints.length} extension point(s)`,
        details: summary
      });
    }

    // SDKs
    if (document.sdks) {
      const count = Object.keys(document.sdks).length;
      result.info.push({
        type: 'stats',
        message: `${count} SDK(s) defined`
      });
    }

    // Policies
    if (document.policies) {
      const policies = [];
      if (document.policies.componentRequirement?.level) {
        policies.push(`components: ${document.policies.componentRequirement.level}`);
      }
      if (document.policies.customComponents?.allowed !== undefined) {
        policies.push(`custom: ${document.policies.customComponents.allowed ? 'allowed' : 'not allowed'}`);
      }
      if (policies.length > 0) {
        result.info.push({
          type: 'policies',
          message: `Policies: ${policies.join(', ')}`
        });
      }
    }
  }
}

export default FenestraValidator;
