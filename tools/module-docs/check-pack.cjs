'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {readPackage} = require('./registry.cjs');
const {digest, validateBundle} = require('./contract.cjs');

for (const allowed of require('./modules.json')) {
    const directory = path.resolve(allowed.packagePath);
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json')));
    const filename = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    const bytes = fs.readFileSync(path.join(process.argv[2] || require('node:os').tmpdir(), filename));
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    const packed = readPackage(bytes, integrity);
    validateBundle(packed.bundle, allowed);
    assert.equal(packed.pkg.version, pkg.version);
    const candidate = JSON.parse(fs.readFileSync(path.join(directory, 'module-docs.bundle.json')));
    assert.equal(digest(packed.bundle), digest(candidate), 'Packed bundle differs from prepack candidate');
    console.log(`Verified ${filename}: release bundle included, validated and identical to candidate.`);
}
