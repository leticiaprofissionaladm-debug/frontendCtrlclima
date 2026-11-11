
import { ArrowLeft, Globe2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Reports from '../components/Reports';
import '../styles/ReportsPage.css';

export default function ReportsPage() {
  const { t } = useTranslation();

  return (
    <main className="reports-page">

      <header className="reports-page-header">

        <Link to="/" className="reports-back-button">
          <ArrowLeft size={18} />
          {t('reports.backToEarthscope')}
        </Link>

        <div className="reports-page-intro">
          <Globe2 size={28} />

          <div>
            <span>{t('reports.pageEyebrow')}</span>

            <h1>{t('reports.pageTitle')}</h1>

            <p>
              {t('reports.pageDescription')}
            </p>
          </div>
        </div>

      </header>

      <section className="reports-page-content">
        <Reports user={null} />
      </section>

    </main>
  );
}
