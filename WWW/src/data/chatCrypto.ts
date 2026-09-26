const DB_NAME = "gamenow-chat";
const STORE = "keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key: string, value: unknown) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function bufToB64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function b64ToBuf(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export type WrappedRoomKey = {
  userId: string;
  ephemeralPublicJwk: JsonWebKey;
  iv: string;
  ciphertext: string;
};

export type ChatIdentityKeys = {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
};

async function importIdentity(publicKeyJwk: JsonWebKey, privateKeyJwk: JsonWebKey): Promise<ChatIdentityKeys> {
  const publicKey = await crypto.subtle.importKey("jwk", publicKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  return { publicKey, privateKey, publicKeyJwk, privateKeyJwk };
}

export async function ensureIdentity(
  userId: string,
  remote?: { publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey } | null,
): Promise<ChatIdentityKeys> {
  const storageKey = `identity:${userId}`;
  const saved = await idbGet<{ publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey }>(storageKey);
  if (saved?.publicKeyJwk && saved?.privateKeyJwk) {
    return importIdentity(saved.publicKeyJwk, saved.privateKeyJwk);
  }
  if (remote?.publicKeyJwk && remote?.privateKeyJwk) {
    await idbSet(storageKey, { publicKeyJwk: remote.publicKeyJwk, privateKeyJwk: remote.privateKeyJwk });
    return importIdentity(remote.publicKeyJwk, remote.privateKeyJwk);
  }

  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  await idbSet(storageKey, { publicKeyJwk, privateKeyJwk });
  return { publicKey: pair.publicKey, privateKey: pair.privateKey, publicKeyJwk, privateKeyJwk };
}

async function importPublic(jwk: JsonWebKey) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

async function deriveWrapKey(privateKey: CryptoKey, publicKey: CryptoKey) {
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  return crypto.subtle.importKey("raw", bits, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function createRoomKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function wrapRoomKeyFor(roomKey: CryptoKey, recipientPublicJwk: JsonWebKey, recipientUserId: string): Promise<WrappedRoomKey> {
  const recipientPublic = await importPublic(recipientPublicJwk);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const wrapKey = await deriveWrapKey(ephemeral.privateKey, recipientPublic);
  const raw = await crypto.subtle.exportKey("raw", roomKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, raw);
  const ephemeralPublicJwk = await crypto.subtle.exportKey("jwk", ephemeral.publicKey);
  return {
    userId: recipientUserId,
    ephemeralPublicJwk,
    iv: bufToB64(iv),
    ciphertext: bufToB64(ciphertext),
  };
}

export async function unwrapRoomKey(
  wrap: WrappedRoomKey,
  myPrivateKey: CryptoKey,
): Promise<CryptoKey> {
  const ephemeralPublic = await importPublic(wrap.ephemeralPublicJwk);
  const wrapKey = await deriveWrapKey(myPrivateKey, ephemeralPublic);
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(wrap.iv)) },
    wrapKey,
    b64ToBuf(wrap.ciphertext),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptMessage(roomKey: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, roomKey, encoded);
  return { iv: bufToB64(iv), ciphertext: bufToB64(ciphertext) };
}

export async function decryptMessage(roomKey: CryptoKey, iv: string, ciphertext: string) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(iv)) },
    roomKey,
    b64ToBuf(ciphertext),
  );
  return new TextDecoder().decode(plain);
}

const roomKeyCache = new Map<string, CryptoKey>();

export function cachedRoomKey(roomId: string) {
  return roomKeyCache.get(roomId) ?? null;
}

export function setCachedRoomKey(roomId: string, key: CryptoKey) {
  roomKeyCache.set(roomId, key);
}

export function clearRoomKeyCache() {
  roomKeyCache.clear();
}
