'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {canonical, digest, validateBundle, validateSchema, REQUIRED_PAGES} = require('./contract.cjs');
const schema = require('./descriptor.schema.json');
const modules = require('./modules.json');

function build(packageDir, options = {}) {
    const root = options.root || execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: packageDir, encoding: 'utf8'}).trim();
    const read = filename => JSON.parse(fs.readFileSync(path.join(packageDir, filename), 'utf8'));
    const pkg = read('package.json');
    const allowed = modules.find(x => x.package === pkg.name);
    assert(allowed && path.resolve(root, allowed.packagePath) === path.resolve(packageDir), 'Package is not enrolled');
    const descriptor = read('module-docs.json');
    validateSchema(descriptor, schema);
    assert.equal(descriptor.id, allowed.id);
    const commit = options.commit || process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
    assert(/^[a-f0-9]{40}$/.test(commit), 'Expected source commit');
    // GITHUB_SHA survives auto/lerna's temporary prerelease-version commit/reset.
    // Record the exact resolved metadata in addition to this source input commit.
    // Reject uncommitted changes to code/docs; package version and changelog may be
    // changed by the release tool, but generated docs must match committed source.
    if (!options.skipSourceCheck) {
        const check = filename => {
            const source = execFileSync('git', ['show', `${commit}:${allowed.packagePath}/${filename}`], {cwd: root});
            assert(source.equals(fs.readFileSync(path.join(packageDir, filename))), `Source differs from ${commit}: ${filename}`);
        };
        const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, allowed.packagePath], {cwd: root, encoding: 'utf8'}).trim().split('\n');
        for (const filename of tracked.map(x => x.slice(allowed.packagePath.length + 1)).filter(x => !['package.json', 'CHANGELOG.md'].includes(x))) check(filename);
        const sourcePkg = JSON.parse(execFileSync('git', ['show', `${commit}:${allowed.packagePath}/package.json`], {cwd: root, encoding: 'utf8'}));
        // Lerna 8 annotates gitHead on disk before prepack. This is release
        // metadata, not a change to the module's declared runtime contract.
        const resolvedPkg = {...pkg}; delete resolvedPkg.gitHead; delete sourcePkg.gitHead;
        if (pkg.gitHead !== undefined) assert(/^[a-f0-9]{40}$/.test(pkg.gitHead), 'Invalid Lerna gitHead');
        assert.deepEqual({...sourcePkg, version: pkg.version}, resolvedPkg, 'Release changed package metadata beyond version/gitHead');
    }
    const metadata = {};
    for (const key of ['name', 'version', 'license', 'engines', 'dependencies', 'peerDependencies', 'gitHead']) if (pkg[key] !== undefined) metadata[key] = pkg[key];
    const source = {repository: 'friggframework/api-module-library', commit, packagePath: allowed.packagePath};
    const sourceUrl = `https://github.com/${source.repository}/tree/${commit}/${source.packagePath}`;
    const index = fs.readFileSync(path.join(packageDir, 'index.js'), 'utf8');
    const extensionBlock = index.match(/extensions:\s*\{([^}]*)\}/)?.[1] || '';
    const extensionNames = extensionBlock.split(',').map(x => x.trim()).filter(Boolean);
    assert(extensionNames.every(x => /^[a-zA-Z]\w*$/.test(x)), 'Pilot supports shorthand extension exports; extend the extractor before changing export syntax');
    assert.deepEqual([...descriptor.extensions].sort(), extensionNames.sort(), 'Descriptor extensions disagree with index.js');
    const replacements = {'{{PACKAGE}}': pkg.name, '{{VERSION}}': pkg.version, '{{FRIGG_RANGE}}': pkg.peerDependencies?.['@friggframework/core'] || pkg.dependencies?.['@friggframework/core'] || 'unknown', '{{NODE_RANGE}}': pkg.engines?.node || 'unknown'};
    const files = {};
    for (const filename of REQUIRED_PAGES.filter(x => x !== 'reference.md')) {
        let content = fs.readFileSync(path.join(packageDir, 'docs', filename), 'utf8');
        for (const [from, to] of Object.entries(replacements)) content = content.replaceAll(from, to);
        assert(!/\{\{[^}]+\}\}/.test(content), 'Unknown documentation template field');
        files[filename] = {encoding: 'utf8', content};
    }
    const api = fs.readFileSync(path.join(packageDir, 'api.js'), 'utf8');
    const publicMethods = [...api.matchAll(/^    (?:async )?([A-Za-z]\w*)\(([^)]*)\)\s*\{/gm)].filter(x => x[1] !== 'constructor');
    const reference = read('docs/reference.json');
    assert.deepEqual(Object.keys(reference).sort(), publicMethods.map(x => x[1]).sort(), 'Reference annotations must cover every public method');
    const sections = publicMethods.map(([, method, args]) => {
        const entry = reference[method];
        for (const field of ['description', 'parameters', 'returns']) assert(typeof entry[field] === 'string' && entry[field].length > 10, `Missing ${method}.${field}`);
        return `## ${method}\n\n\`${method}(${args.replace(/\s+/g, ' ').trim()})\`\n\n${entry.description}\n\nParameters: ${entry.parameters}\n\nReturns: ${entry.returns}\n`;
    });
    files['reference.md'] = {encoding: 'utf8', content: `# API reference\n\nGenerated from public methods in [the released source](${sourceUrl}/api.js) and reviewed annotations. Most responses are provider JSON passed through the Frigg Requester; exceptions are described per method. This module does not define typed response schemas. Inherited OAuth methods are documented by the installed Frigg runtime.\n\n${sections.join('\n')}\nSee [operating behavior](operations.md) for errors and pagination.\n`};
    const navigation = REQUIRED_PAGES.map(filename => ({path: filename, title: files[filename].content.match(/^# (.+)$/m)[1]}));
    const generatorSources = ['build.cjs', 'contract.cjs', 'descriptor.schema.json'].map(x => fs.readFileSync(path.join(__dirname, x), 'utf8'));
    const bundle = {
        schemaVersion: 1,
        manifest: {id: descriptor.id, package: pkg.name, version: pkg.version,
            channel: require('./contract.cjs').semver(pkg.version).pre.length ? 'prerelease' : 'stable',
            source, packageMetadata: metadata,
            generator: {name: 'frigg-module-docs', version: '1.0.0', digest: digest(generatorSources)}},
        catalog: {identity: {id: descriptor.id, package: pkg.name, version: pkg.version, kind: 'api-module'},
            name: descriptor.name, description: descriptor.description, provider: descriptor.provider, category: descriptor.category,
            license: pkg.license, maintainers: descriptor.maintainers, status: descriptor.status,
            capabilities: descriptor.capabilities, extensions: descriptor.extensions,
            compatibility: {node: pkg.engines?.node || null, frigg: replacements['{{FRIGG_RANGE}}'] === 'unknown' ? null : replacements['{{FRIGG_RANGE}}'], tested: descriptor.testedCompatibility},
            links: {...descriptor.links, source: sourceUrl, releaseNotes: `${sourceUrl}/CHANGELOG.md`}},
        files, navigation,
    };
    validateBundle(bundle, allowed);
    return bundle;
}

function writeCandidate(packageDir) {
    const bundle = build(packageDir);
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: packageDir, encoding: 'utf8'}).trim();
    fs.writeFileSync(path.join(packageDir, 'module-docs.bundle.json'), `${canonical(bundle)}\n`);
    const ledger = path.join(root, '.module-docs', 'candidates');
    fs.mkdirSync(ledger, {recursive: true});
    fs.writeFileSync(path.join(ledger, `${bundle.manifest.id}-${bundle.manifest.version}.json`), JSON.stringify({package: bundle.manifest.package, version: bundle.manifest.version, digest: digest(bundle)}));
    console.log(`Built ${bundle.manifest.package}@${bundle.manifest.version} documentation`);
}

module.exports = {build, writeCandidate};
if (require.main === module) writeCandidate(path.resolve(process.argv[2] || process.cwd()));
