const CACHE = 'jere-genesis-v11';
const base = self.registration.scope;

const assets = [
    './',
    'index.html',
    'manifest.webmanifest',
    'icon-192.png',
    'icon-512.png',
    'cancion.mp3'
].map(x => new URL(x, base).href);

// Instalación y almacenamiento offline
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(assets))
            .then(() => self.skipWaiting())
    );
});

// Eliminar versiones anteriores de la caché
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(k =>
                        k.startsWith('jere-genesis-') &&
                        k !== CACHE
                    )
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Gestionar solicitudes y funcionamiento offline
self.addEventListener('fetch', e => {
    const r = e.request;

    if (r.method !== 'GET') return;

    const u = new URL(r.url);

    // Almacenar fuentes de Google Fonts
    if (u.origin !== location.origin) {
        if (
            u.hostname === 'fonts.googleapis.com' ||
            u.hostname === 'fonts.gstatic.com'
        ) {
            e.respondWith(
                caches.open(CACHE).then(async c => {
                    const hit = await c.match(r);

                    if (hit) return hit;

                    const res = await fetch(r);

                    if (res.ok || res.type === 'opaque') {
                        await c.put(r, res.clone());
                    }

                    return res;
                })
            );
        }

        return;
    }

    if (!u.href.startsWith(base)) return;

    e.respondWith((async () => {
        const c = await caches.open(CACHE);

        // Reproducción musical sin Internet
        if (
            u.pathname ===
            new URL('cancion.mp3', base).pathname
        ) {
            const hit = await c.match(assets[5]);

            if (!hit) return fetch(r);

            const range = r.headers.get('range');

            if (!range) return hit;

            const b = await hit.arrayBuffer();
            const n = b.byteLength;
            const m = /^bytes=(\d*)-(\d*)$/.exec(range);

            let a, z;

            if (!m || (!m[1] && !m[2])) {
                return new Response(null, {
                    status: 416,
                    headers: {
                        'Content-Range': `bytes */${n}`
                    }
                });
            }

            if (!m[1]) {
                a = Math.max(0, n - Number(m[2]));
                z = n - 1;
            } else {
                a = Number(m[1]);
                z = m[2]
                    ? Math.min(Number(m[2]), n - 1)
                    : n - 1;
            }

            if (a >= n || z < a) {
                return new Response(null, {
                    status: 416,
                    headers: {
                        'Content-Range': `bytes */${n}`
                    }
                });
            }

            return new Response(b.slice(a, z + 1), {
                status: 206,
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Content-Range': `bytes ${a}-${z}/${n}`,
                    'Content-Length': String(z - a + 1),
                    'Accept-Ranges': 'bytes'
                }
            });
        }

        // Priorizar la versión actualizada de la página
        if (r.mode === 'navigate') {
            try {
                return await fetch(r);
            } catch {
                return await c.match(assets[1]);
            }
        }

        // Recuperar recursos almacenados
        return await c.match(r) || fetch(r);

    })());
});
