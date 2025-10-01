import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApi, useAuth } from '../services/api.jsx'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
// Removido import estático de xlsx para permitir code-splitting via importação dinâmica
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Alert,
  AlertTitle,
  Chip,
  Tooltip,
  Divider,
  Container,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormHelperText
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  LightModeOutlined as LightModeIcon,
  DarkModeOutlined as DarkModeIcon,
  LogoutOutlined as LogoutIcon,
  PeopleOutline as PeopleIcon,
  CloudUploadOutlined as CloudUploadIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon
} from '@mui/icons-material'
import { useThemeMode } from '../theme/ThemeModeContext.jsx'

export default function Importacao(){
  const { user, logout } = useAuth()
  const { importCsv, importCsvWithProgress, getScript, saveScript } = useApi()
  const { mode, toggle } = useThemeMode()
  const navigate = useNavigate()

  const [file, setFile] = useState(null)
  const [alertBanner, setAlertBanner] = useState(null) // { type: 'success'|'error'|'info'|'warning', text: string }
  const fileInputRef = useRef(null)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({ empresa: '', nome: '', telefone: '', email: '', nif: '' })
  const [stats, setStats] = useState({ total: 0, valid: 0, error: 0, comNif: 0, semNif: 0, successRate: 0 })
  const [previewNote, setPreviewNote] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [uploadStage, setUploadStage] = useState('')
  const [uploadPercent, setUploadPercent] = useState(0)
  const [importing, setImporting] = useState(false)
  const [sheets, setSheets] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [excelArrayBuffer, setExcelArrayBuffer] = useState(null)
  const [fileType, setFileType] = useState('') // 'csv' | 'xls' | 'xlsx'
  const [accepted, setAccepted] = useState(false)
  // Fluxo de validação removido a pedido
    // Validação removida a pedido: importação não exige validação
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scriptText, setScriptText] = useState('')
  const [savingScript, setSavingScript] = useState(false)
  // Não exibiremos erro de carregamento em separado para evitar alerta duplicado
  const [scriptAlert, setScriptAlert] = useState(null)

  // Guard: apenas admin pode acessar importação
  useEffect(()=>{
    if (user && !user.is_admin) {
      navigate('/movimentacao', { replace: true })
    }
  }, [user])

  useEffect(()=>{
    let cancelled = false
    async function loadScript(){
      try{
        const data = await getScript()
        if(!cancelled){ setScriptText(String(data?.script || '')) }
      } catch(err) {
        // silencia erro de carregamento (trataremos como script vazio)
        if(!cancelled){ setScriptText(s=> s) }
      }
    }
    if(user?.is_admin){ loadScript() }
    return ()=>{ cancelled = true }
  }, [user])

  // refs/estado para igualar a altura dos cards (Instruções igual ao de Campos Obrigatórios)
  const requiredRef = useRef(null)
  const [requiredCardHeight, setRequiredCardHeight] = useState(null)
  useEffect(()=>{
    const measure = ()=>{
      if(requiredRef.current){
        const h = requiredRef.current.offsetHeight
        setRequiredCardHeight(h)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return ()=> window.removeEventListener('resize', measure)
  }, [headers, mapping, stats])

  // CSV helpers: detecção de delimitador e parser com aspas
  const csvParseLine = (line, delimiter=',') => {
    const out = []
    let cur = ''
    let inQuotes = false
    for(let i=0;i<line.length;i++){
      const ch = line[i]
      if(ch === '"'){
        if(inQuotes && line[i+1] === '"') { cur += '"'; i++; continue }
        inQuotes = !inQuotes
        continue
      }
      if(ch === delimiter && !inQuotes){ out.push(cur.trim()); cur=''; continue }
      cur += ch
    }
    out.push(cur.trim())
    return out
  }
  const detectDelimiter = (headerLine) => {
    const candidates = [',',';','\t']
    let best = ','
    let bestLen = 1
    for(const d of candidates){
      const len = csvParseLine(headerLine, d).length
      if(len > bestLen){ bestLen = len; best = d }
    }
    return best
  }

  // Helpers para mapeamento automático a partir dos cabeçalhos
  const normalize = (s='') => s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '')

  const guessMappingFromHeaders = (cols=[]) => {
    const used = new Set()
    const pick = (patterns) => {
      // 1) match exato normalizado
      for(const c of cols){
        const n = normalize(c)
        if(patterns.includes(n) && !used.has(c)) { used.add(c); return c }
      }
      // 2) match por inclusão
      for(const c of cols){
        const n = normalize(c)
        if(patterns.some(p => n.includes(p)) && !used.has(c)) { used.add(c); return c }
      }
      return ''
    }

    const empresa = pick(['empresa','company','companhia','organizacao','organizacaoempresa','clienteempresa','cliente','denominacaosocial','nomeempresa'])
    const nome = pick(['nome','name','nomecompleto','fullname','contacto','contato','responsavel','responsavelnome','pessoa'])
    const telefone = pick(['telemovel','telefone','phone','celular','whatsapp','whats','fone','mobile','contacto','contatophone'])
    const email = pick(['email','e-mail','mail','correio','emailaddress'])
    const nif = pick(['nif','numcontribuinte','contribuinte','taxid','tax','vat','vatnumber','numerofiscal','nrfiscal','inscricao','numerocontribuinte'])

    return { empresa, nome, telefone, email, nif }
  }

  async function handleSelectFile(f){
  setFile(f)
  setAlertBanner(null)
    setPreviewNote('')
    setHeaders([])
    setRows([])
    setSheets([])
    setSelectedSheet('')
    setExcelArrayBuffer(null)
    setFileType('')
  // limpeza de estados antigos (validação removida)
    // limpeza de estados de validação removidos
  if(!f) return
    const name = f.name?.toLowerCase() || ''
    if(name.endsWith('.csv')){
      setFileType('csv')
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result || '')
        const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0)
        if(lines.length){
          const delimiter = detectDelimiter(lines[0])
          const parseLine = (line)=> csvParseLine(line, delimiter).map(c=> c.replace(/^\"|\"$/g,'').trim())
          const cols = parseLine(lines[0])
          setHeaders(cols)
          // aplicar mapeamento automático
          const autoMap = guessMappingFromHeaders(cols)
          setMapping(autoMap)
          const data = lines.slice(1).map(l=>{
            const vals = parseLine(l)
            const obj = {}
            cols.forEach((c,i)=>{ obj[c] = vals[i] ?? '' })
            return obj
          })
          setRows(data)
          setAccepted(false)
          // validação não utilizada
            // validação não utilizada
          setPreviewOpen(true)
        }
      }
      reader.readAsText(f)
    } else if(name.endsWith('.xls') || name.endsWith('.xlsx')){
      setFileType(name.endsWith('.xlsx') ? 'xlsx' : 'xls')
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result
          setExcelArrayBuffer(arrayBuffer)
          // importar xlsx dinamicamente apenas quando necessário
          const XLSX = await import('xlsx')
          const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
          const sheetNames = wb.SheetNames || []
          setSheets(sheetNames)
          const firstSheetName = sheetNames[0]
          setSelectedSheet(firstSheetName)
          const ws = wb.Sheets[firstSheetName]
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
          if (aoa && aoa.length > 0) {
            const cols = (aoa[0] || []).map(v=> String(v))
            setHeaders(cols)
            const autoMap = guessMappingFromHeaders(cols)
            setMapping(autoMap)
            const maxRows = 200
            const dataRows = aoa.slice(1, 1 + maxRows).map(rowArr => {
              const obj = {}
              cols.forEach((c,i)=>{ obj[c] = rowArr[i] ?? '' })
              return obj
            })
            setRows(dataRows)
            setAccepted(false)
            // validação não utilizada
              // validação não utilizada
            setPreviewOpen(true)
          }
        } catch (err) {
          console.error(err)
          setPreviewNote('Não foi possível ler a prévia do Excel. Você ainda pode importar normalmente no servidor.')
          setMapping({ empresa: '', nome: '', telefone: '', email: '', nif: '' })
          setAccepted(false)
          // validação não utilizada
            // validação não utilizada
          setPreviewOpen(true)
        }
      }
      reader.readAsArrayBuffer(f)
    }
  }

  async function loadSheetPreview(sheetName){
    if(!excelArrayBuffer || !sheetName) return
    try{
      const XLSX = await import('xlsx')
      const wb = XLSX.read(new Uint8Array(excelArrayBuffer), { type: 'array' })
      const ws = wb.Sheets[sheetName]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
      if(aoa && aoa.length>0){
        const cols = (aoa[0] || []).map(v=> String(v))
        setHeaders(cols)
        // mantém mapping atual se válido, senão tenta remapear
        const keysSel = Object.values(mapping).filter(Boolean)
        const stillValid = keysSel.every(k=> cols.includes(k))
        if(!stillValid){
          const autoMap = guessMappingFromHeaders(cols)
          setMapping(autoMap)
        }
        const maxRows = 200
        const dataRows = aoa.slice(1, 1 + maxRows).map(rowArr => {
          const obj = {}
          cols.forEach((c,i)=>{ obj[c] = rowArr[i] ?? '' })
          return obj
        })
        setRows(dataRows)
      } else {
        setHeaders([]); setRows([])
      }
    }catch(err){
      console.error(err)
      setPreviewNote('Falha ao carregar a planilha selecionada para prévia.')
    }
  }

  function onDrop(e){
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if(f) handleSelectFile(f)
  }

  function prevent(e){ e.preventDefault() }

  // Removido canValidate; seguimos apenas com headers detectados

  // Atualiza estatísticas automaticamente quando possível (após aceitar arquivo e com mapeamento pronto)
  useEffect(()=>{
    const total = rows.length
    // total sempre reflete as linhas detectadas
    // demais métricas só são recalculadas automaticamente quando arquivo foi aceito
    if (!accepted || total === 0) {
      setStats(s=> ({ ...s, total }))
      return
    }
    let valid=0, error=0, comNif=0, semNif=0
    const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
    rows.forEach(r=>{
      const empresa = r[mapping.empresa]||''
      const nome = r[mapping.nome]||''
      const telefone = r[mapping.telefone]||''
      const email = r[mapping.email]||''
      const nif = mapping.nif ? (r[mapping.nif]||'') : ''
      if(nif) comNif++; else semNif++
  // Novo critério: nenhum campo é obrigatório. Só marcamos erro se houver formato inválido
  // (e-mail presente porém inválido, ou NIF presente porém inválido). Caso contrário é válido.
  let issues = 0
  if (String(email).trim() && !emailRe.test(email)) issues++
  if (String(nif).trim() && !isValidNif(nif)) issues++
  if(issues>0) error++; else valid++
    })
    const successRate = total? Math.round((valid/total)*100):0
    setStats({ total, valid, error, comNif, semNif, successRate })
  }, [rows, mapping, accepted])

  // Validação explícita removida

  // NIF PT: 9 dígitos, último é dígito verificador
  function isValidNif(n){
    const s = String(n||'').replace(/\D/g,'')
    if(s.length !== 9) return false
    const d = s.split('').map(Number)
    const sum = d[0]*9 + d[1]*8 + d[2]*7 + d[3]*6 + d[4]*5 + d[5]*4 + d[6]*3 + d[7]*2
    let check = 11 - (sum % 11)
    if(check >= 10) check = 0
    return d[8] === check
  }
  // Funções de validação removidas

  async function onImport(e){
    e?.preventDefault?.()
  setAlertBanner(null)
    if(!file) return
    setImporting(true)
    setUploadStage('upload')
    setUploadPercent(0)
    try{
      const res = await importCsvWithProgress(file, mapping, ({stage, percent})=>{
        if(stage) setUploadStage(stage)
        if(typeof percent === 'number') setUploadPercent(percent)
      })
  setAlertBanner({ type: 'success', text: `Importado: ${res.created || 0} criados${res.updated? `, ${res.updated} atualizados`: ''}. Novos registros entram como PENDENTES até que você grave alguma observação.` })
      // limpeza do estado e redirecionamento para Movimentação
      setFile(null)
      setHeaders([])
      setRows([])
      setMapping({ empresa: '', nome: '', telefone: '', email: '', nif: '' })
      setStats({ total: 0, valid: 0, error: 0, comNif: 0, semNif: 0, successRate: 0 })
      setPreviewNote('')
      setSheets([]); setSelectedSheet(''); setExcelArrayBuffer(null); setFileType('')
  setAccepted(false)
      setImporting(false); setUploadStage(''); setUploadPercent(0)
  navigate('/movimentacao')
    }catch(err){
      setImporting(false)
      setUploadStage('')
      setUploadPercent(0)
  setAlertBanner({ type: 'error', text: err.message || 'Falha ao importar' })
    }
  }

  // Importação em background removida a pedido: mantendo apenas importação direta com progresso do upload

  // Handler de validação removido

  function handleImportClick(e){
    if(!file || !accepted) return
    onImport(e)
  }

  return (
    <>
      {/* Header full-width com ações e toggle de tema */}
      <AppBar position="static" color="default" enableColorOnDark sx={{ bgcolor: 'background.paper', borderBottom: t => `1px solid ${t.palette.divider}` }}>
        <Toolbar sx={{ gap: 2, minHeight: 72 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
            <Button
              component={RouterLink}
              to="/movimentacao"
              startIcon={<ArrowBackIcon />}
              variant="text"
              color="inherit"
              size="small"
              sx={{ mr: 1, fontWeight: 700 }}
            >
              Voltar
            </Button>
            <Box className="app-brand" aria-hidden sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'primary.contrastText', bgcolor: 'primary.main', borderRadius: 1.2 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <ellipse cx="12" cy="5" rx="8" ry="3" fill="currentColor"/>
                <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" fill="currentColor" opacity=".9"/>
                <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" fill="currentColor" opacity=".8"/>
              </svg>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Importação de Dados
              </Typography>
              <Typography variant="caption" color="text.secondary">CSV, XLS, XLSX</Typography>
            </Box>
          </Box>
          {/* Ações: visíveis em sm+; no mobile, vão para o Drawer */}
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
            <ListItemButton component={RouterLink} to="/movimentacao" onClick={()=> setMobileMenuOpen(false)}>
              <ListItemIcon><ArrowBackIcon/></ListItemIcon>
              <ListItemText primary="Movimentação" />
            </ListItemButton>
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

      {/* Corpo encostando no header, com duas colunas como no mock */}
      <Box sx={{
        width: '100%',
        bgcolor: (t)=> t.palette.mode==='light' ? '#f7f9fb' : alpha('#ffffff', 0.03),
        pt: { xs: 2, sm: 3 },
        pb: { xs: .5, sm: 1 },
        minHeight: 'calc(100dvh - 72px)'
      }}>
  <Container maxWidth={false} sx={{ maxWidth: '1680px', mx: 'auto', px: { xs: 1.5, sm: 2, md: 2.5 } }}>
          {/* Carregar Arquivo em largura total (fora das colunas) */}
          <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: .5, textAlign: 'center' }}>Carregar Arquivo</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              Faça upload de arquivos XLS ou CSV com os dados dos contatos
            </Typography>
            <Box
              onDragOver={prevent}
              onDragEnter={prevent}
              onDrop={onDrop}
              onClick={()=>fileInputRef.current?.click()}
              sx={(t)=>(
                {
                  border: `2px dashed ${alpha(t.palette.text.primary, .2)}`,
                  borderRadius: 2,
                  p: { xs: 4, sm: 5 },
                  textAlign: 'center',
                  bgcolor: t.palette.mode==='dark' ? alpha('#ffffff', 0.03) : '#fafbff',
                  cursor: 'pointer',
                  minHeight: { xs: 180, sm: 300 },
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              )}
            >
              <CloudUploadIcon sx={{ fontSize: { xs: 40, sm: 48 }, color: 'primary.main' }} />
              <Typography sx={{ fontWeight: 700, mt: 1 }}>Arraste e solte seu arquivo aqui</Typography>
              <Typography variant="body2" color="text.secondary">ou clique para selecionar um arquivo</Typography>
              <Box sx={{ mt: 1.5, display:'flex', gap: 1, justifyContent:'center', alignItems:'center', flexWrap:'wrap' }}>
                <Chip label="CSV" size="small" color="success" variant="outlined" />
                <Chip label="XLS" size="small" color="primary" variant="outlined" />
                <Chip label="XLSX" size="small" color="info" variant="outlined" />
                <Typography variant="caption" color="text.secondary">Tamanho máximo: 100 MB</Typography>
              </Box>
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={e=>handleSelectFile(e.target.files?.[0]||null)}
              style={{ display: 'none' }}
            />
            {file && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Arquivo selecionado: <strong>{file.name}</strong>
              </Typography>
            )}
            {previewNote && (
              <Alert severity="info" sx={{ mt: 1 }}>{previewNote}</Alert>
            )}
          </Paper>

          {/* Grade com duas colunas abaixo do upload full-width */}
          <Grid container spacing={0}>
            {/* Coluna esquerda: Mapeamento + Prévia */}
            <Grid item xs={12} sm sx={{
              pr: { xs: 0, sm: 0.5 },
              flexBasis: { sm: '60%', md: '60%', lg: '60%' },
              maxWidth: { sm: '60%', md: '60%', lg: '60%' }
            }}>
              <Box sx={{ width: '100%' }}>
                {/* Mapeamento de Campos */}
                <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: .5 }}>Mapeamento de Campos</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Configure como os campos do arquivo correspondem aos campos do sistema. Se algum campo não existir no arquivo, deixe em branco.
                  </Typography>

                  {/* Coluna única: obrigatórios seguidos dos opcionais */}
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Campos (mapeie os que existirem)</Typography>
                    {[
                      { key:'empresa', label:'Empresa', icon:<BusinessIcon fontSize="small" sx={{ mr:.75, color:'primary.main' }} /> },
                      { key:'nome', label:'Nome', icon:<PersonIcon fontSize="small" sx={{ mr:.75, color:'primary.main' }} /> },
                      { key:'telefone', label:'Telemóvel', icon:<PhoneIcon fontSize="small" sx={{ mr:.75, color:'primary.main' }} /> },
                      { key:'email', label:'E-mail', icon:<EmailIcon fontSize="small" sx={{ mr:.75, color:'primary.main' }} /> },
                    ].map((f)=> (
                      <Box key={f.key} sx={{ mb: 1.5 }}>
                        <Box sx={{ display:'flex', alignItems:'center', mb:.5 }}>
                          {f.icon}
                          <Typography variant="body2" sx={{ fontWeight:700 }}>{f.label}</Typography>
                        </Box>
                        <FormControl fullWidth size="small">
                          <InputLabel>Selecione a coluna…</InputLabel>
                          <Select
                            sx={{ width: '100%' }}
                            label="Selecione a coluna…"
                            value={mapping[f.key]}
                            displayEmpty
                            renderValue={(selected)=> selected || 'Selecione a coluna…'}
                          onChange={(e)=> setMapping(m=>({
                            ...m,
                            [f.key]: e.target.value,
                          }))}
                          >
                            <MenuItem value=""><em>—</em></MenuItem>
                            {headers.length > 0 ? (
                              headers
                                .map(h=> ({ h, disabled: Object.values(mapping).includes(h) && mapping[f.key] !== h }))
                                .map(({h, disabled})=> (
                                  <MenuItem key={h} value={h} disabled={disabled}>{h}</MenuItem>
                                ))
                            ) : (
                              <MenuItem disabled value="__noheaders">Nenhuma coluna detectada — carregue um arquivo</MenuItem>
                            )}
                          </Select>
                        </FormControl>
                      </Box>
                    ))}

                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, mt: 1.5 }}>Campos Opcionais</Typography>
                    <Box sx={{ mb: 1.5 }}>
                      <Box sx={{ display:'flex', alignItems:'center', mb:.5 }}>
                        <BadgeIcon fontSize="small" sx={{ mr:.75, color:'warning.main' }} />
                        <Typography variant="body2" sx={{ fontWeight:700 }}>NIF (opcional)</Typography>
                      </Box>
                      <FormControl fullWidth size="small">
                        <InputLabel>Selecione a coluna…</InputLabel>
                        <Select
                          sx={{ width: '100%' }}
                          label="Selecione a coluna…"
                          value={mapping.nif}
                          displayEmpty
                          renderValue={(selected)=> selected || 'Selecione a coluna…'}
                          onChange={(e)=> setMapping(m=>({ ...m, nif: e.target.value }))}
                        >
                          <MenuItem value=''>—</MenuItem>
                          {headers.length > 0 ? (
                            headers
                              .map(h=> ({ h, disabled: Object.values(mapping).includes(h) && mapping.nif !== h }))
                              .map(({h, disabled})=> (<MenuItem key={h} value={h} disabled={disabled}>{h}</MenuItem>))
                          ) : (
                            <MenuItem disabled value="__noheaders">Nenhuma coluna detectada — carregue um arquivo</MenuItem>
                          )}
                        </Select>
                      </FormControl>
                    </Box>

                    <Alert severity="warning" variant="outlined">
                      <AlertTitle>Informação</AlertTitle>
                      O campo NIF é opcional e pode ser deixado em branco. Registros sem NIF serão importados normalmente.
                    </Alert>
                  </Box>
                </Paper>

                {/* removido: a prévia passa a ser full-width abaixo do grid */}
              </Box>
            </Grid>

            {/* Coluna direita: Sidebar */}
              <Grid item xs={12} sm sx={{
                pl: { xs: 0, sm: 0.5 },
                flexBasis: { sm: '40%', md: '40%', lg: '40%' },
                maxWidth: { sm: '40%', md: '40%', lg: '40%' }
              }}>
              {/* Compactação do painel lateral para reduzir altura total */}
              <Stack spacing={1}>
                <Paper variant="outlined" sx={{ p: { xs: 1, sm: 1.25 }, borderRadius: 2, height: typeof requiredCardHeight === 'number' ? requiredCardHeight + 35 : 'auto' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: { xs: 1, sm: 1.25 }, fontSize: { xs: '.95rem', sm: '1rem' }, lineHeight: 1.2 }}>Instruções</Typography>
                  <Stack spacing={{ xs: .85, sm: 1 }}>
                    {[
                      { n:1, t:'Prepare seu arquivo', d:'Organize os dados em formato XLS ou CSV com as colunas possíveis' },
                      { n:2, t:'Faça o upload', d:'Arraste o arquivo ou clique para selecioná-lo' },
                      { n:3, t:'Configurar os campos', d:'Mapeie as colunas do arquivo com os campos do sistema' },
                      { n:4, t:'Confira e importe', d:'Verifique a prévia e confirme a importação' },
                    ].map((s)=> (
                      <Box key={s.n} sx={{ display:'flex', gap:.5 }}>
                        <Box sx={{ width:{ xs:16, sm:18 }, height:{ xs:16, sm:18 }, borderRadius:'50%', bgcolor:'primary.main', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:{ xs:10, sm:11 }, mt:.35 }}>{s.n}</Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight:700, fontSize:{ xs:'.85rem', sm:'.9rem' }, lineHeight: 1.25 }}>{s.t}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize:{ xs:'.78rem', sm:'.84rem' }, lineHeight: 1.25 }}>{s.d}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ width: '100%', p: { xs: 1, sm: 1.25 }, borderRadius: 2 }} ref={requiredRef}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: .5, fontSize: { xs: '.95rem', sm: '1rem' }, lineHeight: 1.2 }}>Campos</Typography>
                  <Stack spacing={.5}>
                    {[
                      { label:'Empresa', req:false, icon:<BusinessIcon fontSize="small" /> },
                      { label:'Nome', req:false, icon:<PersonIcon fontSize="small" /> },
                      { label:'Telemóvel', req:false, icon:<PhoneIcon fontSize="small" /> },
                      { label:'E-mail', req:false, icon:<EmailIcon fontSize="small" /> },
                      { label:'NIF', req:false, icon:<BadgeIcon fontSize="small" /> },
                    ].map((it)=>(
                      <Box key={it.label} sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <Box sx={{ display:'flex', alignItems:'center', gap:.5 }}>
                          <Box sx={{ color:'primary.main' }}>{it.icon}</Box>
                          <Typography variant="body2" sx={{ fontSize:{ xs:'.85rem', sm:'.9rem' } }}>{it.label}</Typography>
                        </Box>
                        <Chip size="small" label={it.req?'Obrigatório':'Opcional'} color={it.req? 'error':'default'} variant="outlined" />
                      </Box>
                    ))}
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: { xs: 1, sm: 1.25 }, borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: .5, fontSize: { xs: '.95rem', sm: '1rem' }, lineHeight: 1.2 }}>Estatísticas</Typography>
                  <Stack spacing={.4}>
                    <Box sx={{ display:'flex', justifyContent:'space-between' }}>
                      <Typography variant="body2" sx={{ fontSize:{ xs:'.8rem', sm:'.86rem' } }}>Registros no arquivo:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize:{ xs:'.8rem', sm:'.86rem' } }}>{stats.total}</Typography>
                    </Box>
                    <Box sx={{ display:'flex', justifyContent:'space-between' }}>
                      <Typography variant="body2" sx={{ fontSize:{ xs:'.8rem', sm:'.86rem' } }}>Com NIF:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize:{ xs:'.8rem', sm:'.86rem' } }}>{stats.comNif}</Typography>
                    </Box>
                    <Box sx={{ display:'flex', justifyContent:'space-between' }}>
                      <Typography variant="body2" sx={{ fontSize:{ xs:'.8rem', sm:'.86rem' } }}>Sem NIF:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize:{ xs:'.8rem', sm:'.86rem' } }}>{stats.semNif}</Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Stack>
            </Grid>
          </Grid>
          {/* Script (Admin) — abaixo do card de Mapeamento e acima da Prévia */}
          {user?.is_admin && (
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: .5 }}>Script de instrução/aviso</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Essa mensagem será exibida na página de Movimentação para todos os usuários.
              </Typography>
              {scriptAlert && (
                <Alert severity={scriptAlert.type} sx={{ mb: 1 }}>{scriptAlert.text}</Alert>
              )}
              <textarea
                className="textarea"
                rows={4}
                value={scriptText}
                onChange={e=> setScriptText(e.target.value)}
                placeholder="Escreva instruções, avisos ou o roteiro de abordagem para a equipe."
              />
              <Box sx={{ display:'flex', gap: 1, mt: 1, justifyContent:'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={async ()=>{
                    setScriptAlert(null)
                    setSavingScript(true)
                    try{
                      await saveScript(scriptText)
                      setScriptAlert({ type:'success', text: 'Script salvo com sucesso.' })
                    } catch(err) {
                      setScriptAlert({ type:'error', text: err?.message || 'Falha ao salvar script' })
                    } finally {
                      setSavingScript(false)
                    }
                  }}
                  disabled={savingScript}
                >Salvar Script</Button>
              </Box>
            </Paper>
          )}
          {/* Footer movido para abaixo da Prévia full-width */}
        </Container>
      </Box>

      {/* Prévia dos Dados - FULL WIDTH */}
  <Box sx={{ width: '100%', bgcolor: (t)=> t.palette.mode==='light' ? '#f7f9fb' : alpha('#ffffff', 0.03), pt: 0, pb: 1 }}>
  <Container maxWidth={false} sx={{ maxWidth: '1680px', mx: 'auto', px: { xs: 1.5, sm: 2, md: 2.5 } }}>
          <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
              {alertBanner && (
                <Alert severity={alertBanner.type} sx={{ mb: 1.5 }}>
                  {alertBanner.text}
                </Alert>
              )}
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 1, mb: .5, flexWrap:'wrap' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Prévia dos Dados</Typography>
              <Box sx={{ display:'flex', gap: 1, flexWrap:'wrap', width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
                <Tooltip title={(file && accepted) ? 'Importa os registros para o sistema' : 'Aceite o arquivo para importar'}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleImportClick}
                    startIcon={importing ? (
                      <span className="inline-flex" aria-hidden>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M22 12a10 10 0 0 1-10 10"/></svg>
                      </span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.5 7.5 0 0 0-7.45 8.49A5.994 5.994 0 0 0 6 22h11a5 5 0 0 0 2.35-9.96z"/></svg>
                    )}
                    sx={(t)=>({
                      height: 44,
                      px: 2,
                      fontWeight: 800,
                      letterSpacing: .2,
                      borderRadius: 2,
                      textTransform: 'none',
                      boxShadow: t.shadows[1],
                      opacity: (file && accepted) ? 1 : 0.95,
                      transition: 'all .2s ease',
                      '&:hover': { boxShadow: t.shadows[2], transform: 'translateY(-1px)' },
                      width: { xs: '100%', sm: 'auto' }
                    })}
                  >
                    {importing ? 'Importando…' : 'Importar'}
                  </Button>
                </Tooltip>
                {/* Botão de importação em background removido */}
              </Box>
            </Box>
            {/* Progresso de background removido */}
            {/* Validação removida: sem alertas de sucesso/erro ou listagem de erros */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Visualize como os dados serão importados
            </Typography>
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', width: '100%' }}>
              <Box sx={{ width: '100%', overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 980 }}>
                  <TableHead>
                    <TableRow>
                      {['Empresa','Nome','Telemóvel','E-mail','NIF'].map(h=> (
                        <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(rows.slice(0,50)).map((r, idx)=>{
                      const empresa = r[mapping.empresa]||''
                      const nome = r[mapping.nome]||''
                      const telefone = r[mapping.telefone]||''
                      const email = r[mapping.email]||''
                      const nif = mapping.nif ? (r[mapping.nif]||'') : ''
                      return (
                        <TableRow key={idx}>
                          <TableCell>{empresa}</TableCell>
                          <TableCell>{nome}</TableCell>
                          <TableCell>{telefone}</TableCell>
                          <TableCell>{email || '—'}</TableCell>
                          <TableCell>{nif || '—'}</TableCell>
                        </TableRow>
                      )
                    })}
                    {!rows.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">Nenhum dado para pré-visualizar</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
            {rows.length>0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display:'block' }}>
                Mostrando {Math.min(50, rows.length)} de {rows.length} registros encontrados no arquivo
              </Typography>
            )}
            {/* Alertas movidos para o topo do card de prévia */}
          </Paper>
        </Container>
      </Box>

      {/* Footer compacto centralizado (igual ao da Movimentação) */}
      <Box sx={{ width: '100%', bgcolor: (t)=> t.palette.mode==='dark' ? t.palette.background.paper : '#FFFFFF', borderTop: (t)=> `1px solid ${t.palette.divider}` }}>
        <Container maxWidth={false} sx={{ maxWidth: '1680px', mx: 'auto', px: { xs: 1.5, sm: 2, md: 2.5 } }}>
          <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', py: 1.25, minHeight: 56, textAlign:'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, color: (t)=> t.palette.text.secondary }}>© 2025 Sistema Sol-Online • Módulo de Importação • Versão 1.0</Typography>
            <Box sx={{ display:'flex', gap: 1, alignItems:'center', justifyContent:'center', mt: .75, '& .MuiChip-label': { fontWeight: 500 } }}>
              <Typography variant="body2" color="text.secondary">Formatos suportados:</Typography>
              <Chip size="medium" label="XLS" color="primary" variant="outlined" />
              <Chip size="medium" label="CSV" color="success" variant="outlined" />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Modal de Pré-visualização e Confirmação */}
      <Dialog open={previewOpen} onClose={()=> !importing && setPreviewOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Pré-visualização e confirmação</DialogTitle>
        <DialogContent dividers>
          {fileType !== 'csv' && sheets.length > 1 && (
            <Box sx={{ mb: 2 }}>
              <FormControl size="small">
                <InputLabel id="sheet-label">Planilha</InputLabel>
                <Select
                  labelId="sheet-label"
                  label="Planilha"
                  value={selectedSheet}
                  onChange={async (e)=>{ setSelectedSheet(e.target.value); await loadSheetPreview(e.target.value); setCurrentPage(1) }}
                >
                  {sheets.map(s=> (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                </Select>
                <FormHelperText>Selecione a aba da pasta de trabalho</FormHelperText>
              </FormControl>
            </Box>
          )}
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', width: '100%' }}>
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 680 }}>
                <TableHead>
                  <TableRow>
                    {['Empresa','Nome','Telemóvel','E-mail','NIF'].map(h=> (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice((currentPage-1)*pageSize, (currentPage)*pageSize).map((r, idx)=>{
                    const empresa = r[mapping.empresa]||''
                    const nome = r[mapping.nome]||''
                    const telefone = r[mapping.telefone]||''
                    const email = r[mapping.email]||''
                    const nif = mapping.nif ? (r[mapping.nif]||'') : ''
                    return (
                      <TableRow key={idx}>
                        <TableCell>{empresa}</TableCell>
                        <TableCell>{nome}</TableCell>
                        <TableCell>{telefone}</TableCell>
                        <TableCell>{email || '—'}</TableCell>
                        <TableCell>{nif || '—'}</TableCell>
                      </TableRow>
                    )
                  })}
                  {!rows.length && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">Nenhum dado para pré-visualizar</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Paper>
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap:'wrap', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Mostrando {Math.min(pageSize, Math.max(0, rows.length - (currentPage-1)*pageSize))} de {rows.length} registros
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" variant="outlined" disabled={currentPage<=1} onClick={()=> setCurrentPage(p=> Math.max(1, p-1))}>Anterior</Button>
              <Typography variant="body2">Página {currentPage} / {Math.max(1, Math.ceil(rows.length / pageSize))}</Typography>
              <Button size="small" variant="outlined" disabled={currentPage>=Math.ceil(rows.length / pageSize)} onClick={()=> setCurrentPage(p=> Math.min(Math.ceil(rows.length / pageSize) || 1, p+1))}>Próxima</Button>
            </Stack>
          </Box>
          {/* Progresso removido do modal: importação agora ocorre apenas após aceitar o arquivo na tela principal */}
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> { if(importing) return; setPreviewOpen(false); setFile(null); setHeaders([]); setRows([]); setMapping({ empresa: '', nome: '', telefone: '', email: '', nif: '' }); setSheets([]); setSelectedSheet(''); setExcelArrayBuffer(null); setFileType(''); setPreviewNote(''); setAccepted(false); }} disabled={importing}>Cancelar</Button>
          <Button onClick={()=>{ setAccepted(true); setPreviewOpen(false) }} variant="contained" color="primary" disabled={importing || !file}>Aceitar arquivo</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
