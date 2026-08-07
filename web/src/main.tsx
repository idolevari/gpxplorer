import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Shell } from './components/Shell'
import { Explore } from './pages/Explore'
import { SignIn } from './pages/SignIn'
import './index.css'

// eslint-disable-next-line react-refresh/only-export-components -- entry file, not fast-refreshed
function Placeholder({ name }: { name: string }) {
  return <p className="p-10 text-[var(--dim)]">{name} — arriving in a later task.</p>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Explore />} />
            <Route path="/trips" element={<Explore />} />
            <Route path="/trip/:id" element={<Placeholder name="Trip page" />} />
            <Route path="/t/:token" element={<Placeholder name="Shared trip" />} />
            <Route path="/new" element={<Placeholder name="New trip" />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="*" element={<Placeholder name="Not found" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
