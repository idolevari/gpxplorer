import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Shell } from './components/Shell'
import { Landing } from './pages/Landing'
import { Explore } from './pages/Explore'
import { SignIn } from './pages/SignIn'
import { Trip } from './pages/Trip'
import { NewTrip } from './pages/NewTrip'
import { NotFound } from './components/NotFound'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Landing />} />
            <Route path="/trips" element={<Explore />} />
            <Route path="/trip/:id" element={<Trip mode="id" />} />
            <Route path="/t/:token" element={<Trip mode="token" />} />
            <Route path="/new" element={<NewTrip />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
