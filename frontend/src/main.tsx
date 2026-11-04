import React from 'react';
import ReactDOM from 'react-dom/client';
import TestSuiteRunner from './tests/TestSuiteRunner';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TestSuiteRunner />
  </React.StrictMode>
);

