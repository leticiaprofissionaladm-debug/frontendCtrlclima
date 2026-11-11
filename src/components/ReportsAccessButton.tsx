
import { FileBarChart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './ReportsAccessButton.css';

export default function ReportsAccessButton() {
  const location = useLocation();

  if (location.pathname !== '/') {
    return null;
  }

  return (
    <Link to="/reports" className="reports-access-button">
      <FileBarChart size={20} />
      <span>Relatórios avançados</span>
    </Link>
  );
}
