import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ApiContext = createContext(null)

export function ApiProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  const apiBase = (() => {
    const envBase = import.meta.env.VITE_API_BASE
    if (envBase) return envBase
    const isDev = !!import.meta.env.DEV
    if (isDev) return 'http://127.0.0.1:8000/api'
    return `${window.location.origin.replace(/\/$/, '')}/api`
  })()

  // Caches por instância do Provider
  const inMemoryCache = new Map()
  const etagCache = new Map()
  const inflight = new Map()

  const SNAP_TTL_MS = 60_000
  const ssGet = (key) => {
    try {
      const raw = sessionStorage.getItem(key)
      if (!raw) return null
      const obj = JSON.parse(raw)
      if (!obj || typeof obj.ts !== 'number') return null
      if (Date.now() - obj.ts > SNAP_TTL_MS) return null
      return obj.data ?? null
    } catch { return null }
  }
  const ssSet = (key, data) => {
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })) } catch {}
  }

  const clearContactsCache = () => {
    try {
      for (const key of Array.from(inMemoryCache.keys())) {
        if (String(key).startsWith('contacts:')) inMemoryCache.delete(key)
      }
      for (const key of Array.from(etagCache.keys())) {
        if (String(key).startsWith('contacts:')) etagCache.delete(key)
      }
    } catch {}
  }

  function handleUnauthorized() {
    try {
      setToken('');
      setUser(null);
      try { sessionStorage.setItem('auth_msg', 'Sua sessão expirou. Faça login novamente.'); } catch {}
    } finally {
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
  }

  async function fetchJson(url, opts = {}) {
    const { method='GET', headers={}, body, signal, ...rest } = opts || {}
    const hdrs = { Accept: 'application/json', ...headers }
    if (token) hdrs['Authorization'] = `Bearer ${token}`
    const res = await fetch(url, { method, headers: hdrs, body, signal, ...rest })
    if (res.status === 401 || res.status === 419) {
      handleUnauthorized()
      throw new Error('Não autorizado')
    }
    return res
  }

  const api = useMemo(() => ({
    getDisplayName() {
      const u = user
      if (!u) return ''
      if (u.name && typeof u.name === 'string' && u.name.trim().length > 0) return u.name.trim()
      const email = (u.email || '').trim()
      if (!email) return ''
      const local = email.split('@')[0] || ''
      if (!local) return ''
      const sep = local.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
      if (!sep) return ''
      return sep.split(' ').map(p => p ? (p.charAt(0).toUpperCase() + p.slice(1)) : '').join(' ')
    },
    getContactsSnapshot(page=1, perPage=50, opts={}){
      const q = (opts?.q || '').trim()
      const status = opts?.status || ''
      const cacheKey = `contacts:${page}:${perPage}:${q}:${status}`
      return ssGet(`snapshot:${cacheKey}`)
    },
    getContactsStatsSnapshot(){
      return ssGet('snapshot:contacts:stats')
    },
    async login(email, password) {
      const res = await fetch(`${apiBase}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (!res.ok) {
        try {
          const err = await res.json()
          if (res.status === 403 && err?.message) throw new Error(err.message)
          if (err?.message) throw new Error(err.message)
        } catch {}
        throw new Error('Login inválido')
      }
      const data = await res.json()
      setToken(data.token)
      const u = data.user || {}
      const role = (u.role || (u.is_admin ? 'admin' : (u.is_commercial ? 'comercial' : 'normal')))
      setUser({ ...u, role, is_admin: !!u.is_admin, is_commercial: role === 'comercial' })
      return data
    },
    async logout() {
      if (!token) return
      await fetchJson(`${apiBase}/logout`, { method: 'POST', headers: {}, body: undefined, signal: undefined, keepalive: true })
      setToken(''); setUser(null)
    },
    async me() {
      const res = await fetchJson(`${apiBase}/me`)
      if (res.ok) {
        const u = await res.json()
        const role = (u.role || (u.is_admin ? 'admin' : (u.is_commercial ? 'comercial' : 'normal')))
        setUser({ ...u, role, is_admin: !!u.is_admin, is_commercial: role === 'comercial' })
      }
    },
    async importCsv(file, mapping) {
      const form = new FormData()
      form.append('file', file)
      if (mapping && typeof mapping === 'object') {
        if (mapping.empresa) form.append('map_empresa', mapping.empresa)
        if (mapping.nome) form.append('map_nome', mapping.nome)
        if (mapping.telefone) form.append('map_telefone', mapping.telefone)
        if (mapping.email) form.append('map_email', mapping.email)
        if (mapping.nif) form.append('map_nif', mapping.nif)
      }
      const res = await fetchJson(`${apiBase}/contacts/import`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: form
      })
      if (!res.ok) {
        try {
          const err = await res.json()
          throw new Error(err?.message || 'Falha ao importar')
        } catch {
          throw new Error('Falha ao importar')
        }
      }
      const data = await res.json()
      clearContactsCache()
      return data
    },
    async importCsvInBackground(file, mapping) {
      const form = new FormData()
      form.append('file', file)
      if (mapping && typeof mapping === 'object') {
        if (mapping.empresa) form.append('map_empresa', mapping.empresa)
        if (mapping.nome) form.append('map_nome', mapping.nome)
        if (mapping.telefone) form.append('map_telefone', mapping.telefone)
        if (mapping.email) form.append('map_email', mapping.email)
        if (mapping.nif) form.append('map_nif', mapping.nif)
      }
      const res = await fetchJson(`${apiBase}/contacts/import/background`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: form,
      })
      if (!res.ok) throw new Error('Falha ao iniciar importação em background')
      return await res.json()
    },
    openImportProgressStream(jobId, { onProgress, onDone, onError } = {}) {
      const url = `${apiBase.replace(/\/api$/, '')}/api/events/import/${encodeURIComponent(jobId)}`
      const es = new EventSource(url, { withCredentials: true })
      es.addEventListener('progress', (ev) => {
        try { const data = JSON.parse(ev.data||'{}'); onProgress && onProgress(data) } catch {}
      })
      es.addEventListener('ping', () => {})
      es.onerror = (e) => { onError && onError(e); es.close() }
      es.addEventListener('progress', (ev) => {
        try {
          const data = JSON.parse(ev.data||'{}')
          if (data.status === 'done') { onDone && onDone(data); es.close() }
          if (data.status === 'error') { onError && onError(new Error(data.message||'Erro na importação')); es.close() }
        } catch {}
      })
      return () => es.close()
    },
    async importCsvWithProgress(file, mapping, onProgress) {
      return await new Promise((resolve, reject) => {
        try {
          const form = new FormData()
          form.append('file', file)
          if (mapping && typeof mapping === 'object') {
            if (mapping.empresa) form.append('map_empresa', mapping.empresa)
            if (mapping.nome) form.append('map_nome', mapping.nome)
            if (mapping.telefone) form.append('map_telefone', mapping.telefone)
            if (mapping.email) form.append('map_email', mapping.email)
            if (mapping.nif) form.append('map_nif', mapping.nif)
          }
          const xhr = new XMLHttpRequest()
          xhr.open('POST', `${apiBase}/contacts/import`)
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
          xhr.setRequestHeader('Accept', 'application/json')
          xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
          if (xhr.upload && typeof onProgress === 'function') {
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100)
                onProgress({ stage: 'upload', percent })
              }
            }
          }
          xhr.onreadystatechange = () => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText)
                  clearContactsCache()
                  resolve(data)
                } catch {
                  clearContactsCache()
                  resolve({})
                }
              } else {
                try {
                  const err = JSON.parse(xhr.responseText)
                  reject(new Error(err?.message || 'Falha ao importar'))
                } catch {
                  reject(new Error('Falha ao importar'))
                }
              }
            }
          }
          xhr.onerror = () => reject(new Error('Falha de rede na importação'))
          if (typeof onProgress === 'function') onProgress({ stage: 'processing' })
          xhr.send(form)
        } catch (err) {
          reject(err)
        }
      })
    },
    async createUser(newUser) {
      try {
        const res = await fetchJson(`${apiBase}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify(newUser)
        })
        if (res.ok) return await res.json()
        let message = 'Falha ao criar usuário'
        try {
          const err = await res.json()
          if (err?.message) message = err.message
          else if (err?.errors) {
            const first = Object.values(err.errors).flat()[0]
            if (first) message = String(first)
          }
        } catch {}
        throw new Error(message)
      } catch (err) {
        const msg = String(err?.message || '')
        if (/Failed to fetch|NetworkError|TypeError/i.test(msg)) {
          throw new Error('Falha ao conectar ao servidor (rede/CORS). Verifique as permissões e tente novamente.')
        }
        throw err
      }
    },
    async listUsers() {
      const res = await fetchJson(`${apiBase}/users`, { method: 'GET' })
      if (!res.ok) throw new Error('Erro ao listar usuários')
      const raw = await res.json()
      const arr = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : [])
      return arr.map(u => {
        const role = (typeof u.role !== 'undefined') ? u.role : (u.is_admin ? 'admin' : (u.is_commercial ? 'comercial' : 'normal'))
        const active = (typeof u.active !== 'undefined') ? !!u.active : (typeof u.is_active !== 'undefined') ? !!u.is_active : (u.status ? String(u.status).toLowerCase() !== 'inactive' : true)
        const isCommercial = (typeof u.is_commercial !== 'undefined') ? !!u.is_commercial : role === 'comercial'
        return { ...u, role, is_admin: !!u.is_admin, is_commercial: isCommercial, active, is_active: active, status: active ? (u.status || 'active') : 'inactive' }
      })
    },
    async updateUserActive(id, active) {
      const res = await fetchJson(`${apiBase}/users/${id}/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !!active })
      })
      if (!res.ok) throw new Error('Erro ao atualizar status do usuário')
      try { return await res.json() } catch { return { ok: true } }
    },
    async deleteUser(id) {
      const res = await fetchJson(`${apiBase}/users/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir usuário')
      try { return await res.json() } catch { return { ok: true } }
    },
    async listContacts(page=1, perPage=50, opts={}) {
      const q = (opts?.q || '').trim()
      const status = opts?.status || ''
      const bust = !!opts?.bust
      const cacheKey = `contacts:${page}:${perPage}:${q}:${status}`
      const now = Date.now()
      if (!bust && inMemoryCache.has(cacheKey)) {
        const { ts, data } = inMemoryCache.get(cacheKey)
        if (now - ts < 5000) return data
      }
      if (!bust && inflight.has(cacheKey)) {
        try { return await inflight.get(cacheKey).promise } finally {}
      }
      const controller = new AbortController()
      const timeout = setTimeout(()=> controller.abort('timeout'), 10000)
      const url = new URL(`${apiBase}/contacts`)
      url.searchParams.set('page', page)
      url.searchParams.set('per_page', perPage)
      url.searchParams.set('perPage', perPage)
      url.searchParams.set('limit', perPage)
      if (q) url.searchParams.set('q', q)
      if (status) url.searchParams.set('status', status)
      if (bust) url.searchParams.set('_ts', String(Date.now()))
      const headers = { }
      const etag = etagCache.get(cacheKey)
      if (!bust && etag) headers['If-None-Match'] = etag
      const doFetch = async (withEtag=true) => {
        const hdrs = { ...headers }
        if (!withEtag || bust) { delete hdrs['If-None-Match'] }
        const res = await fetchJson(url.toString(), { headers: hdrs, signal: controller.signal })
        clearTimeout(timeout)
        const newEtag = res.headers.get('ETag') || res.headers.get('Etag')
        if (res.status === 304 && inMemoryCache.has(cacheKey)) {
          const cached = inMemoryCache.get(cacheKey).data
          inMemoryCache.set(cacheKey, { ts: Date.now(), data: cached })
          ssSet(`snapshot:${cacheKey}`, cached)
          return cached
        }
        if (res.status === 304 && !inMemoryCache.has(cacheKey)) {
          return await doFetch(false)
        }
        if (!res.ok) throw new Error('Erro ao carregar contatos')
        const raw = await res.json()
        const normalizeListResponse = (rawData) => {
          const list = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])
          let meta = rawData?.meta
          const top = rawData || {}
          const toNumber = (v, dflt) => {
            const n = Number(v)
            return Number.isFinite(n) ? n : dflt
          }
          if (!meta || typeof meta !== 'object') {
            const current_page = top?.current_page ?? top?.currentPage
            const per_page_v = top?.per_page ?? top?.perPage
            const total_v = top?.total
            let last_page = top?.last_page ?? top?.lastPage
            const per_v = toNumber(per_page_v, perPage)
            const total_n = toNumber(total_v, Array.isArray(list) ? list.length : 0)
            if (!last_page && total_n && per_v) {
              last_page = Math.max(1, Math.ceil(total_n / per_v))
            }
            meta = {
              current_page: toNumber(current_page, page),
              last_page: toNumber(last_page, 1),
              per_page: per_v,
              total: total_n,
            }
          } else {
            const current_page = meta.current_page ?? meta.currentPage
            const per_page_v = meta.per_page ?? meta.perPage
            const total_v = meta.total
            let last_page = meta.last_page ?? meta.lastPage
            const per_v = toNumber(per_page_v, perPage)
            const total_n = toNumber(total_v, Array.isArray(list) ? list.length : 0)
            if (!last_page && total_n && per_v) {
              last_page = Math.max(1, Math.ceil(total_n / per_v))
            }
            meta = {
              current_page: toNumber(current_page, page),
              last_page: toNumber(last_page, 1),
              per_page: per_v,
              total: total_n,
            }
          }
          return { data: list, meta }
        }
        const data = normalizeListResponse(raw)
        if (newEtag) etagCache.set(cacheKey, newEtag)
        inMemoryCache.set(cacheKey, { ts: Date.now(), data })
        ssSet(`snapshot:${cacheKey}`, data)
        return data
      }
      const fetchPromise = doFetch(true).finally(()=> { inflight.delete(cacheKey) })
      if (!bust) inflight.set(cacheKey, { controller, promise: fetchPromise })
      return await fetchPromise
    },
    async listContactsStats(opts={}) {
      const bust = !!opts?.bust
      const key = 'contacts:stats'
      const controller = new AbortController()
      const timeout = setTimeout(()=> controller.abort('timeout'), 8000)
      const headers = { }
      const etag = etagCache.get(key)
      if (!bust && etag) headers['If-None-Match'] = etag
      const statsUrl = new URL(`${apiBase}/contacts/stats`)
      if (bust) statsUrl.searchParams.set('_ts', String(Date.now()))
      let res = await fetchJson(statsUrl.toString(), { headers, signal: controller.signal })
      clearTimeout(timeout)
      const newEtag = res.headers.get('ETag') || res.headers.get('Etag')
      if (res.status === 304 && inMemoryCache.has(key)) {
        const cached = inMemoryCache.get(key).data
        inMemoryCache.set(key, { ts: Date.now(), data: cached })
        ssSet('snapshot:contacts:stats', cached)
        return cached
      }
      if (res.status === 304 && !inMemoryCache.has(key)) {
        const hdrs = { ...headers }; delete hdrs['If-None-Match']
        res = await fetchJson(statsUrl.toString(), { headers: hdrs, signal: controller.signal })
      }
      if (!res.ok) throw new Error('Erro ao carregar estatísticas')
      const data = await res.json()
      if (newEtag) etagCache.set(key, newEtag)
      inMemoryCache.set(key, { ts: Date.now(), data })
      ssSet('snapshot:contacts:stats', data)
      return data
    },
    async getScript() {
      const key = 'settings:script'
      const headers = {}
      const etag = etagCache.get(key)
      if (etag) headers['If-None-Match'] = etag
      const res = await fetchJson(`${apiBase}/settings/script`, { headers })
      const newEtag = res.headers.get('ETag') || res.headers.get('Etag')
      if (res.status === 304 && inMemoryCache.has(key)) {
        return inMemoryCache.get(key).data
      }
      if (res.status === 404) {
        const data = { script: '' }
        inMemoryCache.set(key, { ts: Date.now(), data })
        ssSet('snapshot:settings:script', data)
        return data
      }
      if (!res.ok) throw new Error('Erro ao carregar script')
      const data = await res.json()
      if (newEtag) etagCache.set(key, newEtag)
      inMemoryCache.set(key, { ts: Date.now(), data })
      ssSet('snapshot:settings:script', data)
      return data
    },
    async saveScript(value) {
      const res = await fetchJson(`${apiBase}/settings/script`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: value ?? '' })
      })
      if (!res.ok) throw new Error('Erro ao salvar script')
      inMemoryCache.delete('settings:script')
      etagCache.delete('settings:script')
      try {
        const text = await res.text()
        if (!text) return { ok: true }
        const json = JSON.parse(text)
        ssSet('snapshot:settings:script', json)
        return json
      } catch {
        const fallback = { ok: true, script: String(value ?? '') }
        ssSet('snapshot:settings:script', fallback)
        return fallback
      }
    },
    openContactsStream({ onChange } = {}) {
      const url = `${apiBase.replace(/\/api$/, '')}/api/events/contacts`
      let es = null
      let stopPolling = null
      let watchdog = null
      let lastPing = Date.now()
      const POLL_MS = 15000
      const WATCHDOG_MS = 25000

      const startPolling = () => {
        if (stopPolling) return stopPolling
        let lastStats = null
        const tick = async () => {
          try {
            const res = await fetch(`${apiBase}/contacts/stats`, { headers: { Authorization: `Bearer ${token}` } })
            if (!res.ok) return
            const s = await res.json()
            if (!lastStats || (s.total !== lastStats.total || s.processed !== lastStats.processed || s.pending !== lastStats.pending)) {
              lastStats = s
              onChange && onChange({ via: 'poll' })
            }
          } catch {}
        }
        const id = setInterval(tick, POLL_MS)
        tick()
        stopPolling = () => { clearInterval(id); stopPolling = null }
        return stopPolling
      }

      const startSse = () => {
        if (es) return es
        es = new EventSource(url, { withCredentials: true })
        es.addEventListener('contacts', (ev) => {
          try { const data = JSON.parse(ev.data||'{}'); onChange && onChange(data) } catch {}
        })
        es.addEventListener('ping', () => { lastPing = Date.now() })
        es.onerror = () => {
          try { es && es.close() } catch {}
          es = null
          startPolling()
        }
        watchdog = setInterval(() => {
          if (Date.now() - lastPing > WATCHDOG_MS) {
            try { es && es.close() } catch {}
            es = null
            startPolling()
            clearInterval(watchdog); watchdog = null
          }
        }, Math.floor(WATCHDOG_MS / 2))
        return es
      }

      startSse()

      return () => {
        try { es && es.close() } catch {}
        es = null
        if (watchdog) { clearInterval(watchdog); watchdog = null }
        if (stopPolling) { stopPolling(); stopPolling = null }
      }
    },
    async getContact(id) {
      const res = await fetchJson(`${apiBase}/contacts/${id}`)
      if (!res.ok) throw new Error('Erro ao carregar contato')
      return await res.json()
    },
    async updateContact(id, body) {
      const res = await fetchJson(`${apiBase}/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      const data = await res.json()
      clearContactsCache()
      return data
    },
    async getContactVisibility(id) {
      try {
        const res = await fetchJson(`${apiBase}/contacts/${id}/visibility`)
        if (res.status === 404) return { user_ids: [] }
        if (!res.ok) throw new Error('Erro ao carregar visibilidade')
        const data = await res.json()
        return { user_ids: Array.isArray(data?.user_ids) ? data.user_ids : [] }
      } catch {
        return { user_ids: [] }
      }
    },
    async updateContactVisibility(id, userIds) {
      const res = await fetchJson(`${apiBase}/contacts/${id}/visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: Array.isArray(userIds) ? userIds : [] })
      })
      if (!res.ok) throw new Error('Erro ao atualizar visibilidade')
      try { return await res.json() } catch { return { ok: true } }
    },
    async deleteContact(id) {
      const res = await fetchJson(`${apiBase}/contacts/${id}`, {
        method: 'DELETE',
        headers: { }
      })
      if (!res.ok) {
        try { const err = await res.json(); throw new Error(err?.message || 'Falha ao excluir') } catch { throw new Error('Falha ao excluir') }
      }
      const data = await res.json()
      clearContactsCache()
      return data
    },
    invalidateContactsCache: clearContactsCache,
    token,
    user,
    setToken,
    setUser
  }), [token, user])

  return (
    <ApiContext.Provider value={api}>
      {children}
    </ApiContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(ApiContext)
  return { token: ctx.token, user: ctx.user, login: ctx.login, logout: ctx.logout }
}

export function useApi() { return useContext(ApiContext) }
