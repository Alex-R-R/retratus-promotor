import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles.css'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import Atualizacao from './components/Atualizacao'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Atualizacao />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
