// -----------------------------------------------------------------
// 파일 2: 메인 대시보드 페이지 컴포넌트
// 경로: src/app/page.tsx (또는 src/app/dashboard/page.tsx)
// -----------------------------------------------------------------
'use client'; // 이 컴포넌트는 클라이언트 측에서 렌더링되고 동작합니다.

import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

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

  // 다크모드 초기화 (localStorage에서 읽기)
  useEffect(() => {
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
  }, []);

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
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    const theme = newDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
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

  // useEffect hook을 사용하여 컴포넌트가 처음 렌더링될 때 데이터를 가져옵니다.
  useEffect(() => {
    fetchComments();
  }, []); // 빈 배열을 전달하여 최초 1회만 실행

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
  const renderComment = (comment: Comment & { replies: Comment[] }, depth = 0) => (
    <div key={comment.comment_id} className={styles.commentCard} style={{ marginLeft: `${depth * 20}px` }}>
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerControls}>
            <button
              onClick={toggleDarkMode}
              className={styles.themeToggle}
              title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <h1 className={styles.title}>?누가 윤서한테 악플씀?</h1>
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
    </div>
  );
}