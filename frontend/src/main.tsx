import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { SearchProvider } from './context/SearchContext'
import './styles/global.css'

const queryClient = new QueryClient()
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? ''

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/sign-in">
      <QueryClientProvider client={queryClient}>
        <SearchProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SearchProvider>
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>,
)
