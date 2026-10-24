/**
 * Config fields (ADR-054 §4): what an integration puts in its `config` to let the end user choose HubSpot values.
 * Each is a JSON Schema fragment plus a loader that core runs with the installation's own HubSpot credential:
 *
 *     config: { stages: hubspot.fields.dealStages({ title: 'Alert when a deal enters', multiple: true, default: ['closedwon'] }) }
 */
const field = (schema, { multiple, title, required, default: dflt, help }, options) => ({
    module: 'hubspot',
    required: Boolean(required),
    schema: multiple
        ? { type: 'array', title, items: { type: 'string' }, ...(dflt !== undefined ? { default: dflt } : {}) }
        : { ...schema, title, ...(dflt !== undefined ? { default: dflt } : {}) },
    ...(help ? { ui: { 'ui:help': help } } : {}),
    options,
});

const pipelinesOf = async (api, objectType) => (await api.getPipelineDetails(objectType))?.results || [];

module.exports = {
    /** Deal stages across every deal pipeline, titled "Pipeline: Stage". */
    dealStages: (opts = {}) => field({ type: 'string' }, { title: 'Deal stage', ...opts }, async (api) =>
        (await pipelinesOf(api, 'deals')).flatMap((p) => (p.stages || []).map((s) => ({ const: s.id, title: `${p.label}: ${s.label}` })))),
    /** Deal pipelines. */
    dealPipelines: (opts = {}) => field({ type: 'string' }, { title: 'Pipeline', ...opts }, async (api) =>
        (await pipelinesOf(api, 'deals')).map((p) => ({ const: p.id, title: p.label }))),
};
