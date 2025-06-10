// 서비스 워커 버전
const CACHE_NAME = 'youtube-comments-dashboard-v2';
const urlsToCache = [
    '/',
    '/manifest.json',
    '/favicon.ico'
];

// 서비스 워커 설치
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

// 서비스 워커 활성화
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 네트워크 요청 처리 (JavaScript 파일은 캐시하지 않음)  
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // JavaScript 파일이나 CSS 파일은 항상 네트워크에서 가져옴
    if (url.pathname.includes('/_next/') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.includes('chunks/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 나머지 요청은 캐시 우선으로 처리
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // 캐시에서 찾으면 반환, 없으면 네트워크에서 가져옴
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
            .catch(() => {
                // 네트워크 실패 시 기본 페이지 반환
                if (event.request.destination === 'document') {
                    return caches.match('/');
                }
            })
    );
});

// 푸시 알림 처리
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : '새로운 댓글이 등록되었습니다!',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: '확인하기',
                icon: '/favicon.ico'
            },
            {
                action: 'close',
                title: '닫기',
                icon: '/favicon.ico'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('YouTube 댓글 대시보드', options)
    );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        // 앱을 열거나 포커스
        event.waitUntil(
            clients.matchAll().then((clientList) => {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
}); 