import { initStoragePolyfill } from './lib/storage'
initStoragePolyfill()

import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import App from './App'
import { SearchProvider } from './context/SearchContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SmoothScroll } from './components/SmoothScroll'
import 'leaflet/dist/leaflet.css'
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_bm9ibGUtdmVydmV0LTYyLmNsZXJrLmFjY291bnRzLmRldiQ'

function AppProviders() {
  return (
    <ClerkProvider
      publishableKey={clerkKey}
      afterSignOutUrl="/sign-in"
    >
      <QueryClientProvider client={queryClient}>
        <SearchProvider>
          <SmoothScroll>
            <App />
          </SmoothScroll>
        </SearchProvider>
      </QueryClientProvider>
    </ClerkProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProviders />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

