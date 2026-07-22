import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import App from './App'
import { SearchProvider } from './context/SearchContext'
import 'leaflet/dist/leaflet.css'
import './styles/global.css'

const queryClient = new QueryClient()
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? ''

function AppProviders() {
  const navigate = useNavigate()

  return (
    <ClerkProvider
      publishableKey={clerkKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      afterSignOutUrl="/sign-in"
    >
      <QueryClientProvider client={queryClient}>
        <SearchProvider>
          <App />
        </SearchProvider>
      </QueryClientProvider>
    </ClerkProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders />
    </BrowserRouter>
  </React.StrictMode>,
)
