/* ==========================================================================
   apk.js  |  SPOT THE SCAM  |  APK permission inspector
   Reads an .apk file on the device (nothing is uploaded) and lists the
   Android permissions the app asks for. A fake "bank app" that wants to read
   your SMS and watch your screen is a classic way OTPs get stolen.

   HONEST LIMITS: this reads permissions only. It does not scan code, so it is
   NOT antivirus. A scary list is a warning; a clean list is not a guarantee.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Apk = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** permission -> weight and plain-language reason */
  const RISKY = {
    'android.permission.READ_SMS':          { w: 0.5, why: 'Can read your text messages, including bank OTPs.' },
    'android.permission.RECEIVE_SMS':       { w: 0.5, why: 'Can intercept incoming texts, including OTPs.' },
    'android.permission.SEND_SMS':          { w: 0.4, why: 'Can send texts from your number, which can cost you money.' },
    'android.permission.BIND_ACCESSIBILITY_SERVICE': { w: 0.7, why: 'Can watch your screen and tap for you. Banking trojans abuse this.' },
    'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE': { w: 0.5, why: 'Can read all your notifications, including OTP alerts.' },
    'android.permission.SYSTEM_ALERT_WINDOW': { w: 0.4, why: 'Can draw fake screens over your real banking app.' },
    'android.permission.BIND_DEVICE_ADMIN': { w: 0.6, why: 'Can lock the phone and make itself hard to remove.' },
    'android.permission.REQUEST_INSTALL_PACKAGES': { w: 0.4, why: 'Can install other apps without you going to the store.' },
    'android.permission.READ_CALL_LOG':     { w: 0.3, why: 'Can read who you called and who called you.' },
    'android.permission.READ_CONTACTS':     { w: 0.2, why: 'Can read all your contacts.' },
    'android.permission.RECORD_AUDIO':      { w: 0.2, why: 'Can record sound around you.' },
    'android.permission.QUERY_ALL_PACKAGES': { w: 0.15, why: 'Can see every app you have installed.' },
  };
  const SMS_READ = ['android.permission.READ_SMS', 'android.permission.RECEIVE_SMS'];
  const SCREEN_OR_NOTIF = ['android.permission.BIND_ACCESSIBILITY_SERVICE', 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE', 'android.permission.SYSTEM_ALERT_WINDOW'];
  const NAME_FLAGS = /(bank|update|verify|free|gift|bonus|loan|award|crack|mod|cash|reward)/i;

  const u16 = (v, o) => v.getUint16(o, true);
  const u32 = (v, o) => v.getUint32(o, true);

  async function slice(file, start, end) {
    return new Uint8Array(await file.slice(start, end).arrayBuffer());
  }

  /** Reads the zip's central directory. Returns the list of entries. */
  async function readEntries(file) {
    const tailLen = Math.min(file.size, 65557);
    const tail = await slice(file, file.size - tailLen, file.size);
    const tv = new DataView(tail.buffer);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not a zip file');
    const count = u16(tv, eocd + 10);
    const cdSize = u32(tv, eocd + 12);
    const cdOffset = u32(tv, eocd + 16);
    if (cdOffset === 0xffffffff || count === 0xffff) throw new Error('zip64 files are not supported');

    const cd = await slice(file, cdOffset, cdOffset + cdSize);
    const cv = new DataView(cd.buffer);
    const entries = [];
    let p = 0;
    while (p + 46 <= cd.length && cv.getUint32(p, true) === 0x02014b50) {
      const nameLen = u16(cv, p + 28), extraLen = u16(cv, p + 30), commentLen = u16(cv, p + 32);
      entries.push({
        method: u16(cv, p + 10), compSize: u32(cv, p + 20), size: u32(cv, p + 24), offset: u32(cv, p + 42),
        name: new TextDecoder().decode(cd.subarray(p + 46, p + 46 + nameLen)),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function readEntry(file, entry) {
    const head = await slice(file, entry.offset, entry.offset + 30);
    const hv = new DataView(head.buffer);
    if (hv.getUint32(0, true) !== 0x04034b50) throw new Error('damaged zip entry');
    const start = entry.offset + 30 + u16(hv, 26) + u16(hv, 28);
    const raw = await slice(file, start, start + entry.compSize);
    if (entry.method === 0) return raw;
    if (entry.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot unpack the file; update your browser');
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    throw new Error('unsupported compression');
  }

  /** Finds permission names inside the binary manifest (UTF-16 or UTF-8 string pool). */
  function findPermissions(bytes) {
    const re = /android\.permission\.[A-Z_]+/g;
    const found = new Set();
    const even = bytes.subarray(0, bytes.length & ~1);
    for (const text of [new TextDecoder('utf-16le').decode(even), new TextDecoder('latin1').decode(bytes)]) {
      for (const m of text.matchAll(re)) found.add(m[0]);
    }
    return [...found].sort();
  }

  /** Decide a verdict from the permission list and file name. Pure, testable. */
  function assess(perms, name) {
    const risky = perms.filter((p) => RISKY[p]).map((p) => ({ perm: p, w: RISKY[p].w, why: RISKY[p].why }));
    const nameHit = NAME_FLAGS.test(name || '');
    const reads = perms.some((p) => SMS_READ.includes(p));
    const watches = perms.some((p) => SCREEN_OR_NOTIF.includes(p));
    const trojanCombo = reads && watches;
    const net = risky.reduce((a, r) => a + r.w, 0) + (nameHit ? 0.15 : 0);
    const verdict = trojanCombo || net >= 1.2 ? 'scam' : net >= 0.5 ? 'unsure' : 'clear';
    return { risky, nameHit, trojanCombo, net: Math.round(net * 100) / 100, verdict };
  }

  async function inspect(file) {
    const out = { ok: false, name: file.name, size: file.size };
    try {
      const entries = await readEntries(file);
      out.entries = entries.length;
      out.dex = entries.filter((e) => /^classes\d*\.dex$/.test(e.name)).length;
      out.signed = entries.some((e) => /^META-INF\/.+\.(RSA|DSA|EC)$/i.test(e.name));
      const manifest = entries.find((e) => e.name === 'AndroidManifest.xml');
      out.isApk = !!manifest;
      if (!manifest) { out.error = 'This zip file has no AndroidManifest.xml, so it is not an Android app.'; return out; }
      out.perms = findPermissions(await readEntry(file, manifest));
      Object.assign(out, assess(out.perms, file.name));
      out.ok = true;
    } catch (e) {
      out.error = e.message === 'not a zip file' ? 'This is not a valid APK (APK files are zip files).' : 'Could not read the file: ' + e.message;
    }
    return out;
  }

  return { inspect, assess, findPermissions, RISKY };
});
