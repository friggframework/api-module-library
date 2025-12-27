import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { FenestraValidator } from '../validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function validateCommand(file, options) {
  const results = {
    file: path.resolve(file),
    valid: false,
    errors: [],
    warnings: [],
    info: []
  };

  try {
    // Check file exists
    if (!fs.existsSync(file)) {
      results.errors.push({
        type: 'file',
        message: `File not found: ${file}`
      });
      outputResults(results, options);
      process.exit(1);
    }

    // Determine schema path
    let schemaPath = options.schema;
    if (!schemaPath) {
      // Default to bundled schema
      schemaPath = path.resolve(__dirname, '../../schemas/fenestra.schema.json');

      // Fallback to repo schema if bundled not found
      if (!fs.existsSync(schemaPath)) {
        schemaPath = path.resolve(__dirname, '../../../schemas/v0.1/fenestra.schema.json');
      }
    }

    if (!fs.existsSync(schemaPath)) {
      results.errors.push({
        type: 'schema',
        message: `Schema file not found: ${schemaPath}`
      });
      outputResults(results, options);
      process.exit(1);
    }

    // Create validator and validate
    const validator = new FenestraValidator(schemaPath);
    const validationResult = await validator.validate(file);

    results.valid = validationResult.valid;
    results.errors = validationResult.errors || [];
    results.warnings = validationResult.warnings || [];
    results.info = validationResult.info || [];
    results.document = validationResult.document;

    outputResults(results, options);
    process.exit(results.valid ? 0 : 1);

  } catch (error) {
    results.errors.push({
      type: 'internal',
      message: error.message
    });
    outputResults(results, options);
    process.exit(1);
  }
}

function outputResults(results, options) {
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const { valid, errors, warnings, info, file, document } = results;

  if (!options.quiet) {
    console.log();
    console.log(chalk.bold(`Validating: ${file}`));
    console.log();
  }

  // Show document info
  if (document && !options.quiet) {
    console.log(chalk.cyan('Document Info:'));
    console.log(`  Title: ${document.info?.title || 'N/A'}`);
    console.log(`  Version: ${document.info?.version || 'N/A'}`);
    console.log(`  Fenestra: ${document.fenestra || 'N/A'}`);
    if (document.platform?.name) {
      console.log(`  Platform: ${document.platform.name}`);
    }
    console.log();
  }

  // Show info messages
  if (info.length > 0 && !options.quiet) {
    for (const item of info) {
      console.log(chalk.blue(`ℹ ${item.message}`));
      if (item.details) {
        console.log(chalk.gray(`  ${item.details}`));
      }
    }
    console.log();
  }

  // Show warnings
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.log(chalk.yellow(`⚠ Warning: ${warning.message}`));
      if (warning.path) {
        console.log(chalk.gray(`  Path: ${warning.path}`));
      }
      if (warning.suggestion) {
        console.log(chalk.gray(`  Suggestion: ${warning.suggestion}`));
      }
    }
    console.log();
  }

  // Show errors
  if (errors.length > 0) {
    for (const error of errors) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
      if (error.path) {
        console.log(chalk.gray(`  Path: ${error.path}`));
      }
      if (error.keyword) {
        console.log(chalk.gray(`  Rule: ${error.keyword}`));
      }
      if (error.params) {
        console.log(chalk.gray(`  Details: ${JSON.stringify(error.params)}`));
      }
    }
    console.log();
  }

  // Summary
  if (valid) {
    console.log(chalk.green.bold('✓ Valid Fenestra document'));
    if (!options.quiet) {
      const stats = [];
      if (results.document?.componentCatalog?.components) {
        const count = Object.keys(results.document.componentCatalog.components).length;
        stats.push(`${count} components`);
      }
      if (results.document?.extensionPoints) {
        stats.push(`${results.document.extensionPoints.length} extension points`);
      }
      if (results.document?.sdks) {
        stats.push(`${Object.keys(results.document.sdks).length} SDKs`);
      }
      if (stats.length > 0) {
        console.log(chalk.gray(`  Contains: ${stats.join(', ')}`));
      }
    }
  } else {
    console.log(chalk.red.bold(`✗ Invalid: ${errors.length} error(s) found`));
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow(`  ${warnings.length} warning(s)`));
  }

  console.log();
}
