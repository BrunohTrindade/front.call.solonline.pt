import React, { useEffect, useState } from 'react'
import Logo from '../imagens/LOGO_Sol_Online.png'
import { useAuth, useApi } from '../services/api.jsx'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const { login } = useAuth()
  const api = useApi()
  const nav = useNavigate()
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('admin123')
  const [err, setErr] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')

  useEffect(()=>{
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Prefetch do bundle e também de dados iniciais para entrada instantânea
  useEffect(()=>{
    void import('./Movimentacao.jsx')
    // Inicia um prefetch leve de dados para primeira página
    const controller = new AbortController()
    const run = async ()=>{
      try {
        // Snapshot via sessão será usado pela Movimentação
        await Promise.all([
          api.listContacts?.(1, 50, { q: '', status: '' }),
          api.listContactsStats?.()
        ])
      } catch { /* ignora em tela de login */ }
    }
    run()
    return ()=> controller.abort()
  }, [])

  async function submit(e){
    e.preventDefault()
    setErr('')
    try{
      setLoading(true)
      await login(email, password)
      // Navega imediatamente; dados podem carregar em paralelo na página alvo
      nav('/movimentacao')
    }catch(e){ setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="center-login">
      <div className="topbar-login">
        <div className="theme-switch">
          <span className="label">{dark ? 'Escuro' : 'Claro'}</span>
          <div className={`theme-rail ${dark?'on':''}`} onClick={()=>setDark(v=>!v)} role="button" aria-label="Alternar tema">
            <div className="theme-knob" />
          </div>
        </div>
      </div>
      <form onSubmit={submit} className="card login-card space-y-4">
        <div style={{textAlign:'center'}}>
          <img src={Logo} alt="Sol Online" style={{height:56, width:'auto'}} />
        </div>
        <div>
          <h2 className="card-title" style={{textAlign:'center', fontSize:32}}>Acesse sua conta</h2>
          <div className="muted" style={{textAlign:'center'}}>login do administrador</div>
        </div>
        {err && <div style={{color:'var(--danger)', textAlign:'center'}}>{err}</div>}
        <div>
          <label className="label">Email *</label>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <label className="label">Senha *</label>
          <div className="input-wrap">
            <input className="input suffix-pad" value={password} onChange={e=>setPassword(e.target.value)} type={showPwd?'text':'password'} required />
            <button type="button" className="input-icon-btn" onClick={()=>setShowPwd(v=>!v)} title={showPwd?'Ocultar':'Mostrar'}>👁️</button>
          </div>
          <div className="mt-2"><a className="link" href="#">Esqueceu sua senha?</a></div>
        </div>
        <div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? (
              <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M22 12a10 10 0 0 1-10 10"/></svg>
                Entrando...
              </span>
            ) : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
