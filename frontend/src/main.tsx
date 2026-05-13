import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
/* MODIFIQUEI AQUI — Bootstrap + ícones (WhatsApp / Telegram nos botões de partilha) */
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
