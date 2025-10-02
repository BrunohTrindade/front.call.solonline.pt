import React, { useEffect, useState } from 'react'
import { useApi, useAuth } from '../services/api.jsx'
import { Link as RouterLink } from 'react-router-dom'
import Logo from '../imagens/LOGO_Sol_Online.png'
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Divider,
  Container,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Switch
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  LightModeOutlined as LightModeIcon,
  DarkModeOutlined as DarkModeIcon,
  LogoutOutlined as LogoutIcon,
  Menu as MenuIcon,
  PeopleOutline as PeopleIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material'
import { useThemeMode } from '../theme/ThemeModeContext.jsx'

export default function AdminUsuarios(){
  const { createUser } = useApi()
  const { user, logout } = useAuth()
  const { mode, toggle } = useThemeMode()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success') // 'success' | 'error'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // O modo de tema agora é controlado globalmente pelo ThemeModeContext

  if(!user?.is_admin){
    return (
      <>
        <AppBar position="static" color="default" enableColorOnDark sx={{ bgcolor: 'background.paper', borderBottom: t => `1px solid ${t.palette.divider}` }}>
          <Toolbar sx={{ gap: 2, minHeight: 72 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
              <Box className="app-brand" aria-hidden sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'primary.contrastText', bgcolor: 'primary.main', borderRadius: 1.2 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <ellipse cx="12" cy="5" rx="8" ry="3" fill="currentColor"/>
                  <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" fill="currentColor" opacity=".9"/>
                  <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" fill="currentColor" opacity=".8"/>
                </svg>
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.15 }}>Administração de Usuários</Typography>
                <Typography variant="caption" color="text.secondary">Acesso restrito</Typography>
              </Box>
            </Box>
            {/* Ações: visíveis em sm+ (tablet/desktop). No mobile, use Drawer */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.25 }}>
              <Chip
                size="small"
                variant="filled"
                icon={<Box sx={{ width: 8, height: 8, bgcolor: 'warning.main', borderRadius: '50%' }} />}
                label="Sem permissão"
                sx={(t)=>(
                  {
                    bgcolor: alpha(t.palette.warning.main, 0.12),
                    color: t.palette.warning.main,
                    '& .MuiChip-icon': { color: t.palette.warning.main },
                    fontWeight: 500,
                    borderRadius: 1.5,
                  }
                )}
              />
              <Tooltip title={mode === 'dark' ? 'Tema: Escuro (clique para Claro)' : 'Tema: Claro (clique para Escuro)'}>
                <IconButton color="inherit" onClick={toggle} aria-label="Alternar tema" sx={{
                  borderRadius: 2,
                  transition: 'all .2s ease',
                  '&:hover': { bgcolor: (t)=> alpha(t.palette.text.primary, 0.06), transform: 'translateY(-1px)' }
                }}>
                  {mode === 'dark' ? <LightModeIcon fontSize="small"/> : <DarkModeIcon fontSize="small"/>}
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: .5, opacity: .4 }} />
              <Button variant="outlined" component={RouterLink} to="/movimentacao">Voltar</Button>
            </Box>
            {/* Botão de menu - apenas mobile */}
            <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
              <IconButton aria-label="Abrir menu" onClick={()=> setMobileMenuOpen(true)}>
                <MenuIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        {/* Drawer (menu slider) - somente mobile */}
        <Drawer anchor="right" open={mobileMenuOpen} onClose={()=> setMobileMenuOpen(false)} sx={{ display: { xs: 'block', sm: 'none' } }}>
          <Box sx={{ width: 300 }} role="presentation" onKeyDown={(e)=>{ if(e.key==='Escape') setMobileMenuOpen(false) }}>
            <Box sx={{ p: 2, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Menu</Typography>
              <Chip size="small" label="Admin" color="warning" variant="outlined" />
            </Box>
            <Divider />
            <List>
              <ListItemButton onClick={()=>{ toggle(); }}>
                <ListItemIcon>{mode==='dark' ? <LightModeIcon/> : <DarkModeIcon/>}</ListItemIcon>
                <ListItemText primary={`Tema: ${mode==='dark' ? 'Escuro' : 'Claro'}`} />
                <Switch edge="end" checked={mode==='dark'} onChange={toggle} />
              </ListItemButton>
              <ListItemButton component={RouterLink} to="/movimentacao" onClick={()=> setMobileMenuOpen(false)}>
                <ListItemIcon><ArrowBackIcon/></ListItemIcon>
                <ListItemText primary="Movimentação" />
              </ListItemButton>
              {user && (
                <ListItemButton onClick={()=>{ setMobileMenuOpen(false); logout(); }}>
                  <ListItemIcon><LogoutIcon/></ListItemIcon>
                  <ListItemText primary="Sair" />
                </ListItemButton>
              )}
            </List>
          </Box>
        </Drawer>
        <Box sx={{
          width: '100%',
          bgcolor: (t)=> t.palette.mode==='light' ? '#f7f9fb' : alpha('#ffffff', 0.03),
          py: { xs: 2, sm: 3 },
          minHeight: 'calc(100dvh - 72px)'
        }}>
          <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 } }}>
            <div className="center-login">
              <div className="card login-card">
                <div style={{textAlign:'center'}}>
                  <img src={Logo} alt="Sol Online" style={{height:56, width:'auto'}} />
                </div>
                <h2 className="card-title" style={{textAlign:'center'}}>Acesso Negado</h2>
                <div className="muted" style={{textAlign:'center'}}>Você não tem acesso a esta página.</div>
                <div style={{textAlign:'center', marginTop:16}}>
                  <RouterLink className="link" to="/movimentacao">Voltar</RouterLink>
                </div>
              </div>
            </div>
          </Container>
        </Box>
      </>
    )
  }

  async function submit(e){
    e.preventDefault()
    setMsg('')
    setMsgType('success')
    try{
      const u = await createUser({ name, email, password, is_admin: isAdmin })
      setMsg(`Usuário criado: ${u.email}`)
      setMsgType('success')
      setName(''); setEmail(''); setPassword(''); setIsAdmin(false)
      setShowPwd(false)
    }catch(e){
      const text = String(e?.message || 'Falha ao criar usuário')
      setMsg(text.startsWith('Erro:') ? text : `Erro: ${text}`)
      setMsgType('error')
    }
  }

  return (
    <>
      <AppBar position="static" color="default" enableColorOnDark sx={{ bgcolor: 'background.paper', borderBottom: t => `1px solid ${t.palette.divider}` }}>
        <Toolbar sx={{ gap: 2, minHeight: 72 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
            <Box className="app-brand" aria-hidden sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'primary.contrastText', bgcolor: 'primary.main', borderRadius: 1.2 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <ellipse cx="12" cy="5" rx="8" ry="3" fill="currentColor"/>
                <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" fill="currentColor" opacity=".9"/>
                <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" fill="currentColor" opacity=".8"/>
              </svg>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.15 }}>Administração de Usuários</Typography>
              <Typography variant="caption" color="text.secondary">Criar novo usuário</Typography>
            </Box>
          </Box>
          {/* Ações: visíveis em sm+ (tablet/desktop). No mobile, use Drawer */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.25 }}>
            <Chip
              size="small"
              variant="filled"
              icon={<Box sx={{ width: 8, height: 8, bgcolor: 'success.main', borderRadius: '50%' }} />}
              label="Sistema Online"
              sx={(t)=>(
                {
                  bgcolor: alpha(t.palette.success.main, 0.12),
                  color: t.palette.success.main,
                  '& .MuiChip-icon': { color: t.palette.success.main },
                  fontWeight: 500,
                  borderRadius: 1.5,
                }
              )}
            />
            <Tooltip title={mode === 'dark' ? 'Tema: Escuro (clique para Claro)' : 'Tema: Claro (clique para Escuro)'}>
              <IconButton color="inherit" onClick={toggle} aria-label="Alternar tema" sx={{
                borderRadius: 2,
                transition: 'all .2s ease',
                '&:hover': { bgcolor: (t)=> alpha(t.palette.text.primary, 0.06), transform: 'translateY(-1px)' }
              }}>
                {mode === 'dark' ? <LightModeIcon fontSize="small"/> : <DarkModeIcon fontSize="small"/>}
              </IconButton>
            </Tooltip>
            {user && (
              <Button
                variant="text"
                color="inherit"
                size="small"
                startIcon={<LogoutIcon />}
                onClick={logout}
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  '&:hover': { bgcolor: (t)=> alpha(t.palette.text.primary, 0.06) }
                }}
              >
                Sair
              </Button>
            )}
            <Divider orientation="vertical" flexItem sx={{ mx: .5, opacity: .4 }} />
            <Button variant="outlined" component={RouterLink} to="/movimentacao">Voltar</Button>
          </Box>
          {/* Botão de menu - apenas mobile */}
          <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
            <IconButton aria-label="Abrir menu" onClick={()=> setMobileMenuOpen(true)}>
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      {/* Drawer (menu slider) - somente mobile */}
      <Drawer anchor="right" open={mobileMenuOpen} onClose={()=> setMobileMenuOpen(false)} sx={{ display: { xs: 'block', sm: 'none' } }}>
        <Box sx={{ width: 300 }} role="presentation" onKeyDown={(e)=>{ if(e.key==='Escape') setMobileMenuOpen(false) }}>
          <Box sx={{ p: 2, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Menu</Typography>
            <Chip size="small" label="Admin" color="warning" variant="outlined" />
          </Box>
          <Divider />
          <List>
            <ListItemButton onClick={()=>{ toggle(); }}>
              <ListItemIcon>{mode==='dark' ? <LightModeIcon/> : <DarkModeIcon/>}</ListItemIcon>
              <ListItemText primary={`Tema: ${mode==='dark' ? 'Escuro' : 'Claro'}`} />
              <Switch edge="end" checked={mode==='dark'} onChange={toggle} />
            </ListItemButton>
            <ListItemButton component={RouterLink} to="/movimentacao" onClick={()=> setMobileMenuOpen(false)}>
              <ListItemIcon><ArrowBackIcon/></ListItemIcon>
              <ListItemText primary="Movimentação" />
            </ListItemButton>
            {user && (
              <ListItemButton onClick={()=>{ setMobileMenuOpen(false); logout(); }}>
                <ListItemIcon><LogoutIcon/></ListItemIcon>
                <ListItemText primary="Sair" />
              </ListItemButton>
            )}
          </List>
        </Box>
      </Drawer>
      <Box sx={{
        width: '100%',
        bgcolor: (t)=> t.palette.mode==='light' ? '#f7f9fb' : alpha('#ffffff', 0.03),
        py: 0,
        height: 'calc(100dvh - 72px)',
        overflow: 'hidden'
      }}>
        <Container maxWidth="sm" sx={{ px: { xs: 2, sm: 3 }, height: '100%' }}>
          <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
            <form onSubmit={submit} className="card login-card narrow space-y-2">
              <div style={{textAlign:'center'}}>
                <img src={Logo} alt="Sol Online" style={{height:42, width:'auto'}} />
              </div>
              <div>
                <h2 className="card-title" style={{textAlign:'center', fontSize:26}}>Criar usuário</h2>
                <div className="muted" style={{textAlign:'center'}}>Logado como: {user?.name}</div>
              </div>
              {msg && (
                <div style={{textAlign:'center'}}>
                  <span className={`badge ${msgType==='error' ? 'badge-danger' : 'badge-success'}`}>{msg}</span>
                </div>
              )}
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={name} onChange={e=>setName(e.target.value)} required />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Senha *</label>
                <div className="input-wrap">
                  <input className="input suffix-pad" type={showPwd?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required />
                  <button type="button" className="input-icon-btn" onClick={()=>setShowPwd(v=>!v)} title={showPwd?'Ocultar':'Mostrar'}>👁️</button>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} /> Administrador
              </label>
              <div>
                <button className="btn btn-primary btn-block" type="submit">Criar Usuário</button>
              </div>
              <div style={{textAlign:'center'}}>
                <RouterLink className="link" to="/movimentacao">Voltar</RouterLink>
              </div>
            </form>
          </Box>
        </Container>
      </Box>
    </>
  )
}
