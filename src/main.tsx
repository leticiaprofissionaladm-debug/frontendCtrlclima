
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import App from './App';
import ReportsPage from './pages/ReportsPage';
import ReportsAccessButton from './components/ReportsAccessButton';

import './index.css';
import './i18n';
import './styles/global.css';
import './App.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>

      <ReportsAccessButton />

      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>

    </BrowserRouter>
  </StrictMode>,
);
