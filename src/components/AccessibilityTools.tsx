import { useEffect, useState } from 'react';
import {
  Accessibility,
  Minus,
  Plus,
  Sun,
  Moon,
  Eye,
  BookOpen,
  Volume2,
  X,
  Languages,
  Focus,
  Pause,
  Play,
  Square,
  Type,
  Move,
} from 'lucide-react';

type Preferences = {
  fontScale: number;
  contrast: boolean;
  dark: boolean;
  links: boolean;
  spacing: boolean;
  dyslexia: boolean;
  focus: boolean;
  reduceMotion: boolean;
};

const defaults: Preferences = {
  fontScale: 100,
  contrast: false,
  dark: false,
  links: false,
  spacing: false,
  dyslexia: false,
  focus: false,
  reduceMotion: false,
};

function readPreferences(): Preferences {
  try {
    return {
      ...defaults,
      ...JSON.parse(
        localStorage.getItem('earthscope_accessibility') || '{}',
      ),
    };
  } catch {
    return defaults;
  }
}

export default function AccessibilityTools() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(readPreferences);
  const [readingPaused, setReadingPaused] = useState(false);

  // Aplicar preferências visuais
  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty(
      '--accessibility-scale',
      `${prefs.fontScale / 100}`,
    );

    root.dataset.contrast = prefs.contrast ? 'high' : 'normal';
    root.dataset.theme = prefs.dark ? 'dark' : 'light';
    root.dataset.links = prefs.links ? 'underlined' : 'normal';
    root.dataset.spacing = prefs.spacing ? 'wide' : 'normal';
    root.dataset.dyslexia = prefs.dyslexia ? 'on' : 'off';
    root.dataset.focus = prefs.focus ? 'on' : 'off';
    root.dataset.reduceMotion = prefs.reduceMotion ? 'on' : 'off';

    localStorage.setItem(
      'earthscope_accessibility',
      JSON.stringify(prefs),
    );
  }, [prefs]);

  // Inicializar VLibras
  useEffect(() => {
    if (document.getElementById('vlibras-widget-container')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'vlibras-widget-container';
    container.setAttribute('vw', '');
    container.className = 'enabled';

    const accessButton = document.createElement('div');
    accessButton.setAttribute('vw-access-button', '');
    accessButton.className = 'active';

    const pluginWrapper = document.createElement('div');
    pluginWrapper.setAttribute('vw-plugin-wrapper', '');

    const topWrapper = document.createElement('div');
    topWrapper.className = 'vw-plugin-top-wrapper';

    pluginWrapper.appendChild(topWrapper);
    container.appendChild(accessButton);
    container.appendChild(pluginWrapper);

    document.body.appendChild(container);

    if (!document.getElementById('vlibras-plugin-script')) {
      const script = document.createElement('script');
      script.id = 'vlibras-plugin-script';
      script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Destacar o elemento próximo ao cursor no modo foco
  useEffect(() => {
    if (!prefs.focus) return;

    let currentElement: Element | null = null;

    function handleMouseOver(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const element = target.closest(
        'p, li, h1, h2, h3, label, blockquote',
      );

      if (currentElement && currentElement !== element) {
        currentElement.classList.remove('reading-focus-highlight');
      }

      currentElement = element;

      currentElement?.classList.add('reading-focus-highlight');
    }

    function handleMouseOut() {
      currentElement?.classList.remove('reading-focus-highlight');
      currentElement = null;
    }

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      currentElement?.classList.remove('reading-focus-highlight');
    };
  }, [prefs.focus]);

  function update(partial: Partial<Preferences>) {
    setPrefs((current) => ({ ...current, ...partial }));
  }
  function readPage() {
    if (typeof window.speechSynthesis === 'undefined') {
      window.alert(
        'A leitura automática não está disponível neste navegador.',
      );
      return;
    }

    window.speechSynthesis.cancel();

    const main = document.querySelector('main');
    const text = (main?.innerText || document.body.innerText).slice(
      0,
      12000,
    );

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';

    window.speechSynthesis.speak(utterance);
    setReadingPaused(false);
  }

  function pauseReading() {
    if (typeof window.speechSynthesis === 'undefined') return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setReadingPaused(false);
    } else {
      window.speechSynthesis.pause();
      setReadingPaused(true);
    }
  }

  function stopReading() {
    if (typeof window.speechSynthesis !== 'undefined') {
      window.speechSynthesis.cancel();
    }

    setReadingPaused(false);
  }

  function restoreDefaults() {
    stopReading();
    setPrefs(defaults);
  }

  return (
    <div className="accessibility-tools">
      <button
        className="accessibility-launcher"
        type="button"
        aria-label="Abrir opções de acessibilidade"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Accessibility size={20} />
        <span>Acessibilidade</span>
      </button>

      {open && (
        <section
          className="accessibility-panel"
          role="dialog"
          aria-label="Opções de acessibilidade"
          aria-modal="false"
        >
          <div className="accessibility-panel-heading">
            <div>
              <strong>Opções de acessibilidade</strong>
              <p>Personalize sua experiência no EarthScope.</p>            </div>

            <button
              className="icon-button"
              type="button"
              aria-label="Fechar opções de acessibilidade"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="accessibility-control">
            <span>Tamanho do texto</span>

            <div className="accessibility-inline">
              <button
                type="button"
                className="secondary-button"
                aria-label="Diminuir texto"
                disabled={prefs.fontScale <= 85}
                onClick={() =>
                  update({
                    fontScale: Math.max(85, prefs.fontScale - 5),
                  })
                }
              >
                <Minus size={16} />
              </button>

              <strong aria-live="polite">{prefs.fontScale}%</strong>

              <button
                type="button"
                className="secondary-button"
                aria-label="Aumentar texto"
                disabled={prefs.fontScale >= 130}
                onClick={() =>
                  update({
                    fontScale: Math.min(130, prefs.fontScale + 5),
                  })
                }
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <button
            type="button"
            className={`accessibility-option ${prefs.dyslexia ? 'selected' : ''}`}
            aria-pressed={prefs.dyslexia}
            onClick={() => update({ dyslexia: !prefs.dyslexia })}
          >
            <Type size={17} />
            <span>Fonte de leitura</span>
            <strong>{prefs.dyslexia ? 'Ativada' : 'Desativada'}</strong>
          </button>

          <button
            type="button"
            className={`accessibility-option ${prefs.focus ? 'selected' : ''}`}
            aria-pressed={prefs.focus}
            onClick={() => update({ focus: !prefs.focus })}
          >
            <Focus size={17} />
            <span>Foco de leitura</span>
            <strong>{prefs.focus ? 'Ativado' : 'Desativado'}</strong>
          </button>

          <button
            type="button"
            className={`accessibility-option ${prefs.contrast ? 'selected' : ''}`}
            aria-pressed={prefs.contrast}
            onClick={() => update({ contrast: !prefs.contrast })}
          >
            <Eye size={17} />
            <span>Alto contraste</span>
            <strong>{prefs.contrast ? 'Ativado' : 'Desativado'}</strong>
          </button>

          <button
            type="button"
            className={`accessibility-option ${prefs.dark ? 'selected' : ''}`}
            aria-pressed={prefs.dark}
            onClick={() => update({ dark: !prefs.dark })}
          >
            {prefs.dark ? <Sun size={17} /> : <Moon size={17} />}
            <span>Modo escuro</span>
            <strong>{prefs.dark ? 'Ativado' : 'Desativado'}</strong>
          </button>

          <button
            type="button"
            className={`accessibility-option ${prefs.links ? 'selected' : ''}`}
            aria-pressed={prefs.links}
            onClick={() => update({ links: !prefs.links })}
          >
            <BookOpen size={17} />
            <span>Sublinhar links</span>
            <strong>{prefs.links ? 'Ativado' : 'Desativado'}</strong>
          </button>

          <button
            type="button"
            className={`accessibility-option ${prefs.spacing ? 'selected' : ''}`}
            aria-pressed={prefs.spacing}
            onClick={() => update({ spacing: !prefs.spacing })}
          >
            <Move size={17} />
            <span>Mais espaçamento</span>
            <strong>{prefs.spacing ? 'Ativado' : 'Desativado'}</strong>
          </button>

          <button
            type="button"
            className={`accessibility-option ${prefs.reduceMotion ? 'selected' : ''}`}
            aria-pressed={prefs.reduceMotion}
            onClick={() =>
              update({ reduceMotion: !prefs.reduceMotion })
            }
          >
            <Accessibility size={17} />
            <span>Reduzir animações</span>
            <strong>{prefs.reduceMotion ? 'Ativado' : 'Desativado'}</strong>
          </button>

          <div className="accessibility-section-label">
            Leitura em voz alta
          </div>

          <div className="accessibility-inline accessibility-speech">
            <button
              type="button"
              className="primary-button"
              onClick={readPage}
            >
              <Volume2 size={16} />
              Ler página
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={pauseReading}
              aria-label={readingPaused ? 'Continuar leitura' : 'Pausar leitura'}
            >
              {readingPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={stopReading}
              aria-label="Parar leitura"
            >
              <Square size={16} />
            </button>
          </div>

          <button
            type="button"
            className="secondary-button full"
            onClick={restoreDefaults}
          >
            Restaurar padrão
          </button>

          <p className="accessibility-note">
            Para tradução em Libras, utilize o botão flutuante do VLibras.
          </p>
        </section>
      )}
    </div>
  );
}
