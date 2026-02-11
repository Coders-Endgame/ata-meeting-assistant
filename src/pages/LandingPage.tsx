import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <div className="container landing-page-container">

      <h1>Welcome to Meeting Assistant</h1>
      <p className="landing-description">
        Streamline your Zoom meetings with automated summaries and action items.
      </p>

      <div className="landing-action-area">
        <Link to="/auth">
          <button className="button primary landing-start-button">
            Get Started
          </button>
        </Link>
      </div>
    </div>
  );
}
