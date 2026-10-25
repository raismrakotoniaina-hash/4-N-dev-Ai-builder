import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './lib/i18n';
import { LanguageProvider } from './lib/i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <LanguageProvider>
      <App />
    </LanguageProvider>
    </LanguageProvider>
  </StrictMode>,
);
