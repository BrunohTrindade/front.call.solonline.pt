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
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert
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
  const { listUsers, updateUserActive, deleteUser } = useApi()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  // Tipo de usuário: 'admin' | 'normal' | 'comercial'.
  // Usaremos 3 checkboxes visuais, mas o estado é exclusivo (um ou nenhum selecionado)
  const [selectedType, setSelectedType] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success') // 'success' | 'error'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Popup de usuários
  const [usersOpen, setUsersOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [usersMsg, setUsersMsg] = useState('')
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
      if (!selectedType) {
        setMsg('Selecione o tipo de usuário (Admin, Normal ou Comercial).')
        setMsgType('error')
        return
      }
      const isAdmin = selectedType === 'admin'
      const role = isAdmin ? 'admin' : selectedType
      const isCommercial = selectedType === 'comercial'
      const payload = { name, email, password, is_admin: isAdmin, role, is_commercial: isCommercial }
      const u = await createUser(payload)
      setMsg(`Usuário criado: ${u.email}`)
      setMsgType('success')
      setName(''); setEmail(''); setPassword(''); setSelectedType('')
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
            {user?.is_admin && (
              <Button
                variant="contained"
                onClick={async ()=>{
                  setUsersOpen(true)
                  setUsersMsg('')
                  setLoadingUsers(true)
                  try { const list = await listUsers(); setUsers(list) } catch(e){ setUsersMsg(e?.message||'Erro ao carregar usuários') } finally { setLoadingUsers(false) }
                }}
              >Gerenciar Usuários</Button>
            )}
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
              {/* Seletor por 3 checkboxes exclusivas (Admin, Normal, Comercial) */}
              <div>
                <label className="label">Tipo de usuário</label>
                <div className="flex items-center gap-4" role="group" aria-label="Selecionar tipo de usuário">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedType==='admin'}
                      onChange={()=> setSelectedType(selectedType==='admin' ? '' : 'admin')}
                    /> Admin
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedType==='normal'}
                      onChange={()=> setSelectedType(selectedType==='normal' ? '' : 'normal')}
                    /> Normal
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedType==='comercial'}
                      onChange={()=> setSelectedType(selectedType==='comercial' ? '' : 'comercial')}
                    /> Comercial (somente leitura)
                  </label>
                </div>
                <div className="muted" style={{fontSize:'.85rem'}}>Selecione apenas um. Comercial não pode editar nem excluir registros. Admin tem acesso total.</div>
              </div>
              <div>
                <button className="btn btn-primary btn-block" type="submit" disabled={!selectedType}>Criar Usuário</button>
              </div>
              <div style={{textAlign:'center'}}>
                <RouterLink className="link" to="/movimentacao">Voltar</RouterLink>
              </div>
            </form>
          </Box>
        </Container>
      </Box>
      {/* Diálogo de usuários cadastrados */}
      <Dialog open={usersOpen} onClose={()=> setUsersOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Usuários cadastrados</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display:'flex', gap: 1, mb: 2 }}>
            <TextField size="small" fullWidth placeholder="Filtrar por nome ou email" value={filterText} onChange={e=>setFilterText(e.target.value)} />
            <Button variant="outlined" onClick={async ()=>{
              setUsersMsg('')
              setLoadingUsers(true)
              try { const list = await listUsers(); setUsers(list) } catch(e){ setUsersMsg(e?.message||'Erro ao carregar usuários') } finally { setLoadingUsers(false) }
            }}>Atualizar</Button>
          </Box>
          {usersMsg && <Alert severity="error" sx={{ mb: 1 }}>{usersMsg}</Alert>}
          <Box sx={{ display:'grid', gap: 1 }}>
            {loadingUsers && <Typography variant="body2">Carregando...</Typography>}
            {!loadingUsers && users
              .filter(u=>{
                const f = filterText.trim().toLowerCase()
                if(!f) return true
                return [u.name, u.email, u.role].filter(Boolean).some(v => String(v).toLowerCase().includes(f))
              })
              .map(u => (
                <Box key={u.id} sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', border: t=>`1px solid ${t.palette.divider}`, borderRadius: 1.5, p: 1 }}>
                  <Box sx={{ display:'flex', flexDirection:'column' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{u.name || u.email}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                    <Box sx={{ display:'flex', gap: 1, mt: .5 }}>
                      <Chip size="small" label={String(u.role||'normal')} sx={{ textTransform:'capitalize' }} />
                      <Chip size="small" color={u.active ? 'success' : 'default'} variant={u.active ? 'filled' : 'outlined'} label={u.active ? 'Ativo' : 'Inativo'} />
                    </Box>
                  </Box>
                  <Box sx={{ display:'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={async ()=>{
                      try{ await updateUserActive(u.id, !u.active); setUsers(prev => prev.map(x => x.id===u.id ? { ...x, active: !u.active } : x)) }catch(e){ setUsersMsg(e?.message||'Erro ao atualizar status') }
                    }}>{u.active ? 'Desativar' : 'Ativar'}</Button>
                    <Button size="small" color="error" variant="outlined" onClick={async ()=>{
                      if (!confirm(`Excluir usuário ${u.email}?`)) return
                      try{ await deleteUser(u.id); setUsers(prev => prev.filter(x => x.id !== u.id)) }catch(e){ setUsersMsg(e?.message||'Erro ao excluir usuário') }
                    }}>Excluir</Button>
                  </Box>
                </Box>
              ))}
            {!loadingUsers && users.length === 0 && (
              <Typography variant="body2" color="text.secondary">Nenhum usuário encontrado.</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setUsersOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
