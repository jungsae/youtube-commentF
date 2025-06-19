// 서비스 워커 버전
const CACHE_NAME = 'youtube-comments-dashboard-v3';
const urlsToCache = [
    '/',
    '/manifest.json',
    '/favicon.ico'
];

// 서비스 워커 설치
self.addEventListener('install', (event) => {
    console.log('Service Worker 설치 중...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('캐시에 기본 파일들 추가 중...');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('캐시 추가 중 오류:', error);
            })
    );
    // 즉시 활성화
    self.skipWaiting();
});

// 서비스 워커 활성화
self.addEventListener('activate', (event) => {
    console.log('Service Worker 활성화 중...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('이전 캐시 삭제:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 모든 클라이언트에 제어권을 즉시 가져오기
            return self.clients.claim();
        })
    );
});

// 네트워크 요청 처리
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 개발 환경에서는 모든 요청을 네트워크로 처리
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        event.respondWith(fetch(event.request));
        return;
    }

    // Next.js 정적 파일들 (_next/static/)은 항상 네트워크에서 가져옴
    if (url.pathname.includes('/_next/static/') ||
        url.pathname.includes('/_next/webpack-hmr') ||
        url.pathname.includes('/_next/data/')) {
        event.respondWith(
            fetch(event.request)
                .catch((error) => {
                    console.error('Next.js 정적 파일 로드 실패:', url.pathname, error);
                    // 실패 시 기본 응답 반환
                    return new Response('', { status: 404 });
                })
        );
        return;
    }

    // JavaScript, CSS 파일들도 네트워크 우선
    if (url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.includes('chunks/')) {
        event.respondWith(
            fetch(event.request)
                .catch((error) => {
                    console.error('정적 파일 로드 실패:', url.pathname, error);
                    return new Response('', { status: 404 });
                })
        );
        return;
    }

    // API 요청은 네트워크 우선
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 나머지 요청은 캐시 우선으로 처리
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // 캐시에서 찾으면 반환
                if (response) {
                    return response;
                }

                // 캐시에 없으면 네트워크에서 가져옴
                return fetch(event.request)
                    .then((networkResponse) => {
                        // 성공적인 응답만 캐시에 저장
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('네트워크 요청 실패:', error);
                        // 네트워크 실패 시 기본 페이지 반환
                        if (event.request.destination === 'document') {
                            return caches.match('/');
                        }
                        return new Response('', { status: 404 });
                    });
            })
    );
});

// 푸시 알림 처리
self.addEventListener('push', (event) => {
    console.log('푸시 알림 수신:', event);

    let notificationData = {
        title: 'YouTube 댓글 대시보드',
        body: '새로운 댓글이 등록되었습니다!',
        icon: '/favicon.ico'
    };

    // 데이터가 있으면 파싱
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = { ...notificationData, ...data };
        } catch {
            notificationData.body = event.data.text();
        }
    }

    const options = {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1,
            url: '/'
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
        ],
        requireInteraction: false,
        silent: false
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
    console.log('알림 클릭:', event.action);

    event.notification.close();

    if (event.action === 'explore' || !event.action) {
        // 앱을 열거나 포커스
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                // 이미 열린 창이 있는지 확인
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes('/') && 'focus' in client) {
                        return client.focus();
                    }
                }

                // 새 창 열기
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

// 서비스 워커 메시지 처리
self.addEventListener('message', (event) => {
    console.log('Service Worker 메시지 수신:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
}); 