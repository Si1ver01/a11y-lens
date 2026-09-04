import React from 'react';
import ReactDOM from 'react-dom/client';

import './style.css';

export function PopupFoundation() {
  return (
    <main className="popup-foundation">
      <h1>a11y-lens</h1>
      <p>Accessibility audit is ready.</p>
    </main>
  );
}

const root = document.querySelector('#root');

if (!(root instanceof HTMLElement)) {
  throw new Error('Popup root element is missing.');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <PopupFoundation />
  </React.StrictMode>,
);
