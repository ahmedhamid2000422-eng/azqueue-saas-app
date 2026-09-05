import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "../locales/en.json";
import ar from "../locales/ar.json";
import am from "../locales/am.json";
import ti from "../locales/ti.json";
import es from "../locales/es.json";
import zh from "../locales/zh.json";

/* ms.json, fr.json and ur.json are still on disk but no longer loaded.
   They were chosen when this was aimed at Malaysia. Az Tax Services is in
   Aurora, Colorado, where the people walking in speak Amharic, Tigrinya,
   Arabic, Spanish and Chinese — Malay and French were dead weight in the
   bundle and Urdu is not the community this office serves. Left as files
   rather than deleted, in case a later branch needs them. */

/* Ordered by who actually walks through the door in Aurora, not
   alphabetically. English first, then Arabic, then the Ethiopian and
   Eritrean languages that a large part of this office's clientele speaks,
   then Spanish and Chinese. */
export const LANGUAGES = [
  { code: "en", label: "English",  native: "English",  rtl: false },
  { code: "ar", label: "Arabic",   native: "العربية",  rtl: true  },
  { code: "am", label: "Amharic",  native: "አማርኛ",     rtl: false },
  { code: "ti", label: "Tigrinya", native: "ትግርኛ",     rtl: false },
  { code: "es", label: "Spanish",  native: "Español",  rtl: false },
  { code: "zh", label: "Chinese",  native: "中文",      rtl: false },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      am: { translation: am },
      ti: { translation: ti },
      es: { translation: es },
      zh: { translation: zh },
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "azq.lang",
    },
    interpolation: { escapeValue: false },
  });

// Apply dir="rtl" on <html> when an RTL language is active
function applyDir(lng) {
  const lang = LANGUAGES.find((l) => l.code === lng) ?? LANGUAGES[0];
  document.documentElement.dir = lang.rtl ? "rtl" : "ltr";
  document.documentElement.lang = lang.code;
}
applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

export default i18n;
