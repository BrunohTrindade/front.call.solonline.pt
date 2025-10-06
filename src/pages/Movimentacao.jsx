import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApi, useAuth } from '../services/api.jsx'
import { Link as RouterLink } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Chip,
  Tooltip,
  Divider,
  Container,
  Alert,
  AlertTitle,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Switch
  , Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  FilterList as FilterListIcon,
  Upload as UploadIcon,
  LightModeOutlined as LightModeIcon,
  DarkModeOutlined as DarkModeIcon,
  LogoutOutlined as LogoutIcon,
  PeopleOutline as PeopleIcon,
  Search as SearchIcon,
  Menu as MenuIcon
} from '@mui/icons-material'
import { useThemeMode } from '../theme/ThemeModeContext.jsx'

export default function Movimentacao(){
  const api = useApi()
  const { listContacts, updateContact, getContact, listContactsStats, deleteContact } = api
  const { user, logout } = useAuth()
  const displayName = api.getDisplayName?.() || ''
  const { mode, toggle } = useThemeMode()
  const [data, setData] = useState({ data: [], meta: {} })
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [selected, setSelected] = useState(null)
  const [observacao, setObservacao] = useState('')
  const [status, setStatus] = useState('')
  const [dirty, setDirty] = useState(false)
  // Mantém texto de observação não gravado por registro (id -> texto)
  const [unsaved, setUnsaved] = useState({})
  const obsRef = useRef(null)
  const listCardRef = useRef(null)
  const listRef = useRef(null) // ul da lista de registros
  const detailsCardRef = useRef(null)
  const [stats, setStats] = useState({ total: 0, processed: 0, pending: 0 })
  const [query, setQuery] = useState('')
  const [showOnly, setShowOnly] = useState('all') // all | pending | processed
  const [filterAnchor, setFilterAnchor] = useState(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState(null)
  const [deleteTargetNumero, setDeleteTargetNumero] = useState(null)
  // Altura máxima da lista para exibir 9 itens; do 10º em diante ativa rolagem
  const [listMaxHeight, setListMaxHeight] = useState(null)
  const [scriptText, setScriptText] = useState('')
  const [loadError, setLoadError] = useState('')

  const scriptTexto = useMemo(()=>`Olá, aqui é da Agência SolOnline.\nTexto de abordagem e roteiro...`, [])

  async function load(bust=false){
    const statusParam = showOnly === 'pending' ? 'pending' : (showOnly === 'processed' ? 'processed' : '')
    try{
      setLoadError('')
      // aplica snapshot de sessão imediatamente, se existir, para sensação instantânea
      const snapList = api.getContactsSnapshot(page, perPage, { q: query, status: statusParam })
      if (snapList) setData(prev => prev?.meta?.current_page === snapList?.meta?.current_page && prev?.data?.length ? prev : snapList)
      const snapStats = api.getContactsStatsSnapshot()
      if (snapStats) setStats(prev => (prev?.total||0) ? prev : { total: snapStats.total||0, processed: snapStats.processed||0, pending: snapStats.pending||0 })

      // busca lista primeiro e aplica assim que chegar; stats em paralelo, sem bloquear a lista
      const resPromise = listContacts(page, perPage, { q: query, status: statusParam, bust })
      const statsPromise = listContactsStats({ bust }).catch(()=> ({ total:0, processed:0, pending:0 }))
      // hidrata o script com snapshot e depois atualiza com GET
      const snapScript = (sessionStorage.getItem('snapshot:settings:script'))
      if (snapScript) {
        try { const obj = JSON.parse(snapScript); if (obj?.data?.script != null) setScriptText(String(obj.data.script||'')) } catch {}
      }
      const scriptPromise = api.getScript().catch(()=> ({ script: '' }))

      const res = await resPromise
      setData(res)
      // fallback de página se necessário
      const items = Array.isArray(res?.data) ? res.data.length : 0
      const current = res?.meta?.current_page || page
      if (items === 0 && current > 1) {
        setPage(current - 1)
      }

    const s = await statsPromise
      setStats({ total: s.total||0, processed: s.processed||0, pending: s.pending||0 })
    const sc = await scriptPromise
    setScriptText(String(sc?.script || ''))
      return { res, s }
    } catch (e) {
      setLoadError(e?.message || 'Falha ao carregar dados')
      return null
    }
  }

  useEffect(()=>{ load(false) }, [page, perPage])

  // Força não-admin a usar apenas a visão 'all' e garante que o menu de filtro fique fechado
  useEffect(()=>{
    if(!user?.is_admin){
      if(showOnly !== 'all') setShowOnly('all')
      if(filterAnchor) setFilterAnchor(null)
    }
  }, [user?.is_admin, showOnly, filterAnchor])

  // Computa lastPage com fallback por total/perPage quando meta não informar
  const lastPage = useMemo(()=>{
    const metaLast = Number(data?.meta?.last_page) || 1
    const metaPer = Number(data?.meta?.per_page) || perPage
    const metaTotal = Number(data?.meta?.total) || 0
    const fromMeta = Math.max(1, metaLast)
    const fromStats = metaPer > 0 ? Math.max(1, Math.ceil((stats?.total || 0) / metaPer)) : 1
    // usa o maior estimado entre meta e stats, evitando ficar preso em 1
    return Math.max(fromMeta, fromStats)
  }, [data?.meta?.last_page, data?.meta?.per_page, data?.meta?.total, perPage, stats?.total])

  // Prefetch da próxima página para navegação instantânea
  useEffect(()=>{
    const statusParam = showOnly === 'pending' ? 'pending' : (showOnly === 'processed' ? 'processed' : '')
    if (page < lastPage) {
      listContacts(page + 1, perPage, { q: query, status: statusParam }).catch(()=>{})
    }
  }, [page, perPage, lastPage, query, showOnly])

  // Calcula a altura máxima da lista para caber 9 itens visíveis (scroll a partir do 10º)
  useEffect(()=>{
    function recompute(){
      const root = listRef.current
      if(!root) { setListMaxHeight(null); return }
      // pega o primeiro item real renderizado
      const first = root.querySelector('li.list-item')
      if(!first){ setListMaxHeight(null); return }
      const h = first.offsetHeight || 0
      // tenta inferir o espaçamento vertical (margem inferior) do item
      let gap = 0
      try {
        const cs = window.getComputedStyle(first)
        gap = parseFloat(cs.marginBottom || '0') || 0
      } catch {}
      // 9 itens => 9 alturas + 8 gaps entre eles
      const maxH = (h * 9) + (gap * 8)
      // adiciona uma folga pequena para bordas/padding do container
      setListMaxHeight(Math.ceil(maxH + 2))
    }
    // recalcula após mudanças de dados/filtros/seleção e também no resize
    recompute()
    window.addEventListener('resize', recompute)
    return ()=> window.removeEventListener('resize', recompute)
  }, [data, query, showOnly, selected, dirty, unsaved])

  // Auto-refresh: quando busca ou filtro mudarem, atualiza automaticamente.
  // Debounce curto para evitar excesso de requisições enquanto digita.
  useEffect(()=>{
    if (dirty) return // não atualizar automaticamente enquanto há alterações não salvas
    const t = setTimeout(()=>{
      if(page !== 1){
        setPage(1) // trocar a página dispara o load() pelo efeito acima
      } else {
        load(true)
      }
    }, 250)
    return ()=> clearTimeout(t)
  }, [query, showOnly])

  // Auto-refresh: quando a janela ganhar foco ou a aba voltar a ficar visível
  useEffect(()=>{
    function onFocus(){ load(true) }
    function onVisibility(){ if(!document.hidden) load(true) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    // SSE: ouvir mudanças do backend e atualizar instantaneamente
    const stop = api.openContactsStream({ onChange: ()=> { if(!dirty) load(true) } })
    return ()=>{
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      stop && stop()
    }
  }, [])

  // Auto-refresh periódico: atualiza a lista/contadores a cada 30s, somente quando a aba está visível
  useEffect(()=>{
    const interval = setInterval(()=>{
      if(!document.hidden && !dirty){
        load(true)
      }
    }, 30000)
    return ()=> clearInterval(interval)
  }, [])

  // Clique-fora: se houver um registro selecionado e o usuário clicar fora dos cards
  // de lista e detalhes, desfaz a seleção. Também limpa com tecla Escape.
  useEffect(()=>{
    function handleDocMouseDown(e){
      if(confirmDeleteOpen) return // não desfaz seleção enquanto o diálogo está aberto
      if(!selected) return
      const insideList = listCardRef.current?.contains(e.target)
      const insideDetails = detailsCardRef.current?.contains(e.target)
      if(!insideList && !insideDetails){
        // Ao clicar fora, apenas desfaz a seleção visual. Mantém o rascunho em `unsaved` para este id.
        setSelected(null)
        setObservacao('')
        setDirty(false)
      }
    }
    function handleKeyDown(e){
      if(confirmDeleteOpen) return // ignora ESC enquanto o diálogo está aberto
      if(!selected) return
      if(e.key === 'Escape'){
        // Mesmo comportamento no ESC: desfaz seleção mas mantém rascunho salvo em `unsaved`.
        setSelected(null)
        setObservacao('')
        setDirty(false)
      }
    }
    document.addEventListener('mousedown', handleDocMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return ()=>{
      document.removeEventListener('mousedown', handleDocMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selected, confirmDeleteOpen])

  // Ajuste visual: se o registro selecionado tiver alterações não salvas (dirty),
  // tratamos como "pendente" na UI até gravar.
  // Bump visual: considera como pendentes os registros processados que têm alteração não gravada
  const pendingBump = useMemo(()=>{
    return (data?.data||[]).reduce((acc, c)=>{
      const val = unsaved[c.id]
      const original = c.observacao || ''
      const changed = typeof val === 'string' && val !== original
      if (c.processed_at && changed) return acc + 1
      return acc
    }, 0)
  }, [data, unsaved])
  const displayPending = Math.max(0, (stats.pending || 0) + pendingBump)
  const displayProcessed = Math.max(0, (stats.processed || 0) - pendingBump)

  async function pick(id){
    const c = await getContact(id)
    setSelected(c)
    // Carrega observação não gravada (se houver) ou o valor atual salvo
    const draft = unsaved[id]
    const original = c?.observacao || ''
    // Opção B: Para usuários comuns, após primeira gravação (processed_at), exibir o texto em modo somente leitura (sem permitir editar novamente)
    if (!user?.is_admin && c?.processed_at) {
      // limpa rascunho para não marcar como pendente indevidamente
      setUnsaved(prev=>{ const p={...prev}; delete p[id]; return p })
      setObservacao(original)
      setDirty(false)
    } else {
      const value = (typeof draft === 'string') ? draft : original
      setObservacao(value)
      setDirty(value !== original)
    }
  }

  async function salvar(){
    if(!selected) return
    if ((observacao||'').trim() === (selected?.observacao||'').trim()) { setStatus('Sem alterações para gravar'); return }
    if ((observacao||'').trim() === '') { setStatus('Informe uma observação antes de gravar'); return }
    setStatus('Salvando...')
    try{
      const updated = await updateContact(selected.id, { observacao })
      setStatus('Salvo!')
      // Atualiza painel de detalhes sem perder seleção
      setSelected(prev => prev ? { ...prev, observacao: updated.observacao, processed_at: updated.processed_at } : prev)
      // Para usuário comum, limpa e trava após a primeira gravação
      if (!user?.is_admin) {
        setObservacao('')
        setDirty(false)
      } else {
        // Admin mantém edição livre
        setObservacao('')
        setDirty(false)
      }
      // Remove rascunho não gravado desse registro, já que foi salvo
      setUnsaved(prev=>{ const p={...prev}; delete p[selected.id]; return p })
  // Atualiza lista e contadores (bust para refletir imediatamente no mobile)
  await load(true)
    }catch(e){ setStatus('Erro: '+e.message) }
  }

  async function excluir(idParam){
    const id = idParam ?? selected?.id
    if(!id) return
    setStatus('Excluindo...')
    try{
      await deleteContact(id)
      setStatus('Excluído')
      // Atualização otimista da lista e das estatísticas para resposta imediata na UI
      setData(prev => {
        const list = Array.isArray(prev?.data) ? [...prev.data] : []
        const meta = prev?.meta || {}
        const idx = list.findIndex(c => c.id === id)
        if(idx === -1){ return prev }
        const removed = list[idx]
        const removedNumero = removed?.numero ?? null
        // remove item
        list.splice(idx, 1)
        // renumera localmente: decrementa quem tem numero maior
        if(removedNumero != null){
          for(let i=0;i<list.length;i++){
            const c=list[i]
            if(typeof c.numero === 'number' && c.numero > removedNumero){
              list[i] = { ...c, numero: c.numero - 1 }
            }
          }
        }
        // ajusta meta (total/last_page) de forma aproximada
        const newTotal = (meta.total || 0) - 1
        const per = meta.per_page || perPage
        const newLast = Math.max(1, Math.ceil(Math.max(0,newTotal)/Math.max(1,per)))
        const newMeta = { ...meta, total: newTotal, last_page: newLast }
        return { ...prev, data: list, meta: newMeta }
      })
      // Ajusta stats locais
      setStats(prev => {
        const list = Array.isArray(data?.data) ? data.data : []
        const removed = list.find(c => c.id === id)
        const wasProcessed = !!removed?.processed_at
        return {
          total: Math.max(0, (prev.total||0) - 1),
          processed: Math.max(0, (prev.processed||0) - (wasProcessed ? 1 : 0)),
          pending: Math.max(0, (prev.pending||0) - (wasProcessed ? 0 : 1))
        }
      })
      // Limpa seleção e rascunho, se necessário
      if(selected?.id === id) setSelected(null)
      setObservacao('')
      setDirty(false)
      setUnsaved(prev=>{ const p={...prev}; delete p[id]; return p })
  // Recarrega imediatamente para confirmar com servidor e ajustar paginação
  const loaded = await load(true)
      const curRes = loaded?.res
      // Se a página atual ficou sem itens mas há páginas anteriores, volta uma página (o efeito de page recarrega depois)
      const hasItems = Array.isArray(curRes?.data) ? curRes.data.length > 0 : false
      const lastPage = curRes?.meta?.last_page || 1
      const currentPage = curRes?.meta?.current_page || page
      if(!hasItems && currentPage > 1){
        setPage(currentPage - 1)
      }
    }catch(e){ setStatus('Erro: '+e.message) }
  }

  return (
    <>
      {/* Header full-width e responsivo (MUI) */}
      <AppBar position="static" color="default" enableColorOnDark sx={{ bgcolor: 'background.paper', borderBottom: theme => `1px solid ${theme.palette.divider}` }}>
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
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Módulo de Movimentação
              </Typography>
              <Typography variant="caption" color="text.secondary">Gerenciamento de Registros</Typography>
            </Box>
          </Box>
          {/* Ações: visíveis em sm+ (tablet/desktop). Em mobile, vão para o menu (Drawer). */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.25 }}>
            <Chip
              size="small"
              variant="filled"
              icon={<Box sx={{ width: 8, height: 8, bgcolor: 'success.main', borderRadius: '50%' }} />}
              label="Sistema Online"
              sx={(t)=>({
                bgcolor: alpha(t.palette.success.main, 0.12),
                color: t.palette.success.main,
                '& .MuiChip-icon': { color: t.palette.success.main },
                fontWeight: 500,
                borderRadius: 1.5,
              })}
            />
            {displayName && (
              <Chip size="small" label={displayName} sx={(t)=>({
                bgcolor: t.palette.mode==='dark' ? alpha(t.palette.grey[700], .25) : alpha(t.palette.grey[200], .7),
                borderRadius: 1.5,
                fontWeight: 600
              })} />
            )}
            <Tooltip title={mode === 'dark' ? 'Tema: Escuro (clique para Claro)' : 'Tema: Claro (clique para Escuro)'}>
              <IconButton color="inherit" onClick={toggle} aria-label="Alternar tema" sx={{
                borderRadius: 2,
                transition: 'all .2s ease',
                '&:hover': { bgcolor: (t)=> alpha(t.palette.text.primary, 0.06), transform: 'translateY(-1px)' }
              }}>
                {mode === 'dark' ? <LightModeIcon fontSize="small"/> : <DarkModeIcon fontSize="small"/>}
              </IconButton>
            </Tooltip>
            {user?.is_admin && (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Admin</Typography>
            )}
            {user?.is_admin && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<PeopleIcon />}
                component={RouterLink}
                to="/admin/usuarios"
                sx={(t)=>({
                  textTransform: 'uppercase',
                  letterSpacing: '.35px',
                  borderRadius: 2,
                  borderColor: alpha(t.palette.primary.main, 0.4),
                  color: t.palette.primary.main,
                  fontWeight: 700,
                  '&:hover': { borderColor: t.palette.primary.main, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }
                })}
              >
                Usuários
              </Button>
            )}
            <Divider orientation="vertical" flexItem sx={{ mx: .5, opacity: .4 }} />
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
          </Box>
          {/* Botão de menu - apenas mobile */}
          <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
            <IconButton aria-label="Abrir menu" onClick={()=> setMobileMenuOpen(true)}>
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      {/* barra de ações removida conforme solicitado */}
  {/* Drawer (menu slider) - somente mobile */}
      <Drawer anchor="right" open={mobileMenuOpen} onClose={()=> setMobileMenuOpen(false)} sx={{ display: { xs: 'block', sm: 'none' } }}>
        <Box sx={{ width: 300 }} role="presentation" onKeyDown={(e)=>{ if(e.key==='Escape') setMobileMenuOpen(false) }}>
          <Box sx={{ p: 2, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Menu</Typography>
            <Chip size="small" label="Sistema Online" color="success" variant="outlined" />
          </Box>
          <Divider />
          <List>
            <ListItemButton onClick={()=>{ toggle(); }}>
              <ListItemIcon>{mode==='dark' ? <LightModeIcon/> : <DarkModeIcon/>}</ListItemIcon>
              <ListItemText primary={`Tema: ${mode==='dark' ? 'Escuro' : 'Claro'}`} />
              <Switch edge="end" checked={mode==='dark'} onChange={toggle} />
            </ListItemButton>
            {user?.is_admin && (
              <ListItemButton component={RouterLink} to="/importacao" onClick={()=> setMobileMenuOpen(false)}>
                <ListItemIcon><UploadIcon/></ListItemIcon>
                <ListItemText primary="Importar" />
              </ListItemButton>
            )}
            {user?.is_admin && (
              <ListItemButton component={RouterLink} to="/admin/usuarios" onClick={()=> setMobileMenuOpen(false)}>
                <ListItemIcon><PeopleIcon/></ListItemIcon>
                <ListItemText primary="Usuários" />
              </ListItemButton>
            )}
            {user && (
              <ListItemButton onClick={()=>{ setMobileMenuOpen(false); logout(); }}>
                <ListItemIcon><LogoutIcon/></ListItemIcon>
                <ListItemText primary="Sair" />
              </ListItemButton>
            )}
          </List>
        </Box>
      </Drawer>
      {/* estado vazio personalizado removido conforme solicitado */}
  {/* Removido o espaço para grudar body no header */}

      {/* Conteúdo - seção full-width com respiro lateral e fundo offwhite */}
      <Box sx={{
        width: '100%',
        bgcolor: (t)=> t.palette.mode==='light' ? '#f7f9fb' : alpha('#ffffff', 0.03),
        py: { xs: 2, sm: 3 },
        minHeight: 'calc(100dvh - 72px)'
      }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 } }}>
        {scriptText && (
          <Box className="card" sx={{ mb: 2 }}>
            <Alert severity="info">
              <AlertTitle>Aviso da Administração</AlertTitle>
              <div style={{ whiteSpace:'pre-wrap' }}>{scriptText}</div>
            </Alert>
          </Box>
        )}
        {/* alerta de erro removido por solicitação do cliente; falhas ficam silenciosas */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: { xs: 2, sm: 2.5 }
        }}>
          {/* Coluna esquerda */}
          <div className="card" ref={listCardRef} style={{display:'flex',flexDirection:'column',gap:12, minWidth:0, minHeight:0}}>
            {/* Linha 1: Título + Chips de contagem */}
            <Box sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 0 }
            }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Lista de Registros</Typography>
              {user?.is_admin && (
                <Box sx={{
                  display: 'flex',
                  gap: 1,
                  flexWrap: 'wrap',
                  mt: { xs: 1, sm: 0 },
                  justifyContent: { xs: 'flex-start', sm: 'flex-end' }
                }}>
                  <Chip
                    size="small"
                    label={`${stats.total} registros`}
                    sx={(t)=>({
                      bgcolor: t.palette.mode==='dark' ? alpha(t.palette.primary.light, .18) : alpha(t.palette.primary.main, .12),
                      color: t.palette.primary.main,
                      fontWeight: 600,
                      borderRadius: 2
                    })}
                  />
                  <Chip
                    size="small"
                    label={`${displayPending} pendentes`}
                    sx={(t)=>({
                      bgcolor: t.palette.mode==='dark' ? alpha(t.palette.error.light, .18) : alpha(t.palette.error.main, .12),
                      color: t.palette.error.main,
                      fontWeight: 600,
                      borderRadius: 2
                    })}
                  />
                  <Chip
                    size="small"
                    label={`${displayProcessed} processados`}
                    sx={(t)=>({
                      bgcolor: t.palette.mode==='dark' ? alpha(t.palette.success.light, .2) : alpha(t.palette.success.main, .18),
                      color: t.palette.success.dark,
                      fontWeight: 600,
                      borderRadius: 2
                    })}
                  />
                </Box>
              )}
            </Box>

            {/* Linha 2: Busca arredondada + botão filtro azul + Importar verde (responsivo) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="medium"
                placeholder="Buscar registros..."
                value={query}
                onChange={e=>setQuery(e.target.value)}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 999,
                    bgcolor: (t)=> t.palette.mode==='dark' ? alpha(t.palette.common.white, .04) : t.palette.common.white,
                    height: 48
                  },
                  // Reduz a largura em telas médias, mas cresce em telas menores
                  flex: { xs: '1 1 100%', sm: '1 1 65%', md: '1 1 60%' },
                  maxWidth: { xs: '100%', md: 560 }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  )
                }}
              />


              {user?.is_admin && (
                <>
                  <IconButton
                    aria-label="Filtrar"
                    onClick={(e)=>setFilterAnchor(e.currentTarget)}
                    sx={(t)=>({
                      width: 48,
                      height: 48,
                      borderRadius: 1.75,
                      bgcolor: t.palette.primary.main,
                      color: t.palette.primary.contrastText,
                      boxShadow: t.shadows[1],
                      '&:hover': { bgcolor: t.palette.primary.dark, boxShadow: t.shadows[2] }
                    })}
                  >
                    <FilterListIcon />
                  </IconButton>
                  <Menu anchorEl={filterAnchor} open={Boolean(filterAnchor)} onClose={()=>setFilterAnchor(null)}>
                    <MenuItem selected={showOnly==='all'} onClick={()=>{ setShowOnly('all'); setFilterAnchor(null) }}>Todos</MenuItem>
                    <MenuItem selected={showOnly==='pending'} onClick={()=>{ setShowOnly('pending'); setFilterAnchor(null) }}>Pendentes</MenuItem>
                    <MenuItem selected={showOnly==='processed'} onClick={()=>{ setShowOnly('processed'); setFilterAnchor(null) }}>Processados</MenuItem>
                  </Menu>
                </>
              )}

              {user?.is_admin && (
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<UploadIcon />}
                component={RouterLink}
                to="/importacao"
                sx={{
                  height: 48,
                  px: 2.25,
                  fontWeight: 800,
                  letterSpacing: .2,
                  borderRadius: 2,
                  textTransform: 'none',
                  boxShadow: (t)=> t.shadows[1],
                  '&:hover': { boxShadow: (t)=> t.shadows[2] }
                }}
              >
                Importar
              </Button>
              )}
            </Box>
            <ul
              ref={listRef}
              className="list"
              style={{
                // rolagem ativa a partir do 10º item
                maxHeight: listMaxHeight || undefined,
                overflowY: 'auto',
                overflowX: 'hidden'
              }}
            >
              {data.data
                .filter(c=>{
                  // Determina status processado/pendente considerando texto não gravado
                  let isProcessed = !!c.processed_at
                  const draft = unsaved[c.id]
                  const changed = typeof draft === 'string' && draft !== (c.observacao || '')
                  if (changed) isProcessed = false
                  if (selected?.id === c.id && dirty) isProcessed = false
                  if(showOnly==='pending' && isProcessed) return false
                  if(showOnly==='processed' && !isProcessed) return false
                  if(!query) return true
                  const q=query.toLowerCase()
                  return [c.nome,c.email,c.empresa,c.telefone,c.nif].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))
                })
                .map((c)=>{
                  let isProcessed = !!c.processed_at
                  const draft = unsaved[c.id]
                  const changed = typeof draft === 'string' && draft !== (c.observacao || '')
                  if (changed) isProcessed = false
                  // Se for o selecionado e houver alterações não salvas, mostrar como pendente
                  if (selected?.id === c.id && dirty) isProcessed = false
                  return (
                    <li
                      key={c.id}
                      className={`list-item ${isProcessed?'processed':'pending'} ${selected?.id===c.id ? 'active' : ''}`}
                      onClick={()=>pick(c.id)}
                      tabIndex={0}
                      onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pick(c.id) } }}
                    >
                      <div>
                        <div style={{fontWeight:700}}>{c.nome}</div>
                        <div className="muted" style={{fontSize:'.85rem'}}>{c.email}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div className="muted" style={{fontSize:'.8rem'}}>{`#${(c.numero ?? c.id)?.toString().padStart(3,'0')}`}</div>
                        {isProcessed ? (
                          <span className="badge badge-success">Processado</span>
                        ) : (
                          <span className="badge badge-danger">Pendente</span>
                        )}
                      </div>
                    </li>
                  )
                })}
            </ul>
            {/* Paginação da LISTA (dentro do card) centralizada, sem texto "Página X de Y" */}
            <Box className="flex items-center" sx={{ mt: 1, gap: 1, flexWrap: 'wrap', alignItems:'center', justifyContent:'center' }}>
              <Box className="flex" sx={{ gap: 1, alignItems:'center', justifyContent:'center', flexWrap:'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={()=> setPage(p => (p > 1 ? p - 1 : p))}
                  aria-disabled={(data.meta?.current_page || page) <= 1}
                  disabled={(data.meta?.current_page || page) <= 1}
                  sx={(t)=> ({ borderRadius: 1.5, minWidth: 36, fontWeight: 800, borderColor: t.palette.divider, color: t.palette.text.primary })}
                >Anterior</Button>
                {Array.from({ length: lastPage || 1 }, (_, i) => i + 1).map(n => (
                  <Button
                    key={n}
                    size="small"
                    variant={(data.meta?.current_page || page) === n ? 'contained' : 'outlined'}
                    aria-current={(data.meta?.current_page || page) === n ? 'page' : undefined}
                    onClick={()=> setPage(n)}
                    sx={(t)=>(
                      (data.meta?.current_page || page) === n
                        ? { bgcolor: t.palette.mode==='dark' ? t.palette.grey[900] : t.palette.grey[900], color: t.palette.primary.contrastText, borderRadius: 1.5, minWidth: 36, fontWeight: 800 }
                        : { borderColor: t.palette.divider, color: t.palette.text.primary, borderRadius: 1.5, minWidth: 36, fontWeight: 800 }
                    )}
                  >{n}</Button>
                ))}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={()=> setPage(p => (p < (lastPage || 1) ? p + 1 : p))}
                  aria-disabled={(data.meta?.current_page || page) >= (lastPage || 1)}
                  disabled={(data.meta?.current_page || page) >= (lastPage || 1)}
                  sx={(t)=> ({ borderRadius: 1.5, minWidth: 36, fontWeight: 800, borderColor: t.palette.divider, color: t.palette.text.primary })}
                >Próxima</Button>
              </Box>
            </Box>
          </div>

          {/* Coluna direita */}
          <div className="card" ref={detailsCardRef} style={{display:'flex',flexDirection:'column',gap:12, minWidth:0, paddingInline:'clamp(12px, 3vw, 16px)'}}>
            <div className="flex items-center justify-between">
              <h3 className="card-title" style={{marginTop:0}}>Detalhes do Contato</h3>
              {selected && (
                <div className="flex items-center gap-2">
                  {(!selected.processed_at || ((typeof unsaved[selected.id] === 'string') && unsaved[selected.id] !== (selected.observacao || '')) || dirty) ? (
                    <span className="badge badge-danger">Pendente</span>
                  ) : (
                    <span className="badge badge-success">Processado</span>
                  )}
                  <span className="muted" style={{fontSize:'.85rem'}}>{`#${(selected.numero ?? selected.id)?.toString().padStart(3,'0')}`}</span>
                </div>
              )}
            </div>
            {selected ? (
              <div className="space-y-3">
                {(!user?.is_admin && selected?.processed_at) && (
                  <Alert severity="info">Este registro já teve a observação gravada. Usuários comuns não podem editar novamente.</Alert>
                )}
                <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'1fr 1fr' }, gap: 1.25 }}>
                  <Box sx={{ minWidth:0 }}>
                    <label className="label">Nome Completo</label>
                    <div className="field readonly" style={{ overflowWrap:'anywhere', wordBreak:'break-word' }}>{selected.nome}</div>
                  </Box>
                  <Box sx={{ minWidth:0 }}>
                    <label className="label">Empresa</label>
                    <div className="field readonly" style={{ overflowWrap:'anywhere', wordBreak:'break-word' }}>{selected.empresa}</div>
                  </Box>
                  <Box sx={{ minWidth:0 }}>
                    <label className="label">Email</label>
                    <div className="field readonly" style={{ overflowWrap:'anywhere', wordBreak:'break-word' }}>{selected.email}</div>
                  </Box>
                  <Box sx={{ minWidth:0 }}>
                    <label className="label">NIF</label>
                    <div className="field readonly" style={{ overflowWrap:'anywhere', wordBreak:'break-word' }}>{selected.nif || '—'}</div>
                  </Box>
                  <Box sx={{ minWidth:0 }}>
                    <label className="label">Telemóvel</label>
                    <div className="field readonly" style={{ overflowWrap:'anywhere', wordBreak:'break-word' }}>{String(selected.telefone ?? '').replace(/\s+/g,'')}</div>
                  </Box>
                  <Box sx={{ minWidth:0 }}>
                    <label className="label">Data de Criação</label>
                    <div className="field readonly" style={{ overflowWrap:'anywhere', wordBreak:'break-word' }}>{selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'}</div>
                  </Box>
                </Box>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="label" style={{ marginBottom: 0 }}>Informações Adicionais</label>
                    {user?.is_admin && (
                      <Button size="small" variant="outlined" onClick={()=>{
                        const draft = unsaved[selected.id]
                        setObservacao(typeof draft === 'string' ? draft : (selected.observacao || ''))
                        // Ao entrar em edição, ainda não há alteração: dirty = false
                        setDirty(false)
                        setTimeout(()=> obsRef.current?.focus(), 0)
                      }}>Editar</Button>
                    )}
                  </div>
                  <div className="field readonly" style={{ marginTop: 6 }}>
                    {selected.observacao || '—'}
                  </div>
                </div>

                <div>
                  <label className="label">Observação do Processamento</label>
                  <textarea
                    ref={obsRef}
                    className="textarea"
                    value={observacao}
                    onChange={e=>{
                      const value = e.target.value
                      setObservacao(value)
                      const original = selected?.observacao || ''
                      // Marca como pendente apenas quando diferente do valor original salvo
                      setDirty(value !== original)
                      // Guarda rascunho por id para persistir ao sair da seleção
                      if(selected?.id){
                        setUnsaved(prev=> ({ ...prev, [selected.id]: value }))
                      }
                    }}
                    disabled={!user?.is_admin && !!selected?.processed_at}
                    rows={6}
                    placeholder={!user?.is_admin && !!selected?.processed_at
                      ? 'Observação gravada (somente leitura para usuários comuns).'
                      : 'Digite suas observações sobre o processamento deste registro...'}
                  />
                  {dirty && (
                    <div className="muted" style={{ color: 'var(--danger)', marginTop: 6 }}>Pendente: você alterou a observação e precisa gravar.</div>
                  )}
                </div>

                <Box className="flex items-center gap-3" sx={{
                  justifyContent: { xs: 'stretch', sm: 'flex-end' },
                  flexWrap: 'wrap',
                  gap: 1.25
                }}>
                  <Button
                    variant="outlined"
                    onClick={()=>{ setSelected(null); setObservacao(''); setDirty(false) }}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >Cancelar</Button>
                  <Button
                    variant="contained"
                    onClick={salvar}
                    disabled={(!dirty || (observacao.trim() === (selected?.observacao||'').trim()) || observacao.trim() === '') || (!user?.is_admin && !!selected?.processed_at)}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >Gravar Registro</Button>
                  {user?.is_admin && (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={()=> {
                        setDeleteTargetId(selected?.id ?? null)
                        setDeleteTargetNumero(selected ? (selected.numero ?? selected.id) : null)
                        setConfirmDeleteOpen(true)
                      }}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >Excluir</Button>
                  )}
                  {status && <span className="muted">{status}</span>}
                </Box>
              </div>
            ) : (
              <div className="muted">Selecione um registro à esquerda para ver os detalhes.</div>
            )}
          </div>
        </Box>
        {/* Dialogo de confirmação de exclusão */}
        <Dialog open={confirmDeleteOpen} onClose={()=> setConfirmDeleteOpen(false)}>
          <DialogTitle>Confirmar exclusão</DialogTitle>
          <DialogContent>
            {(() => {
              const id = deleteTargetId ?? selected?.id
              // prioridade: numero capturado na abertura do diálogo; se não existir, tenta o numero do selecionado
              let num = deleteTargetNumero ?? (selected && selected.id === id ? (selected.numero ?? selected.id) : null)
              if (num == null && id != null) {
                const item = (data?.data || []).find(c => c.id === id)
                if (item) num = item.numero ?? item.id
              }
              const label = num != null ? `#${String(num).padStart(3,'0')}` : (id != null ? `#${String(id).padStart(3,'0')}` : '')
              return (
                <>
                  Tem certeza que deseja excluir o registro {label}? Esta ação não pode ser desfeita.
                </>
              )
            })()}
          </DialogContent>
          <DialogActions>
            <Button onClick={()=> setConfirmDeleteOpen(false)}>Cancelar</Button>
            <Button color="error" variant="contained" onClick={async ()=>{
              const id = deleteTargetId ?? selected?.id
              setConfirmDeleteOpen(false)
              await excluir(id)
              setDeleteTargetId(null)
              setDeleteTargetNumero(null)
            }}>Excluir</Button>
          </DialogActions>
        </Dialog>
        {/* Removido: paginação global; controles movidos para dentro do card da lista */}
        </Container>
      </Box>

      {/* Footer compacto com mesma cor do header e conteúdo centralizado */}
      <Box sx={{ width: '100%', bgcolor: (t)=> t.palette.mode==='dark' ? t.palette.background.paper : '#FFFFFF', borderTop: (t)=> `1px solid ${t.palette.divider}` }}>
        <Container maxWidth={false} sx={{ maxWidth: '1680px', mx: 'auto', px: { xs: 1.5, sm: 2, md: 2.5 } }}>
          <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', py: 1.25, minHeight: 56, textAlign:'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, color: (t)=> t.palette.text.secondary }}>© 2025 Sistema Sol-Online • Módulo de Movimentação • Versão 1.0</Typography>
            {user?.is_admin && (
              <Box sx={{ display:'flex', gap: 1, alignItems:'center', justifyContent:'center', mt: .75, '& .MuiChip-label': { fontWeight: 500 } }}>
                <Chip size="medium" label={`${stats.total} registros`} color="primary" variant="outlined" />
                <Chip size="medium" label={`${displayPending} pendentes`} color="error" variant="outlined" />
                <Chip size="medium" label={`${displayProcessed} processados`} color="success" variant="outlined" />
              </Box>
            )}
          </Box>
        </Container>
      </Box>
    </>
  )
}
