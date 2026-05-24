import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "../locales/en.json";
import ms from "../locales/ms.json";
import ar from "../locales/ar.json";
import fr from "../locales/fr.json";
import ur from "../locales/ur.json";

export const LANGUAGES = [
  { code: "en", label: "English",   native: "English",   rtl: false },
  { code: "ms", label: "Malay",     native: "Bahasa",    rtl: false },
  { code: "ar", label: "Arabic",    native: "العربية",   rtl: true  },
  { code: "fr", label: "French",    native: "Français",  rtl: false },
  { code: "ur", label: "Urdu",      native: "اُردُو",     rtl: true  },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    resources: {
      en: { translation: en },
      ms: { translation: ms },
      ar: { translation: ar },
      fr: { translation: fr },
      ur: { translation: ur },
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
