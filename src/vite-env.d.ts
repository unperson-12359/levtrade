/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SETUP_UPLOAD_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
