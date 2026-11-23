import { createSeed } from './seed.js';
import { expire } from './domain.js';
const KEY = 'retratus.demo.v1';
// Adapter deliberately local. Replace this boundary with a server API for production.
export function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return createSeed();
  let state;
  try { state = JSON.parse(raw); if (state.version !== 1 || !Array.isArray(state.people) || !Array.isArray(state.records)) throw Error(); expire(state); }
  catch { throw Error('Dados locais inválidos. Use “Restaurar demonstração” para recuperar a base fictícia.'); }
  if (JSON.stringify(state) !== raw) save(state);
  return state;
}
export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { throw Error('O armazenamento deste navegador está cheio ou indisponível. A alteração não foi salva. Use imagens menores ou restaure a demonstração.'); }
}
export function reset() { const state = createSeed(); save(state); return state; }
export function transact(state, action) { const next = structuredClone(state); expire(next); action(next); save(next); return next; }
