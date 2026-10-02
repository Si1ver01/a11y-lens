import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import './style.css';

const root = document.querySelector('#root');

if (!(root instanceof HTMLElement)) {
  throw new Error('Popup root element is missing.');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
