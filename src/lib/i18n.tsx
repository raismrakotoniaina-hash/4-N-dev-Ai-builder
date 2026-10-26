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
