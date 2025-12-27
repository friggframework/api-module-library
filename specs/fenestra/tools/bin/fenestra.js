#!/usr/bin/env node

import { Command } from 'commander';
import { validateCommand } from '../lib/commands/validate.js';

const program = new Command();

program
  .name('fenestra')
  .description('CLI tools for the Fenestra Specification')
  .version('0.1.0');

program
  .command('validate <file>')
  .description('Validate a Fenestra document against the specification schema')
  .option('-s, --schema <path>', 'Path to custom schema file')
  .option('-q, --quiet', 'Only output errors')
  .option('--json', 'Output results as JSON')
  .action(validateCommand);

program.parse();
