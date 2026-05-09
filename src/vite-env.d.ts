/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPER_ADMIN_UID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
