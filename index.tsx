import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/styles/global.css';
import './src/styles/vextor-effects.css';
import App from './App';
import './src/styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
