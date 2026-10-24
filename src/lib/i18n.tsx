import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'fr' | 'mg';

const STORAGE_KEY = '4n-builder-language';

const dictionaries: Record<Language, Record<string, string>> = {
  mg: {},
  en: {
    'Fiteny': 'Language',
    'Dashboard': 'Dashboard',
    'AI Builder': 'AI Builder',
    'Code': 'Code',
    'Preview': 'Preview',
    'Files': 'Files',
    'My Projects': 'My Projects',
    'Settings': 'Settings',
    'Help Center': 'Help Center',
    'New Project': 'New Project',
    'Overview an’ny workspace': 'Workspace overview',
    'Mamorona app amin’ny prompt': 'Create an app from a prompt',
    'Jereo sy ovay ny code': 'View and edit code',
    'Live preview an’ilay app': 'Live app preview',
    'Project file explorer': 'Project file explorer',
    'Projects voatahiry': 'Saved projects',
    'Midira na mamoròna kaonty hanombohana.': 'Sign in or create an account to get started.',
    'Tafiditra soa aman-tsara.': 'Signed in successfully.',
    'Hivoaka': 'Sign out',
    'Tetikasa': 'Projects',
    'Ny tetikasako': 'My projects',
    'Rakitra tetikasa': 'Project files',
    'Fampifandraisana 4N DEV Core': '4N DEV Core connection',
    'Ampifandraiso ny Core': 'Connect Core',
    'Jereo ny balance Core': 'View Core balance',
    'Esory ny fifandraisana': 'Disconnect',
    'Mamorona kaonty': 'Create account',
    'Hiditra': 'Sign in',
    'Email': 'Email',
    'Teny miafina': 'Password',
    'Farito ny tetikasanao.': 'Describe your project.',
    'Mamorona sy mitahiry tetikasa': 'Create and save project',
    'Tetikasa AI vaovao': 'New AI project',
    'Farito ny zavatra tianao hatsangana…': 'Describe what you want to build…',
    'Mamorona sy mitahiry': 'Create and save',
    'Tsy mbola misy tetikasa.': 'No projects yet.',
    'Mifandray': 'Connected',
    'Tsy mbola mifandray': 'Not connected',
    'Tsy afaka nitahiry ny tetikasa.': 'Could not save the project.',
    'Tsy nahomby ny fidirana.': 'Sign-in failed.',
    'Tsy afaka nivoaka.': 'Could not sign out.',
    "AI Builder — kaonty manokana, Core balance manokana.": "AI Builder — your account and Core balance.",
    "Mamoròna kaonty AI Builder": "Create an AI Builder account",
    "Midira amin’ny kaontinao": "Sign in to your account",
    "Ny kaonty Builder dia misaraka amin’ny Core Console. Ampifandraiso avy eo ny 4ndev_sk mba hampiasa ny balance Core-nao.": "Your Builder account is separate from Core Console. Connect your 4ndev_sk key to use your Core balance.",
    "Farafahakeliny 12 tarehintsoratra": "At least 12 characters",
    "Miandry…": "Please wait…",
    "Efa manana kaonty? Hiditra": "Already have an account? Sign in",
    "Tsy mbola manana kaonty? Hisoratra anarana": "No account yet? Register",
    "Kaonty": "Account",
    "Farito ny zavatra tianao hatsangana amin’ny alalan’ny AI.": "Describe what you want to build with AI.",
    "Ohatra: Mamoròna boutique misy catalogue, panier ary espace admin…": "Example: Create a shop with a catalogue, cart, and admin area…",
    "Mitahiry…": "Saving…",
    "Serivisy Core": "Core services",
    "Manamarina…": "Verifying…",
    "Tehirizo ny famaritana; mbola tsy mandeha ny génération AI.": "Save the description; AI generation is not enabled yet.",
    "Farito ny tetikasa…": "Describe the project…",
    "Voatahiry isaky ny kaonty.": "Saved per account.",
    "Farito ny zavatra tianao hatsangana…": "Describe what you want to build…",
    "Tsy afaka naka ny balance Core.": "Could not load the Core balance.",
    'Workspace-nao hananganana sy hitantanana application.': 'Your workspace to build and manage applications.',
    'Mamorona application amin’ny AI': 'Build an application with AI',
    'Ampifandraiso amin’ny Settings aloha ny 4N DEV Core API key.': 'Connect your 4N DEV Core API key in Settings first.',
    'Mamorona ny rakitra amin’ny alalan’ny 4N DEV Core…': 'Generating files with 4N DEV Core…',
    'Vita ny génération.': 'Generation complete.',
    'Tsy nahomby ny génération; mety mbola voatahiry ilay tetikasa.': 'Generation failed; the project may still be saved.',
    'Ny AI Builder no mandrindra ny modely Core ao ambadika.': 'AI Builder manages Core model selection in the background.',
    'Mamorona rakitra amin’ny alalan’ny Core; ny fandaniana dia alaina amin’ny balance Core.': 'Generate files through Core; charges come from your Core balance.',
    'Mamorona application': 'Generate application',
  },
  fr: {
    'Fiteny': 'Langue',
    'Dashboard': 'Tableau de bord',
    'AI Builder': 'AI Builder',
    'Code': 'Code',
    'Preview': 'Aperçu',
    'Files': 'Fichiers',
    'My Projects': 'Mes projets',
    'Settings': 'Paramètres',
    'Help Center': 'Centre d’aide',
    'New Project': 'Nouveau projet',
    'Overview an’ny workspace': 'Vue d’ensemble de l’espace de travail',
    'Mamorona app amin’ny prompt': 'Créer une application à partir d’une instruction',
    'Jereo sy ovay ny code': 'Voir et modifier le code',
    'Live preview an’ilay app': 'Aperçu en direct de l’application',
    'Project file explorer': 'Explorateur de fichiers du projet',
    'Projects voatahiry': 'Projets enregistrés',
    'Midira na mamoròna kaonty hanombohana.': 'Connectez-vous ou créez un compte pour commencer.',
    'Tafiditra soa aman-tsara.': 'Connexion réussie.',
    'Hivoaka': 'Déconnexion',
    'Tetikasa': 'Projets',
    'Ny tetikasako': 'Mes projets',
    'Rakitra tetikasa': 'Fichiers du projet',
    'Fampifandraisana 4N DEV Core': 'Connexion à 4N DEV Core',
    'Ampifandraiso ny Core': 'Connecter Core',
    'Jereo ny balance Core': 'Voir le solde Core',
    'Esory ny fifandraisana': 'Déconnecter',
    'Mamorona kaonty': 'Créer un compte',
    'Hiditra': 'Se connecter',
    'Email': 'E-mail',
    'Teny miafina': 'Mot de passe',
    'Farito ny tetikasanao.': 'Décrivez votre projet.',
    'Mamorona sy mitahiry tetikasa': 'Créer et enregistrer le projet',
    'Tetikasa AI vaovao': 'Nouveau projet IA',
    'Farito ny zavatra tianao hatsangana…': 'Décrivez ce que vous souhaitez créer…',
    'Mamorona sy mitahiry': 'Créer et enregistrer',
    'Tsy mbola misy tetikasa.': 'Aucun projet pour le moment.',
    'Mifandray': 'Connecté',
    'Tsy mbola mifandray': 'Non connecté',
    'Tsy afaka nitahiry ny tetikasa.': 'Impossible d’enregistrer le projet.',
    'Tsy nahomby ny fidirana.': 'Échec de la connexion.',
    'Tsy afaka nivoaka.': 'Impossible de se déconnecter.',
    "AI Builder — kaonty manokana, Core balance manokana.": "AI Builder — votre compte et votre solde Core.",
    "Mamoròna kaonty AI Builder": "Créer un compte AI Builder",
    "Midira amin’ny kaontinao": "Connectez-vous à votre compte",
    "Ny kaonty Builder dia misaraka amin’ny Core Console. Ampifandraiso avy eo ny 4ndev_sk mba hampiasa ny balance Core-nao.": "Le compte Builder est distinct de Core Console. Connectez votre clé 4ndev_sk pour utiliser votre solde Core.",
    "Farafahakeliny 12 tarehintsoratra": "Au moins 12 caractères",
    "Miandry…": "Veuillez patienter…",
    "Efa manana kaonty? Hiditra": "Vous avez déjà un compte ? Connexion",
    "Tsy mbola manana kaonty? Hisoratra anarana": "Pas encore de compte ? Inscription",
    "Kaonty": "Compte",
    "Farito ny zavatra tianao hatsangana amin’ny alalan’ny AI.": "Décrivez ce que vous souhaitez créer avec l’IA.",
    "Ohatra: Mamoròna boutique misy catalogue, panier ary espace admin…": "Exemple : créer une boutique avec catalogue, panier et espace administrateur…",
    "Mitahiry…": "Enregistrement…",
    "Serivisy Core": "Services Core",
    "Manamarina…": "Vérification…",
    "Tehirizo ny famaritana; mbola tsy mandeha ny génération AI.": "Enregistrez la description ; la génération IA n’est pas encore activée.",
    "Farito ny tetikasa…": "Décrivez le projet…",
    "Voatahiry isaky ny kaonty.": "Enregistrés par compte.",
    "Farito ny zavatra tianao hatsangana…": "Décrivez ce que vous souhaitez créer…",
    "Tsy afaka naka ny balance Core.": "Impossible de charger le solde Core.",
    'Workspace-nao hananganana sy hitantanana application.': 'Votre espace pour créer et gérer des applications.',
    'Mamorona application amin’ny AI': 'Créer une application avec l’IA',
    'Ampifandraiso amin’ny Settings aloha ny 4N DEV Core API key.': 'Connectez d’abord votre clé API 4N DEV Core dans Paramètres.',
    'Mamorona ny rakitra amin’ny alalan’ny 4N DEV Core…': 'Génération des fichiers avec 4N DEV Core…',
    'Vita ny génération.': 'Génération terminée.',
    'Tsy nahomby ny génération; mety mbola voatahiry ilay tetikasa.': 'Échec de la génération ; le projet peut toutefois être enregistré.',
    'Ny AI Builder no mandrindra ny modely Core ao ambadika.': 'AI Builder gère la sélection des modèles Core en arrière-plan.',
    'Mamorona rakitra amin’ny alalan’ny Core; ny fandaniana dia alaina amin’ny balance Core.': 'Les fichiers sont générés via Core et débités de votre solde Core.',
    'Mamorona application': 'Générer l’application',
  },
};

const LanguageContext = createContext<ReturnType<typeof useLanguageValue> | null>(null);

function useLanguageValue() {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'en' || saved === 'fr' || saved === 'mg' ? saved : 'mg';
    } catch {
      return 'mg';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Keep the selected language for this session if storage is unavailable.
    }
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (next: Language) => setLanguageState(next);
  const t = (text: string) => dictionaries[language][text] ?? text;
  return useMemo(() => ({ language, setLanguage, t }), [language]);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const value = useLanguageValue();
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
