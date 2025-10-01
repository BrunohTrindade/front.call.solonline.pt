import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'

const ThemeModeContext = createContext({ mode: 'light', toggle: () => {} })

export function ThemeModeProvider({ children }){
  const [mode, setMode] = useState('light')

  const muiTheme = useMemo(() => createTheme({
    palette: { mode },
    components: {
      MuiAppBar: { styleOverrides: { root: { boxShadow: '0 1px 0 rgba(0,0,0,0.06)' } } },
      MuiButton: { defaultProps: { size: 'small' } },
      MuiIconButton: { defaultProps: { size: 'small' } },
      MuiToolbar: { styleOverrides: { dense: { minHeight: 48, paddingLeft: 12, paddingRight: 12 } } },
    }
  }), [mode])

  useEffect(() => {
    // Sincroniza com o CSS existente baseado em data-theme
    document.documentElement.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light')
  }, [mode])

  const value = useMemo(() => ({ mode, toggle: () => setMode(m => m === 'dark' ? 'light' : 'dark') }), [mode])

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode(){
  return useContext(ThemeModeContext)
}
