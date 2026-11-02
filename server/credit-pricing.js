const PRICING_VERSION = 'draft-1';

const TASK_RULES = Object.freeze([
  { type: 'mobile_app', base: 30, pattern: /\b(mobile|android|ios|expo|react native|application mobile|app mobile)\b/i },
  { type: 'refactor', base: 15, pattern: /\b(refactor|refactoring|refonte|restructur|architecture|clean up|cleanup)\b/i },
  { type: 'full_app', base: 24, pattern: /\b(create|build|develop|generate|make|design|créer|creer|développer|developper)\b.{0,80}\b(app|application|web app|website|site web|plateforme|dashboard)\b|\b(full|complete|entire|complet|complète)\b.{0,40}\b(app|application|website|plateforme)\b/i },
  { type: 'authentication', base: 12, pattern: /\b(auth|authentication|login|log in|sign in|signup|sign up|roles|permissions|connexion|inscription)\b/i },
  { type: 'database_api', base: 10, pattern: /\b(database|data model|schema|api|backend|postgres|postgresql|base de données|endpoint)\b/i },
  { type: 'form', base: 6, pattern: /\b(form|formulaire|validation|checkout form|contact form)\b/i },
  { type: 'new_page', base: 5, pattern: /\b(page|screen|écran|ecran|new page|nouvelle page)\b/i },
  { type: 'ui_component', base: 3, pattern: /\b(component|composant|navbar|navigation|modal|dialog|table|card|bouton|button)\b/i },
  { type: 'small_edit', base: 2, pattern: /\b(change|update|edit|fix|modify|changer|modifier|corriger|couleur|color|text|texte|spacing|margin|padding)\b/i }
]);

const COMPLEXITY_RULES = Object.freeze([
  { code: 'multiple_screens', credits: 4, pattern: /\b(multiple pages|several pages|multi-page|multi page|plusieurs pages|plusieurs écrans|plusieurs ecrans)\b/i },
  { code: 'external_integration', credits: 5, pattern: /\b(integration|integrate|stripe|payment gateway|webhook|third.party|third party|intégration|paiement)\b/i },
  { code: 'realtime_or_automation', credits: 5, pattern: /\b(real.time|realtime|live updates|automation|automatisation|notifications? en temps réel)\b/i },
  { code: 'advanced_security', credits: 5, pattern: /\b(multi.role|multi role|role.based|role based|permission matrix|audit log|security rules)\b/i }
]);

export function estimateBuilderCredits(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length > 12000) {
    throw new TypeError('A prompt between 1 and 12,000 characters is required.');
  }

  const normalized = prompt.trim();
  const task = TASK_RULES.find((rule) => rule.pattern.test(normalized)) || { type: 'general_feature', base: 8 };
  const complexityAddons = COMPLEXITY_RULES
    .filter((rule) => rule.pattern.test(normalized))
    .map(({ code, credits }) => ({ code, credits }));
  const addonCredits = complexityAddons.reduce((sum, item) => sum + item.credits, 0);
  const totalCredits = Math.min(40, task.base + addonCredits);

  return {
    pricingVersion: PRICING_VERSION,
    taskType: task.type,
    baseCredits: task.base,
    complexityAddons,
    totalCredits
  };
}
