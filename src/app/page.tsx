'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, Student, UserSession } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import LoginForm from '../components/LoginForm';
import { LogOut, User, Building2, Moon, Sun, ArrowLeft, GraduationCap } from 'lucide-react';

export default function Home() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [currentView, setCurrentView] = useState<'login' | 'portal' | 'teacher' | 'student' | 'student-select'>('login');
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showTeacherTypeSelector, setShowTeacherTypeSelector] = useState(false);
  const [teacherType, setTeacherType] = useState<'elementary' | 'junior_high' | 'high_school'>('junior_high');
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize session and student list
  useEffect(() => {
    const curSession = db.getSession();
    if (curSession) {
      setSession(curSession);
      setCurrentView('teacher');
    } else {
      setCurrentView('login');
    }
    setStudentsList(db.getStudents());
    setIsInitializing(false);
  }, []);

  // Reload students on view change
  useEffect(() => {
    setStudentsList(db.getStudents());
  }, [currentView]);

  // Set theme on body element
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    setCurrentView('teacher');
  };

  const handleLogout = async () => {
    await db.signOut();
    setSession(null);
    setSelectedStudentId('');
    setShowTeacherTypeSelector(false);
    setCurrentView('login');
  };

  const handleStudentLogin = () => {
    if (!selectedStudentId) {
      alert('生徒を選択してください。');
      return;
    }
    const student = studentsList.find(s => s.id === selectedStudentId);
    if (student) {
      const freshStudent = db.getStudents().find(s => s.id === student.id);
      setCurrentView('student');
    }
  };

  // Back to portal / login
  const handleBackToPortal = () => {
    if (session) {
      if (session.user.role === 'branch') {
        setCurrentView('teacher');
      } else {
        setCurrentView('portal');
      }
    } else {
      setCurrentView('login');
    }
    setSelectedStudentId('');
    setShowTeacherTypeSelector(false);
  };

  const containerClass = `${styles.container} ${theme === 'dark' ? styles.darkTheme : ''}`;
  const selectedStudent = studentsList.find(s => s.id === selectedStudentId);

  // Loading state
  if (isInitializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>読み込み中...</span>
      </div>
    );
  }

  // 1. Unauthenticated or Login Screen
  if (currentView === 'login' && !session) {
    return (
      <LoginForm
        onLoginSuccess={handleLoginSuccess}
        onStudentEntry={() => setCurrentView('student-select')}
        theme={theme}
      />
    );
  }

  // 2. Student Selection Direct Mode (Accessible from login or portal)
  if (currentView === 'student-select') {
    return (
      <div className={containerClass}>
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <button
            onClick={() => setCurrentView(session ? (session.user.role === 'branch' ? 'teacher' : 'portal') : 'login')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} />
            {session ? 'ポータルへ戻る' : 'ログイン画面へ戻る'}
          </button>
        </div>

        <main className={styles.card} style={{ maxWidth: '480px' }}>
          <div className={styles.logo}>TENTORU</div>
          <div className={styles.subtitle}>生徒用学習画面（すごろくマップ・Todo）</div>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              受講する生徒を選択してください。
            </div>

            <div className={styles.studentSelectArea}>
              <select 
                value={selectedStudentId} 
                onChange={e => setSelectedStudentId(e.target.value)}
                className={styles.select}
                data-testid="student-select-dropdown"
              >
                <option value="">-- 生徒を選択 --</option>
                {studentsList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
                ))}
              </select>

              <button 
                onClick={handleStudentLogin}
                className={styles.select}
                data-testid="enter-student-btn"
                style={{ background: 'var(--primary)', color: '#ffffff', border: 'none', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', padding: '12px' }}
              >
                生徒画面へ入る ➔
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. Teacher / Branch Dashboard
  if (currentView === 'teacher') {
    return (
      <div className={theme === 'dark' ? 'dark-mode' : ''} style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <TeacherDashboard 
          onBackToPortal={handleBackToPortal} 
          onLogout={handleLogout}
          theme={theme} 
          teacherType={teacherType}
          initialRole={session?.user?.role || 'admin'}
          initialBranchId={session?.user?.branch_id || undefined}
        />
      </div>
    );
  }

  // 4. Student Dashboard
  if (currentView === 'student' && selectedStudent) {
    return (
      <div className={theme === 'dark' ? 'dark-mode' : ''} style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <StudentDashboard student={selectedStudent} onBackToPortal={handleBackToPortal} theme={theme} />
      </div>
    );
  }

  // 5. Admin Portal Screen (Headquarters / Admin Session)
  return (
    <div className={containerClass}>
      {/* Top Header Actions */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Current user badge */}
        {session && (
          <div
            data-testid="logged-in-user-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.85)',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#334155'
            }}
          >
            <User size={15} color="#4f46e5" />
            <span>{session.user.name || session.user.email}</span>
            <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: session.user.role === 'admin' ? '#e0e7ff' : '#dbeafe', color: session.user.role === 'admin' ? '#4338ca' : '#1e40af' }}>
              {session.user.role === 'admin' ? '本部' : '校舎'}
            </span>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          data-testid="portal-logout-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#dc2626',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          <LogOut size={15} />
          ログアウト
        </button>

        {/* Theme Toggle Button */}
        <button onClick={toggleTheme} className={styles.themeToggle} style={{ position: 'static' }}>
          {theme === 'light' ? (
            <>
              <Moon size={14} />
              ダークモードにする
            </>
          ) : (
            <>
              <Sun size={14} />
              ライトモードにする
            </>
          )}
        </button>
      </div>

      <main className={styles.card}>
        <div className={styles.logo}>TENTORU</div>
        <div className={styles.subtitle}>個別最適化・学習管理 司令塔システム</div>

        <div className={styles.rolesGrid}>
          {/* Teacher login option */}
          <div className={styles.roleCard} style={{ minHeight: '260px', cursor: showTeacherTypeSelector ? 'default' : 'pointer' }}>
            {!showTeacherTypeSelector ? (
              <div onClick={() => setShowTeacherTypeSelector(true)} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className={styles.roleIcon}>
                  <Building2 size={24} color="#4f46e5" />
                </div>
                <div className={styles.roleTitle}>講師・管理者</div>
                <div className={styles.roleDesc}>
                  生徒のアカウント発行、学習計画（時間割・スタート位置）調整、校舎管理、カリキュラム順序変更、模試判定、AI指導報告書の作成を行います。
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>対象の学年区分を選択</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowTeacherTypeSelector(false); }} 
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', padding: '4px' }}
                  >
                    戻る
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  <button 
                    onClick={() => { setTeacherType('elementary'); setCurrentView('teacher'); }} 
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', padding: '10px 14px', width: '100%', fontSize: '0.85rem' }}
                    id="teacher-select-elementary"
                  >
                    小学生
                  </button>
                  <button 
                    onClick={() => { setTeacherType('junior_high'); setCurrentView('teacher'); }} 
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', padding: '10px 14px', width: '100%', fontSize: '0.85rem' }}
                    id="teacher-select-junior-high"
                  >
                    中学生
                  </button>
                  <button 
                    onClick={() => { setTeacherType('high_school'); setCurrentView('teacher'); }} 
                    style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', padding: '10px 14px', width: '100%', fontSize: '0.85rem' }}
                    id="teacher-select-high-school"
                  >
                    高校生
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Student login option */}
          <div className={styles.roleCard} style={{ cursor: 'default' }}>
            <div className={styles.roleIcon}>
              <GraduationCap size={24} color="#0f766e" />
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
