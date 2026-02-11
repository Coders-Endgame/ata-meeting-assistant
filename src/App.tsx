import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import MainPage from './pages/MainPage'
import SessionPage from './pages/SessionPage'
import Topbar from './components/Topbar'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'))
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingSession(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoadingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loadingSession) {
    return <div className="container loading-container">Loading...</div>;
  }

  return (
    <Router>
      <div className="app-wrapper">
        <Topbar session={session} theme={theme} toggleTheme={toggleTheme} />
        <div className="app-content">
          <Routes>
        <Route path="/" element={<LandingPage/>} />
        <Route
          path="/auth"
          element={
            !session ? (
              <AuthPage />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            session ? (
              <MainPage session={session} />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route
          path="/session/:sessionId"
          element={
            session ? (
              <SessionPage />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
