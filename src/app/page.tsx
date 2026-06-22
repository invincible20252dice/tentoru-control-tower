'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, Student } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';

export default function Home() {
  const [currentView, setCurrentView] = useState<'portal' | 'teacher' | 'student'>('portal');
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load students for selector
  useEffect(() => {
    // 最初のロード時にLocalStorageデータを取得
    setStudentsList(db.getStudents());
  }, [currentView]);

  // Set theme on body element
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  const handleStudentLogin = () => {
    if (!selectedStudentId) {
      alert('生徒を選択してください。');
      return;
    }
    const student = studentsList.find(s => s.id === selectedStudentId);
    if (student) {
      // ロードデータを最新にするためにDBから再取得
      const freshStudent = db.getStudents().find(s => s.id === student.id);
      setCurrentView('student');
    }
  };

  // 講師ビューに入る
  const handleTeacherLogin = () => {
    setCurrentView('teacher');
  };

  // ポータルに戻る
  const handleBackToPortal = () => {
    setCurrentView('portal');
    setSelectedStudentId('');
  };

  const containerClass = `${styles.container} ${theme === 'dark' ? styles.darkTheme : ''}`;
  const selectedStudent = studentsList.find(s => s.id === selectedStudentId);

  // 講師ダッシュボード表示
  if (currentView === 'teacher') {
    return (
      <div className={theme === 'dark' ? 'dark-mode' : ''} style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <TeacherDashboard onBackToPortal={handleBackToPortal} theme={theme} />
      </div>
    );
  }

  // 生徒ダッシュボード表示
  if (currentView === 'student' && selectedStudent) {
    return (
      <div className={theme === 'dark' ? 'dark-mode' : ''} style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <StudentDashboard student={selectedStudent} onBackToPortal={handleBackToPortal} theme={theme} />
      </div>
    );
  }

  // ポータル画面表示
  return (
    <div className={containerClass}>
      {/* Theme Toggle Button */}
      <button onClick={toggleTheme} className={styles.themeToggle}>
        {theme === 'light' ? (
          <>
            {/* Moon Icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            ダークモードにする
          </>
        ) : (
          <>
            {/* Sun Icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            ライトモードにする
          </>
        )}
      </button>

      <main className={styles.card}>
        <div className={styles.logo}>TENTORU</div>
        <div className={styles.subtitle}>個別最適化・学習管理 司令塔システム</div>

        <div className={styles.rolesGrid}>
          {/* Teacher login option */}
          <div className={styles.roleCard} onClick={handleTeacherLogin}>
            <div className={styles.roleIcon}>
              {/* Teacher/Clipboard Icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </div>
            <div className={styles.roleTitle}>講師・管理者</div>
            <div className={styles.roleDesc}>
              生徒のアカウント発行、学習計画（時間割・スタート位置）調整、カリキュラム順序変更、模試判定、AI指導報告書の作成を行います。
            </div>
          </div>

          {/* Student login option */}
          <div className={styles.roleCard} style={{ cursor: 'default' }}>
            <div className={styles.roleIcon}>
              {/* Student/Book Icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div className={styles.roleTitle}>生徒（学習画面）</div>
            <div className={styles.roleDesc}>
              今日の時間割（Todo）、すごろくマップ、印刷物教材へのリンクを確認・受講します。
            </div>
            
            <div className={styles.studentSelectArea}>
              <select 
                value={selectedStudentId} 
                onChange={e => setSelectedStudentId(e.target.value)}
                className={styles.select}
              >
                <option value="">-- 生徒を選択 --</option>
                {studentsList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
                ))}
              </select>
              <button 
                onClick={handleStudentLogin}
                className={styles.select}
                style={{ background: 'var(--primary)', color: '#ffffff', border: 'none', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}
              >
                生徒画面へ入る ➔
              </button>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          個別最適化・学習管理型システム - Tentoru Control Tower v1.0.0
        </div>
      </main>
    </div>
  );
}
