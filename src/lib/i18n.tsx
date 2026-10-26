import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'fr' | 'mg';
const STORAGE_KEY = '4n-builder-language';

const dictionaries: Record<Language, Record<string, string>> = {
  mg: {
    'Dashboard': 'Dashboard', 'AI Builder': 'AI Builder', 'Code': 'Kaody', 'Preview': 'Topimaso', 'Files': 'Rakitra', 'My Projects': 'Ny tetikasako', 'Settings': 'Fikirana', 'Help Center': 'Foibe fanampiana', 'New Project': 'Tetikasa vaovao', 'WORKSPACE': 'TOERAM-PANAO', 'NAVIGATION': 'FITETEZANA', 'AI Engine': 'Motera AI', 'Ready': 'Vonona', 'Search': 'Fikarohana', 'Notifications': 'Fampandrenesana', 'Fiteny': 'Fiteny', 'Mamoròna projet vaovao': 'Mamoròna tetikasa vaovao',
  },
  en: {
    'Fiteny': 'Language', 'Dashboard': 'Dashboard', 'AI Builder': 'AI Builder',
    'Code': 'Code', 'Preview': 'Preview', 'Files': 'Files', 'My Projects': 'My Projects',
    'Settings': 'Settings', 'Help Center': 'Help Center', 'New Project': 'New Project',
    'WORKSPACE': 'WORKSPACE', 'NAVIGATION': 'NAVIGATION', 'AI Engine': 'AI Engine',
    'Ready': 'Ready', 'Search': 'Search', 'Notifications': 'Notifications',
    'Sokafy ny sidebar': 'Expand sidebar', 'Afeno ny sidebar': 'Collapse sidebar',
    'Sokafy ny menu': 'Open menu',
    'Midira na mamoròna kaonty hanombohana.': 'Sign in or create an account to get started.',
    'Tafiditra soa aman-tsara.': 'Signed in successfully.',
    'Tsy nahomby ny fidirana.': 'Sign-in failed.',
    'Tetikasa': 'Projects', 'Ny tetikasako': 'My projects',
    'Farito ny tetikasa…': 'Describe the project…',
    'Mamorona application': 'Generate application',
    'Mamorona ny rakitra amin’ny alalan’ny 4N DEV Core…': 'Generating files with 4N DEV Core…',
    'Vita ny génération.': 'Generation complete.',
    'Tsy nahomby ny génération; mety mbola voatahiry ilay tetikasa.': 'Generation failed; the project may still be saved.',
    'Ny AI Builder no mandrindra ny modely Core ao ambadika.': 'AI Builder manages Core model selection in the background.',
    'Farito ny tetikasanao.': 'Describe your project.',
    'Voatahiry isaky ny kaonty.': 'Saved per account.',
    'Core services': 'Core services',
    'Tsy mbola misy tetikasa.': 'No projects yet.',
    'Rakitra tetikasa': 'Project files',
    'Jereo ny kaody': 'View code',
    'Mbola tsy misy rakitra voatahiry ao amin’ity tetikasa ity.': 'No files saved in this project yet.',
    'Misafidiana tetikasa ao amin’ny Projects.': 'Select a project in Projects.',
    '4N DEV Core': '4N DEV Core',
    'Hivoaka': 'Sign out',
    'Kaonty:': 'Account:',
    'Mamoròna kaonty AI Builder': 'Create a Builder account',
    'Midira amin’ny kaontinao': 'Sign in to your account',
    'Mamorona kaonty': 'Create account',
    'Hiditra': 'Sign in',
    'Efa manana kaonty? Hiditra': 'Already have an account? Sign in',
    'Tsy mbola manana kaonty? Hisoratra anarana': 'No account yet? Register',
    'Mamorona application amin’ny AI': 'Generate app with AI',
    'ianao@example.com': 'you@example.com',
    'Farafahakeliny 12 tarehintsoratra': 'At least 12 characters',
    'Ohatra: Mamoròna boutique misy catalogue, panier ary espace admin…': 'Example: Build a shop with a catalogue, cart, and admin area…',
    'Farito ny zavatra tianao hatsangana…': 'Describe what you want to build…',
    'AI Builder — kaonty manokana, Core no mitantana ny modely sy ny billing.': 'AI Builder — personal account; Core manages models and billing.',
    'BUILD WITH AI': 'BUILD WITH AI',
    'Plan → Generate files → Save to project. Ny Core no mitantana ny modely sy billing.': 'Plan → Generate files → Save to project. Core manages models and billing.',
    'Mamorona amin’ny AI…': 'Generating with AI…',
  },
  fr: {
    'Fiteny': 'Langue', 'Dashboard': 'Tableau de bord', 'AI Builder': 'AI Builder',
    'Code': 'Code', 'Preview': 'Aperçu', 'Files': 'Fichiers', 'My Projects': 'Mes projets',
    'Settings': 'Paramètres', 'Help Center': 'Centre d’aide', 'New Project': 'Nouveau projet',
    'WORKSPACE': 'ESPACE DE TRAVAIL', 'NAVIGATION': 'NAVIGATION', 'AI Engine': 'Moteur IA',
    'Ready': 'Prêt', 'Search': 'Rechercher', 'Notifications': 'Notifications',
    'Sokafy ny sidebar': 'Ouvrir la barre latérale', 'Afeno ny sidebar': 'Masquer la barre latérale',
    'Sokafy ny menu': 'Ouvrir le menu',
    'Midira na mamoròna kaonty hanombohana.': 'Connectez-vous ou créez un compte pour commencer.',
    'Tafiditra soa aman-tsara.': 'Connexion réussie.',
    'Tsy nahomby ny fidirana.': 'Échec de la connexion.',
    'Tetikasa': 'Projets', 'Ny tetikasako': 'Mes projets',
    'Farito ny tetikasa…': 'Décrivez le projet…',
    'Mamorona application': 'Générer une application',
    'Mamorona ny rakitra amin’ny alalan’ny 4N DEV Core…': 'Génération des fichiers avec 4N DEV Core…',
    'Vita ny génération.': 'Génération terminée.',
    'Tsy nahomby ny génération; mety mbola voatahiry ilay tetikasa.': 'Échec de la génération ; le projet peut toutefois être enregistré.',
    'Ny AI Builder no mandrindra ny modely Core ao ambadika.': 'AI Builder gère la sélection des modèles Core en arrière-plan.',
    'Farito ny tetikasanao.': 'Décrivez votre projet.',
    'Voatahiry isaky ny kaonty.': 'Enregistrés par compte.',
    'Core services': 'Services Core',
    'Tsy mbola misy tetikasa.': 'Aucun projet pour le moment.',
    'Rakitra tetikasa': 'Fichiers du projet',
    'Jereo ny kaody': 'Voir le code',
    'Mbola tsy misy rakitra voatahiry ao amin’ity tetikasa ity.': 'Aucun fichier enregistré dans ce projet.',
    'Misafidiana tetikasa ao amin’ny Projects.': 'Sélectionnez un projet dans Projets.',
    '4N DEV Core': '4N DEV Core',
    'Hivoaka': 'Se déconnecter',
    'Kaonty:': 'Compte :',
    'Mamoròna kaonty AI Builder': 'Créer un compte Builder',
    'Midira amin’ny kaontinao': 'Connectez-vous à votre compte',
    'Mamorona kaonty': 'Créer un compte',
    'Hiditra': 'Se connecter',
    'Efa manana kaonty? Hiditra': 'Vous avez un compte ? Connectez-vous',
    'Tsy mbola manana kaonty? Hisoratra anarana': 'Pas encore de compte ? Inscrivez-vous',
    'Mamorona application amin’ny AI': 'Générer une application avec l’IA',
    'ianao@example.com': 'vous@exemple.com',
    'Farafahakeliny 12 tarehintsoratra': '12 caractères minimum',
    'Ohatra: Mamoròna boutique misy catalogue, panier ary espace admin…': 'Exemple : créer une boutique avec catalogue, panier et espace admin…',
    'Farito ny zavatra tianao hatsangana…': 'Décrivez ce que vous souhaitez créer…',
    'AI Builder — kaonty manokana, Core no mitantana ny modely sy ny billing.': 'AI Builder — compte personnel ; Core gère les modèles et la facturation.',
    'BUILD WITH AI': 'CRÉER AVEC L’IA',
    'Plan → Generate files → Save to project. Ny Core no mitantana ny modely sy billing.': 'Planifier → générer les fichiers → enregistrer le projet. Core gère les modèles et la facturation.',
    'Mamorona amin’ny AI…': 'Génération IA…',
  },
};

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (text: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'en' || saved === 'fr' || saved === 'mg' ? saved : 'mg';
    } catch { return 'mg'; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, language); } catch { /* Storage may be unavailable. */ }
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (text: string) => dictionaries[language][text] ?? text,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
