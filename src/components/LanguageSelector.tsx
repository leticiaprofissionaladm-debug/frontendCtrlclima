
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';

const languages = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);

  const currentLanguage =
    languages.find((language) => language.code === i18n.resolvedLanguage) ||
    languages[0];

  const changeLanguage = async (language: string) => {
    await i18n.changeLanguage(language);
    localStorage.setItem('ctrlclima_language', language);
    document.documentElement.lang = language;
    setOpen(false);
  };

  return (
    <div className="language-selector">
      <button
        type="button"
        className="language-trigger"
        onClick={() => setOpen(!open)}
        aria-label={t('language.label')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Globe size={18} />
        <span>{currentLanguage.label}</span>
        <ChevronDown size={15} />
      </button>

      {open && (
        <div className="language-dropdown">
          <span className="language-heading">
            {t('language.label')}
          </span>

          {languages.map((language) => (
            <button
              type="button"
              key={language.code}
              className="language-option"
              onClick={() => changeLanguage(language.code)}
              aria-current={
                currentLanguage.code === language.code ? 'true' : undefined
              }
            >
              <span>{language.flag}</span>
              <span>{language.label}</span>

              {currentLanguage.code === language.code && (
                <Check size={16} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
