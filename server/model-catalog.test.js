import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDER_MODELS, normalizeCoreModels } from './model-catalog.js';

const corePayload = {
  success: true,
  data: {
    models: [
      { id: '4n-chat-naya-5.6', status: 'active' },
      { id: '4n-chat-naya-6', status: 'active' },
      { id: '4n-code-nael-5.6', status: 'active' },
      { id: '4n-code-nael-6.1', status: 'active' },
      { id: 'legacy-model', status: 'active' },
      { id: 'astra-model', status: 'active' }
    ]
  }
};

test('exposes exactly the four canonical Naya and Nael models', () => {
  const models = normalizeCoreModels(corePayload);
  assert.deepEqual(models.map((model) => model.id), BUILDER_MODELS.map((model) => model.id));
  assert.equal(models.length, 4);
  assert.ok(models.every((model) => model.available));
});

test('does not expose a model that Core marks inactive', () => {
  const payload = structuredClone(corePayload);
  payload.data.models[0].status = 'inactive';
  assert.throws(() => normalizeCoreModels(payload), {
    code: 'CORE_MODEL_CATALOG_INCOMPLETE'
  });
});

test('rejects an unexpected Core response shape', () => {
  assert.throws(() => normalizeCoreModels({ success: true, data: {} }), /unexpected model catalogue shape/i);
});
