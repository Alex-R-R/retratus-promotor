import test from 'node:test';
import assert from 'node:assert/strict';
import * as Repo from '../src/repository.js';
import { createSeed } from '../src/seed.js';
import { DAY } from '../src/domain.js';
function storage() { const data = new Map(); globalThis.localStorage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }; return data; }
test('adapter salva alterações e recupera mesma base', () => { storage(); const state = createSeed(); const next = Repo.transact(state, s => s.now += 3600000); assert.equal(Repo.load().now, next.now); assert.notEqual(next.now, state.now); });
test('falha de quota não modifica estado anterior', () => { storage(); const state = createSeed(), before = state.now; globalThis.localStorage.setItem = () => { throw Error('QuotaExceededError'); }; assert.throws(() => Repo.transact(state, s => s.now += 100), /não foi salva/); assert.equal(state.now, before); });
test('carregamento persiste exclusão por retenção, mantendo os registros', () => { const data = storage(); const state = createSeed(); state.now += 32 * DAY; Repo.save(state); const loaded = Repo.load(); assert.equal(loaded.records[0].endPhoto.data, null); const persisted = JSON.parse(data.get('retratus.demo.v1')); assert.equal(persisted.records[0].endPhoto.data, null); assert.equal(persisted.records.length, state.records.length); });
