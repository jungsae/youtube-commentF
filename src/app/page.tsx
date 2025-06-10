// -----------------------------------------------------------------
// 파일 2: 메인 대시보드 페이지 컴포넌트
// 경로: src/app/page.tsx (또는 src/app/dashboard/page.tsx)
// -----------------------------------------------------------------
'use client'; // 이 컴포넌트는 클라이언트 측에서 렌더링되고 동작합니다.

import { useState, useEffect, useRef } from 'react';
import { supabase as supabaseClient } from '../lib/supabaseClient'; // 위에서 설정한 클라이언트 가져오기
import styles from './page.module.css'; // CSS 모듈 import

// 댓글 데이터의 타입을 정의합니다. (실제 Supabase 테이블 스키마와 일치)
interface Comment {
  comment_id: string;       // 기본키
  author: string;
  text: string;
  published_at: string;
  like_count: number;
  parent_id: string | null; // 대댓글의 경우 부모 댓글 ID
  is_reply: boolean;        // 댓글인지 대댓글인지 구분
  is_deleted: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

// 메인 페이지 컴포넌트
export default function DashboardPage() {
  // React의 state hook을 사용하여 상태 관리
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  // 필터링 관련 상태
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'deleted'>('all');
  const [searchText, setSearchText] = useState('');

  // 더 보기 기능 관련 상태
  const [visibleCommentCount, setVisibleCommentCount] = useState(10);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // 다크모드 상태 관리
  const [isDarkMode, setIsDarkMode] = useState(true); // 기본값을 다크모드로 변경

  // 정렬 순서 상태 관리
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // 실시간 알림 관련 상태
  const [newCommentsCount, setNewCommentsCount] = useState(0);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('연결 중...');
  const [newCommentIds, setNewCommentIds] = useState<string[]>([]); // 새 댓글 ID 목록

  // 채널 관리를 위한 ref (중복 구독 방지)
  const channelRef = useRef<ReturnType<typeof supabaseClient.channel> | null>(null);
  const isSubscribedRef = useRef(false);

  // 다크모드 초기화 (localStorage에서 읽기)
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        setIsDarkMode(false);
        document.documentElement.setAttribute('data-theme', 'light');
      } else if (savedTheme === 'dark') {
        setIsDarkMode(true);
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        // 저장된 설정이 없으면 기본 다크모드
        setIsDarkMode(true);
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
    } catch (error) {
      console.warn('⚠️ localStorage 접근 실패, 기본 다크모드 적용:', error);
      setIsDarkMode(true);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
  }, []);

  // 서비스 워커 등록 및 알림 권한 요청 (자동 활성화)
  useEffect(() => {
    // 서비스 워커 등록 (모바일 호환성 체크)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('✅ 서비스 워커 등록 성공:', registration);
          })
          .catch((error) => {
            console.warn('❌ 서비스 워커 등록 실패 (정상적인 현상일 수 있음):', error);
          });
      } catch (error) {
        console.warn('⚠️ 서비스 워커 등록 중 예외 발생:', error);
      }
    } else {
      console.log('ℹ️ 서비스 워커를 지원하지 않는 환경입니다.');
    }

    // 자동으로 알림 권한 요청 (모바일 호환성 체크)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'default') {
          Notification.requestPermission()
            .then(permission => {
              console.log('🔔 브라우저 알림 권한 결과:', permission);
            })
            .catch(error => {
              console.warn('⚠️ 알림 권한 요청 실패:', error);
            });
        } else {
          console.log('🔔 알림 권한 상태:', Notification.permission);
        }
      } catch (error) {
        console.warn('⚠️ 알림 기능 초기화 중 예외 발생:', error);
      }
    } else {
      console.log('ℹ️ 알림을 지원하지 않는 환경입니다.');
    }
  }, []);

  // 브라우저 알림 표시 함수 (모바일 호환성 강화)
  const showBrowserNotification = (comment: Comment) => {
    if (typeof window === 'undefined') return;

    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('새로운 댓글이 등록되었습니다!', {
          body: `${comment.author}: ${comment.text.slice(0, 50)}${comment.text.length > 50 ? '...' : ''}`,
          icon: '/favicon.ico',
          tag: 'new-comment'
        });

        // 5초 후 자동으로 닫기
        setTimeout(() => {
          try {
            notification.close();
          } catch (e) {
            console.warn('⚠️ 알림 닫기 실패:', e);
          }
        }, 5000);
      } else {
        console.log('ℹ️ 브라우저 알림을 사용할 수 없습니다. 권한:',
          'Notification' in window ? Notification.permission : '지원안함');
      }
    } catch (error) {
      console.warn('⚠️ 브라우저 알림 표시 실패:', error);
    }
  };

  // 토스트 알림 표시 함수
  const showToastNotification = (message: string) => {
    setToastNotification(message);
    setTimeout(() => setToastNotification(null), 3000);
  };

  // 스크롤 감지 (맨 위로 가기 버튼 표시용)
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setShowScrollToTop(scrollTop > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 다크모드 토글 함수
  const toggleDarkMode = () => {
    try {
      const newDarkMode = !isDarkMode;
      setIsDarkMode(newDarkMode);
      const theme = newDarkMode ? 'dark' : 'light';

      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('theme', theme);
      }
    } catch (error) {
      console.warn('⚠️ 다크모드 토글 실패:', error);
    }
  };

  // 맨 위로 가기 함수
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 더 보기 함수
  const loadMoreComments = () => {
    setVisibleCommentCount(prev => prev + 10);
  };

  // 데이터를 가져오는 함수
  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Supabase 'comments' 테이블에서 데이터를 가져옵니다.
      // is_deleted가 true인 것을 나중에, 그리고 published_at을 기준으로 내림차순 정렬 (최신순)
      const { data, error: fetchError } = await supabaseClient
        .from('comments')
        .select('*')
        .order('is_deleted', { ascending: true })
        .order('published_at', { ascending: false })
        .limit(100); // 한 번에 보여줄 댓글 수 제한

      if (fetchError) {
        throw new Error(`데이터베이스 오류: ${fetchError.message}`);
      }

      setComments(data || []);
      setLastRefreshed(new Date());
      setVisibleCommentCount(10); // 새로고침 시 카운트 초기화

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 클라이언트 마운트 확인
  useEffect(() => {
    setMounted(true);
  }, []);

  // useEffect hook을 사용하여 컴포넌트가 처음 렌더링될 때 데이터를 가져옵니다.
  useEffect(() => {
    if (mounted) {
      fetchComments();
    }
  }, [mounted]); // mounted 상태가 true가 될 때 실행

  // 실시간 구독 설정 (모바일 호환성 강화)
  useEffect(() => {
    if (!mounted) return; // 마운트되지 않으면 실행하지 않음

    // 이미 구독 중이면 중복 실행 방지
    if (isSubscribedRef.current) {
      console.log('🔄 이미 실시간 구독 중입니다. 중복 실행을 방지합니다.');
      return;
    }

    console.log('🔄 실시간 구독 설정 시작...');

    try {
      // 기존 채널이 있으면 먼저 정리
      if (channelRef.current) {
        console.log('🧹 기존 채널 정리 중...');
        try {
          supabaseClient.removeChannel(channelRef.current);
        } catch (cleanupError) {
          console.warn('⚠️ 기존 채널 정리 중 오류:', cleanupError);
        }
        channelRef.current = null;
      }

      // 고유한 채널 이름 생성 (중복 방지)
      const channelName = `comments-realtime-${Date.now()}-${Math.random()}`;
      console.log('📡 새 채널 생성:', channelName);

      // 구독 시작 표시
      isSubscribedRef.current = true;

      // 1. 채널 생성
      channelRef.current = supabaseClient
        .channel(channelName)
        .on(
          'postgres_changes', // 데이터베이스 변경 사항을 구독
          {
            event: 'INSERT', // INSERT 이벤트만 감지 (새로운 댓글만)
            schema: 'public',
            table: 'comments',
          },
          (payload) => {
            try {
              // 변경 사항이 감지되면 이 함수가 실행됩니다.
              console.log('🔔 새로운 댓글 감지!', payload);

              const newComment = payload.new as Comment;

              // 새로운 댓글을 상태에 추가
              setComments(prevComments => {
                console.log('📝 댓글 상태 업데이트:', newComment);
                const updatedComments = [newComment, ...prevComments];

                // 알림 카운트 증가 및 새 댓글 ID 추가
                setNewCommentsCount(prev => {
                  const newCount = prev + 1;
                  console.log('🔢 새 댓글 카운트:', newCount);
                  return newCount;
                });

                // 새 댓글 ID 목록에 추가
                setNewCommentIds(prev => [...prev, newComment.comment_id]);

                // 브라우저 알림 표시 (항상 활성화)
                showBrowserNotification(newComment);

                // 토스트 알림 표시
                const message = newComment.is_reply
                  ? `새로운 답글: ${newComment.author}님이 답글을 달았습니다.`
                  : `새로운 댓글: ${newComment.author}님이 댓글을 달았습니다.`;
                showToastNotification(message);

                return updatedComments;
              });
            } catch (payloadError) {
              console.warn('⚠️ 실시간 댓글 처리 중 오류:', payloadError);
            }
          }
        )
        .subscribe((status, err) => {
          try {
            // 구독 상태 변경 시 콜백
            console.log('📡 실시간 구독 상태:', status);

            if (status === 'SUBSCRIBED') {
              console.log('✅ comments 테이블 실시간 구독 성공!');
              setRealtimeStatus('연결됨');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ 구독 에러 상세:', {
                status,
                error: err,
                message: err?.message,
                fullError: JSON.stringify(err, null, 2)
              });
              setRealtimeStatus(`채널 오류: ${err?.message || '알 수 없는 오류'}`);
              // 에러 발생 시 구독 상태 초기화
              isSubscribedRef.current = false;
            } else if (status === 'TIMED_OUT') {
              console.warn('⏰ 실시간 구독 타임아웃');
              setRealtimeStatus('타임아웃');
              isSubscribedRef.current = false;
            } else if (status === 'CLOSED') {
              console.log('📴 실시간 구독 연결 종료');
              setRealtimeStatus('연결 종료');
              isSubscribedRef.current = false;
            } else {
              console.log('🔄 구독 상태 변경:', status);
              setRealtimeStatus(`연결 중... (${status})`);
            }
          } catch (statusError) {
            console.warn('⚠️ 구독 상태 처리 중 오류:', statusError);
            setRealtimeStatus('오류 발생');
            isSubscribedRef.current = false;
          }
        });

    } catch (subscriptionError) {
      console.error('❌ 실시간 구독 설정 중 오류:', subscriptionError);
      setRealtimeStatus('구독 실패');
      isSubscribedRef.current = false;
    }

    // 2. 컴포넌트가 언마운트될 때 채널 구독 해제 (메모리 누수 방지)
    return () => {
      try {
        if (channelRef.current) {
          console.log('🔌 실시간 구독 해제...');
          supabaseClient.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        isSubscribedRef.current = false;
      } catch (cleanupError) {
        console.warn('⚠️ 실시간 구독 해제 중 오류:', cleanupError);
      }
    };
  }, [mounted]); // mounted만 의존성으로 사용 (notificationsEnabled 제거)



  // 새 댓글 확인 함수
  const showNewComments = () => {
    if (newCommentIds.length === 0) return;

    try {
      // 새 댓글 목록을 콘솔에 출력 (디버깅용)
      console.log('🔍 새로 추가된 댓글들:', newCommentIds);

      // 토스트로 새 댓글 정보 표시
      const message = `새로운 댓글 ${newCommentsCount}개를 확인했습니다.`;
      showToastNotification(message);

      // 첫 번째 새 댓글로 스크롤
      if (typeof document !== 'undefined') {
        const firstNewCommentId = newCommentIds[0];
        const element = document.getElementById(`comment-${firstNewCommentId}`);
        if (element) {
          try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 잠깐 하이라이트 효과
            element.style.backgroundColor = isDarkMode ? '#4a5568' : '#e2e8f0';
            setTimeout(() => {
              try {
                element.style.backgroundColor = '';
              } catch (e) {
                console.warn('⚠️ 하이라이트 제거 실패:', e);
              }
            }, 2000);
          } catch (scrollError) {
            console.warn('⚠️ 스크롤 실패:', scrollError);
          }
        }
      }

      // 카운트와 ID 목록 초기화
      setNewCommentsCount(0);
      setNewCommentIds([]);
    } catch (error) {
      console.warn('⚠️ 새 댓글 확인 중 오류:', error);
    }
  };

  // 새 댓글 카운트 초기화 함수 (제목 클릭용)
  const resetNewCommentsCount = () => {
    setNewCommentsCount(0);
    setNewCommentIds([]);
  };



  // 날짜 포맷팅 함수
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('ko-KR');

  // 검색어 하이라이팅 함수
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className={styles.highlight}>{part}</mark>
      ) : part
    );
  };

  // 댓글을 트리 구조로 변환하는 함수
  const buildCommentTree = (comments: Comment[], sortOrder: 'newest' | 'oldest') => {
    const commentMap = new Map<string, Comment & { replies: Comment[] }>();
    const rootComments: (Comment & { replies: Comment[] })[] = [];

    // 모든 댓글을 맵에 저장하고 replies 배열 초기화
    comments.forEach(comment => {
      commentMap.set(comment.comment_id, { ...comment, replies: [] });
    });

    // 댓글과 답글을 연결
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.comment_id)!;

      if (comment.parent_id && commentMap.has(comment.parent_id)) {
        // 답글인 경우 부모 댓글의 replies 배열에 추가
        const parentComment = commentMap.get(comment.parent_id)!;
        parentComment.replies.push(commentWithReplies);
      } else {
        // 최상위 댓글인 경우 rootComments에 추가
        rootComments.push(commentWithReplies);
      }
    });

    // 정렬 함수 (newest = 최신순, oldest = 과거순)
    const sortComments = (comments: (Comment & { replies: Comment[] })[]) => {
      if (sortOrder === 'newest') {
        // 최신순: published_at 내림차순
        return comments.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
      } else {
        // 과거순: published_at 오름차순
        return comments.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());
      }
    };

    // 답글들을 정렬하는 재귀 함수 (답글은 항상 과거순)
    const sortReplies = (comment: Comment & { replies: Comment[] }) => {
      // 답글은 항상 과거순으로 정렬 (published_at 오름차순)
      comment.replies = comment.replies.sort((a, b) =>
        new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
      );
      // 재귀적으로 답글의 답글도 과거순으로 정렬
      comment.replies.forEach(reply => sortReplies(reply as Comment & { replies: Comment[] }));
    };

    // 루트 댓글들 정렬
    const sortedRootComments = sortComments(rootComments);

    // 모든 루트 댓글의 답글들 정렬
    sortedRootComments.forEach(comment => sortReplies(comment));

    return rootComments;
  };

  // 댓글 필터링 및 트리 구조 생성
  const filteredComments = comments.filter(comment => {
    // 상태 필터
    if (filterStatus === 'active' && comment.is_deleted) return false;
    if (filterStatus === 'deleted' && !comment.is_deleted) return false;

    // 텍스트 검색
    if (searchText && !comment.text.toLowerCase().includes(searchText.toLowerCase()) &&
      !comment.author.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }

    return true;
  });

  // 필터링된 댓글을 트리 구조로 변환
  const commentTree = buildCommentTree(filteredComments, sortOrder);

  // 댓글 렌더링 함수 (재귀적으로 답글도 렌더링)
  const renderComment = (comment: Comment & { replies: Comment[] }, depth = 0) => {
    const isNewComment = newCommentIds.includes(comment.comment_id);

    return (
      <div
        key={comment.comment_id}
        id={`comment-${comment.comment_id}`}
        className={`${styles.commentCard} ${isNewComment ? styles.newComment : ''}`}
        style={{ marginLeft: `${depth * 20}px` }}
      >
        <div className={comment.is_deleted ? styles.deletedComment : styles.activeComment}>
          <div className={styles.commentHeader}>
            <div className={styles.commentMeta}>
              <span className={styles.commentAuthor}>
                {highlightText(comment.author, searchText)}
              </span>
              <span className={styles.commentDate}>{formatDate(comment.published_at)}</span>
              <span className={styles.commentLikes}>👍 {comment.like_count.toLocaleString()}</span>
              {comment.is_deleted && <span className={styles.deletedBadge}>삭제됨</span>}
              {depth > 0 && <span className={styles.replyBadge}>답글</span>}
            </div>
          </div>
          <div className={styles.commentContent}>
            <div className={styles.commentText}>
              {highlightText(comment.text, searchText)}
            </div>
          </div>
          <div className={styles.commentFooter}>
            <span className={styles.commentLastSeen}>최근 확인: {formatDate(comment.last_seen_at)}</span>
          </div>
        </div>

        {/* 답글들 렌더링 */}
        {comment.replies.length > 0 && (
          <div className={styles.repliesContainer}>
            {comment.replies.map(reply => renderComment(reply as Comment & { replies: Comment[] }, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title} onClick={resetNewCommentsCount}>
            ?누가 윤서한테 악플씀?
            {newCommentsCount > 0 && (
              <span className={styles.titleBadge}>새로운 댓글 {newCommentsCount}개</span>
            )}
          </h1>
          <div className={styles.headerControls}>
            {newCommentsCount > 0 && (
              <button
                onClick={showNewComments}
                className={styles.notificationToggle}
                title={`새로운 댓글 ${newCommentsCount}개 확인하기`}
              >
                <span className={styles.notificationIcon}>🔔</span>
                <span className={styles.notificationBadge}>
                  {newCommentsCount > 99 ? '99+' : newCommentsCount}
                </span>
              </button>
            )}
            <button
              onClick={toggleDarkMode}
              className={styles.themeToggle}
              title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>

            <button
              onClick={fetchComments}
              disabled={loading}
              className={styles.button}
              title={loading ? '새로고침 중...' : '새로고침'}
            >
              {loading ? '⏳' : '🔄'}
            </button>
          </div>
        </div>
        <div className={styles.lastRefreshedText}>
          마지막 새로고침: {lastRefreshed ? formatDate(lastRefreshed.toISOString()) : 'N/A'}
          <span className={styles.realtimeStatus}> • 실시간 상태: {realtimeStatus}</span>
        </div>
      </header>

      {/* 필터링 및 검색 영역 */}
      <div className={styles.filterSection}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>상태:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'deleted')}
            className={styles.filterSelect}
          >
            <option value="all">전체</option>
            <option value="active">활성</option>
            <option value="deleted">삭제됨</option>
          </select>
        </div>



        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>검색:</label>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="작성자 또는 댓글 내용 검색..."
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>정렬:</label>
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className={styles.sortToggle}
            title={sortOrder === 'newest' ? '과거순으로 변경' : '최신순으로 변경'}
          >
            {sortOrder === 'newest' ? '🔽 최신순' : '🔼 과거순'}
          </button>
        </div>

        <div className={styles.resultCount}>
          총 {filteredComments.length}개 댓글 (전체 {comments.length}개)
        </div>
      </div>

      {error && <p className={styles.errorText}>오류: {error}</p>}

      <div className={styles.commentsContainer}>
        {commentTree.length > 0 ? (
          <>
            {commentTree.slice(0, visibleCommentCount).map(comment => renderComment(comment))}

            {/* 더 보기 버튼 */}
            {visibleCommentCount < commentTree.length && (
              <div className={styles.loadMoreContainer}>
                <button onClick={loadMoreComments} className={styles.loadMoreButton}>
                  더 보기 ({commentTree.length - visibleCommentCount}개 더 있음)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.noData}>
            {loading ? '댓글을 불러오는 중입니다...' : '표시할 댓글이 없습니다.'}
          </div>
        )}
      </div>

      {/* 맨 위로 가기 버튼 */}
      {showScrollToTop && (
        <button onClick={scrollToTop} className={styles.scrollToTopButton} title="맨 위로 가기">
          ⬆️
        </button>
      )}

      {/* 토스트 알림 */}
      {toastNotification && (
        <div className={styles.toastNotification}>
          <span className={styles.toastIcon}>🔔</span>
          <span className={styles.toastMessage}>{toastNotification}</span>
          <button
            onClick={() => setToastNotification(null)}
            className={styles.toastClose}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}