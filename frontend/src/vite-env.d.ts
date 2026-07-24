/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string
	readonly VITE_CLERK_PUBLISHABLE_KEY?: string
}
declare module 'face-api.js'
interface ImportMeta {
	readonly env: ImportMetaEnv
}
