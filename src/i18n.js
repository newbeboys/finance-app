import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import id from './locales/id/translation.json';
import en from './locales/en/translation.json';

i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
  },
  lng: localStorage.getItem('bahasa') || 'id',
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
});

export default i18n;
