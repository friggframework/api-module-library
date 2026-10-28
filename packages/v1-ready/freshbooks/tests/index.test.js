const { Api, Definition, Config } = require('..');

describe('package entry point', () => {
    it('exports the Api, Definition and Config', () => {
        expect(Definition.API).toBe(Api);
        expect(Config.name).toBe('freshbooks');
        expect(Definition.getName()).toBe(Config.name);
    });
});
