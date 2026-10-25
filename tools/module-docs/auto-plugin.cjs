'use strict';

const fs = require('node:fs');
const path = require('node:path');

// No remote writes here. A separate job verifies npm publication and dispatches
// with a short-lived App token. Successful shipit with no publication emits none.
module.exports = class ModuleDocsPlugin {
    name = 'frigg-module-docs';
    apply(auto) {
        const directory = path.resolve('.module-docs');
        auto.hooks.beforeShipIt.tapPromise(this.name, async () => {
            fs.rmSync(directory, {recursive: true, force: true});
            fs.mkdirSync(directory, {recursive: true});
            fs.writeFileSync(path.join(directory, 'published.json'), '[]\n');
        });
        auto.hooks.afterShipIt.tapPromise(this.name, async ({dryRun, context, newVersion}) => {
            if (dryRun || context === 'canary' || !newVersion) return;
            const candidates = path.join(directory, 'candidates');
            const records = fs.existsSync(candidates) ? fs.readdirSync(candidates).sort().map(x => JSON.parse(fs.readFileSync(path.join(candidates, x), 'utf8'))) : [];
            fs.writeFileSync(path.join(directory, 'published.json'), `${JSON.stringify(records, null, 2)}\n`);
        });
    }
};
