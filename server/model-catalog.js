export const CORE_API_URL_DEFAULT = 'https://api.4ndev.dev';

export const BUILDER_MODELS = Object.freeze([
  { id: '4n-chat-naya-5.6', name: '4N Chat Naya 5.6', family: 'Luna', capability: 'chat' },
  { id: '4n-chat-naya-6', name: '4N Chat Naya 6', family: 'Luna', capability: 'chat' },
  { id: '4n-code-nael-5.6', name: '4N Code Nael 5.6', family: 'Sol', capability: 'coding' },
  { id: '4n-code-nael-6.1', name: '4N Code Nael 6.1', family: 'Sol', capability: 'coding' }
]);

/**
 * Keep the Builder's public catalogue aligned with Core's canonical IDs.
 * Provider-internal model IDs are intentionally never returned to the browser.
 */
export function normalizeCoreModels(payload) {
  const models = payload?.data?.models ?? payload?.models;
  if (!Array.isArray(models)) {
    throw new Error('Core returned an unexpected model catalogue shape.');
  }

  const availableIds = new Set(
    models
      .filter((model) => model && model.active !== false && model.enabled !== false)
      .map((model) => model.id)
      .filter((id) => typeof id === 'string')
  );

  const missing = BUILDER_MODELS.filter((model) => !availableIds.has(model.id));
  if (missing.length) {
    const error = new Error('Core model catalogue is incomplete.');
    error.code = 'CORE_MODEL_CATALOG_INCOMPLETE';
    error.missingModelIds = missing.map((model) => model.id);
    throw error;
  }

  return BUILDER_MODELS.map((model) => ({ ...model, available: true }));
}
