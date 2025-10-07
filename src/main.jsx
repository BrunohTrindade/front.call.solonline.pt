import React, { Suspense, lazy } from 'react'
import Logo from './imagens/LOGO_Sol_Online.png'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
const Login = lazy(()=> import('./pages/Login.jsx'))
const Importacao = lazy(()=> import('./pages/Importacao.jsx'))
const Movimentacao = lazy(()=> import('./pages/Movimentacao.jsx'))
const AdminUsuarios = lazy(()=> import('./pages/AdminUsuarios.jsx'))
import { ApiProvider, useAuth } from './services/api.jsx'
import './styles/index.css'
import './styles/theme.css'
import { ThemeModeProvider } from './theme/ThemeModeContext.jsx'

function Shell({ children }){ return <>{children}</> }

function PrivateRoute({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

const container = document.getElementById('root')
if (!container) throw new Error('Elemento #root não encontrado')
// Evita montar duas vezes: reaproveita um root único por container
if (!container.__reactRoot) {
  container.__reactRoot = createRoot(container)
}
// Suporte HMR/Vite: desmonta root anterior ao recarregar módulo, evitando múltiplas árvores
if (import.meta && import.meta.hot) {
  import.meta.hot.dispose(() => {
    try { container.__reactRoot?.unmount() } catch {}
    try { delete container.__reactRoot } catch {}
  })
}

container.__reactRoot.render(
  <React.StrictMode>
    <ThemeModeProvider>
      <ApiProvider>
        <BrowserRouter>
          <Shell>
            <Suspense fallback={
              <div style={{display:'grid',placeItems:'center',height:'100vh'}}>
                <img src={Logo} alt="Sol Online" style={{height:72, width:'auto', opacity:.9}} />
              </div>
            }>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/importacao" element={<PrivateRoute><Importacao /></PrivateRoute>} />
                <Route path="/movimentacao" element={<PrivateRoute><Movimentacao /></PrivateRoute>} />
                <Route path="/admin/usuarios" element={<PrivateRoute><AdminUsuarios /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/movimentacao" replace />} />
              </Routes>
            </Suspense>
          </Shell>
        </BrowserRouter>
      </ApiProvider>
    </ThemeModeProvider>
  </React.StrictMode>
)
