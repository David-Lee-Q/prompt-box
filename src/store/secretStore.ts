import { create } from 'zustand';

interface SecretStore {
  key: CryptoKey | null;
  hasKey: boolean;
  unlock: (password: string, salt: string) => Promise<boolean>;
  lock: () => void;
}

const useSecretStore = create<SecretStore>((set) => ({
  key: null,
  hasKey: false,

  unlock: async (password: string, salt: string) => {
    try {
      const key = await deriveKey(password, salt);
      set({ key, hasKey: true });
      return true;
    } catch {
      return false;
    }
  },

  lock: () => set({ key: null, hasKey: false }),
}));

const ITERATIONS = 600000;
const IV_LENGTH = 12;

export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSecret(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain)
  );
  const combined = new Uint8Array(IV_LENGTH + buf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(buf), IV_LENGTH);
  let binary = '';
  for (const byte of combined) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function decryptSecret(encoded: string, key: CryptoKey): Promise<string> {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const iv = bytes.slice(0, IV_LENGTH);
  const data = bytes.slice(IV_LENGTH);
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(buf);
}

export default useSecretStore;
