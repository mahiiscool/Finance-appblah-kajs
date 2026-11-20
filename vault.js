(function (root) {
  'use strict';
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const ITER = 600000;
  const subtle = () => (root.crypto || globalThis.crypto).subtle;
  const rand = (n) => (root.crypto || globalThis.crypto).getRandomValues(new Uint8Array(n));

  const toB64 = (buf) => {
    const b = new Uint8Array(buf); let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const fromB64 = (s) => { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; };

  // Storage: IndexedDB in the browser, an in memory map when testing in Node
  let mem = null;
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('moneyvault', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const useMem = () => typeof indexedDB === 'undefined';
  const kvGet = async (k) => {
    if (useMem()) { mem = mem || new Map(); return mem.get(k); }
    const d = await db();
    return new Promise((res, rej) => { const r = d.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  };
  const kvPut = async (k, v) => {
    if (useMem()) { mem = mem || new Map(); mem.set(k, v); return; }
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  };
  const kvClear = async () => {
    if (useMem()) { mem = new Map(); return; }
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').clear(); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  };

  const deriveBits = async (pass, salt, iter) => {
    const km = await subtle().importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, 256));
  };
  const toKey = (bits) => subtle().importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const seal = async (k, obj) => {
    const iv = rand(12);
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)));
    return { iv: toB64(iv), ct: toB64(ct) };
  };
  const open = async (k, box) => JSON.parse(dec.decode(await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, k, fromB64(box.ct))));

  let key = null;

  const Vault = {
    ITER,
    exists: async () => !!(await kvGet('meta')),
    isUnlocked: () => !!key,
    lock: () => { key = null; },

    create: async (pass, state) => {
      const salt = rand(16);
      const k = await toKey(await deriveBits(pass, salt, ITER));
      await kvPut('meta', { salt: toB64(salt), iter: ITER, check: await seal(k, { ok: 1 }), face: null });
      key = k;
      await Vault.save(state);
    },

    unlock: async (pass) => {
      const meta = await kvGet('meta');
      if (!meta) throw new Error('No vault');
      const k = await toKey(await deriveBits(pass, fromB64(meta.salt), meta.iter));
      try { await open(k, meta.check); } catch (e) { throw new Error('Wrong passcode'); }
      const blob = await kvGet('blob');
      const state = blob ? await open(k, blob) : null;
      key = k;
      return state;
    },

    save: async (state) => {
      if (!key) throw new Error('Locked');
      await kvPut('blob', await seal(key, state));
    },

    changePass: async (oldPass, newPass, state) => {
      const meta = await kvGet('meta');
      const ok = await toKey(await deriveBits(oldPass, fromB64(meta.salt), meta.iter));
      try { await open(ok, meta.check); } catch (e) { throw new Error('Wrong passcode'); }
      const salt = rand(16);
      const k = await toKey(await deriveBits(newPass, salt, ITER));
      await kvPut('meta', { salt: toB64(salt), iter: ITER, check: await seal(k, { ok: 1 }), face: null });
      key = k;
      await Vault.save(state);
    },

    exportBackup: async () => {
      const meta = await kvGet('meta'); const blob = await kvGet('blob');
      return JSON.stringify({ app: 'money', v: 1, meta: { salt: meta.salt, iter: meta.iter, check: meta.check }, blob });
    },

    importBackup: async (text, pass) => {
      const data = JSON.parse(text);
      if (!data || data.app !== 'money' || !data.meta || !data.blob) throw new Error('Not a backup file');
      const k = await toKey(await deriveBits(pass, fromB64(data.meta.salt), data.meta.iter));
      try { await open(k, data.meta.check); } catch (e) { throw new Error('Wrong backup passcode'); }
      const state = await open(k, data.blob);
      await kvPut('meta', { salt: data.meta.salt, iter: data.meta.iter, check: data.meta.check, face: null });
      await kvPut('blob', data.blob);
      key = k;
      return state;
    },

    wipe: async () => { key = null; await kvClear(); },

    // Optional Face ID through WebAuthn with the PRF extension. The passcode derived key is
    // wrapped by a key only the platform authenticator can reproduce.
    faceSupported: async () => {
      try { return !!(root.PublicKeyCredential && await root.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
      catch (e) { return false; }
    },
    faceEnabled: async () => { const m = await kvGet('meta'); return !!(m && m.face); },
    disableFace: async () => { const m = await kvGet('meta'); if (m) { m.face = null; await kvPut('meta', m); } },

    enableFace: async (pass) => {
      const meta = await kvGet('meta');
      const bits = await deriveBits(pass, fromB64(meta.salt), meta.iter);
      const k = await toKey(bits);
      try { await open(k, meta.check); } catch (e) { throw new Error('Wrong passcode'); }
      const prfInput = enc.encode('money app face unlock v1');
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: rand(32),
        rp: { name: 'Money', id: location.hostname },
        user: { id: rand(16), name: 'owner', displayName: 'Owner' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        extensions: { prf: { eval: { first: prfInput } } },
        timeout: 60000
      } });
      const rawId = new Uint8Array(cred.rawId);
      const prf = await Vault._prf(rawId);
      if (!prf) throw new Error('This device or browser cannot use Face ID to unlock here');
      const wk = await Vault._wrapKey(prf);
      const iv = rand(12);
      const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, wk, bits);
      meta.face = { cred: toB64(rawId), iv: toB64(iv), ct: toB64(ct) };
      await kvPut('meta', meta);
    },

    _prf: async (rawId) => {
      const prfInput = enc.encode('money app face unlock v1');
      const res = await navigator.credentials.get({ publicKey: {
        challenge: rand(32), rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: rawId }],
        userVerification: 'required',
        extensions: { prf: { eval: { first: prfInput } } },
        timeout: 60000
      } });
      const ext = res.getClientExtensionResults();
      return ext && ext.prf && ext.prf.results && ext.prf.results.first ? new Uint8Array(ext.prf.results.first) : null;
    },
    _wrapKey: async (prf) => {
      const km = await subtle().importKey('raw', prf, 'HKDF', false, ['deriveKey']);
      return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('money wrap') }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    },

    unlockFace: async () => {
      const meta = await kvGet('meta');
      if (!meta || !meta.face) throw new Error('Face ID is not set up');
      const prf = await Vault._prf(fromB64(meta.face.cred));
      if (!prf) throw new Error('Face ID could not unlock');
      const wk = await Vault._wrapKey(prf);
      let bits;
      try { bits = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(meta.face.iv) }, wk, fromB64(meta.face.ct))); }
      catch (e) { throw new Error('Face ID could not unlock'); }
      const k = await toKey(bits);
      await open(k, meta.check);
      const blob = await kvGet('blob');
      const state = blob ? await open(k, blob) : null;
      key = k;
      return state;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Vault;
  else root.Vault = Vault;
})(typeof window !== 'undefined' ? window : globalThis);
