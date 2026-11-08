/* Descriptografia no navegador (WebCrypto). Espelha scripts/publicar.py:
 * chave = PBKDF2-SHA256(senha, salt, iter) -> AES-256-GCM; arquivo = iv(12) || ct; AAD = mês.
 * O conteúdo é gzip antes de cifrar. */

const enc = new TextEncoder();
const CHAVE_STORAGE = 'vt-dash-chave';

function b64ParaBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesParaB64(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

/** Credencial = "login\nsenha" (login sem espaços e minúsculo). Espelha credencial() em publicar.py. */
export function credencial(login, senha, kdf) {
  return kdf.credencial === 'login+senha' ? `${String(login).trim().toLowerCase()}\n${senha}` : senha;
}

export async function derivarChave(login, senha, kdf) {
  const base = await crypto.subtle.importKey('raw', enc.encode(credencial(login, senha, kdf)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64ParaBytes(kdf.salt), iterations: kdf.iter },
    base, { name: 'AES-GCM', length: 256 }, true, ['decrypt'],
  );
}

async function gunzip(buf) {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Lança erro 'SENHA' se a chave não abrir o arquivo (tag GCM inválida). */
export async function decifrarMes(chave, mes, buffer) {
  const bytes = new Uint8Array(buffer);
  let plano;
  try {
    plano = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: enc.encode(mes) },
      chave, bytes.slice(12),
    );
  } catch {
    throw new Error('SENHA');
  }
  return JSON.parse(await gunzip(plano));
}

/* Guarda a CHAVE derivada (não a senha digitada) — sessão da aba por padrão,
 * ou localStorage se o usuário marcar "manter conectado". */
export async function guardarChave(chave, lembrar) {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', chave));
  const valor = bytesParaB64(raw);
  try {
    (lembrar ? localStorage : sessionStorage).setItem(CHAVE_STORAGE, valor);
  } catch { /* storage bloqueado: segue só em memória */ }
}

export async function chaveGuardada() {
  let valor = null;
  try {
    valor = sessionStorage.getItem(CHAVE_STORAGE) || localStorage.getItem(CHAVE_STORAGE);
  } catch { return null; }
  if (!valor) return null;
  try {
    return await crypto.subtle.importKey('raw', b64ParaBytes(valor), { name: 'AES-GCM' }, true, ['decrypt']);
  } catch { return null; }
}

export function esquecerChave() {
  try { sessionStorage.removeItem(CHAVE_STORAGE); localStorage.removeItem(CHAVE_STORAGE); } catch { /* ok */ }
}
