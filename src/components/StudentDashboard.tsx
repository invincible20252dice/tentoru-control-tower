import React, { useState, useEffect } from 'react';
import styles from './StudentDashboard.module.css';
import { db, Student, LearningTask, CurriculumUnit, LearningLog } from '../lib/db';
import SugorokuMap from './SugorokuMap';

interface StudentDashboardProps {
  student: Student;
  onBackToPortal: () => void;
  theme?: 'light' | 'dark';
}

export default function StudentDashboard({ student, onBackToPortal, theme = 'light' }: StudentDashboardProps) {
  const [tasks, setTasks] = useState<LearningTask[]>([]);
  const [units, setUnits] = useState<CurriculumUnit[]>([]);
  const [todayTasks, setTodayTasks] = useState<LearningTask[]>([]);
  const [currentDateStr, setCurrentDateStr] = useState<string>('2026-06-19'); // デモ用初期日付

  const loadData = () => {
    const allTasks = db.getLearningTasks();
    const allUnits = db.getCurriculumUnits();
    
    // 生徒のタスク
    const studentTasks = allTasks.filter(t => t.student_id === student.id);
    setTasks(studentTasks);
    setUnits(allUnits);

    // 今日のタスク (period があり、予定日が今日)
    const today = studentTasks.filter(t => t.scheduled_date === currentDateStr && t.period !== null);
    // period の昇順でソート
    today.sort((a, b) => (a.period || 0) - (b.period || 0));
    setTodayTasks(today);
  };

  useEffect(() => {
    loadData();
  }, [student.id, currentDateStr]);

  // 1. 動画視聴ボタンのアクション
  const handleWatchVideo = async (task: LearningTask) => {
    const updated: LearningTask = {
      ...task,
      video_watched: true,
      status: task.status === 'unstarted' ? 'unstarted' : task.status // video_watchedだけでステータスは即時完了にはならない
    };
    
    // DB (LocalStorage) に保存
    await db.saveLearningTasks([updated]);
    
    // ログを追加
    const log: LearningLog = {
      id: `log-${Date.now()}`,
      student_id: student.id,
      unit_id: task.unit_id,
      log_type: 'video_view',
      duration_seconds: 600, // 10分動画を見た
      created_at: new Date().toISOString()
    };
    await db.addLearningLog(log);

    loadData();
  };

  // 2. テスト受験ボタンのアクション (合格)
  const handlePassTest = async (task: LearningTask) => {
    const updated: LearningTask = {
      ...task,
      video_watched: true, // テスト合格時は自動で動画も見たとみなすか、前提
      test_passed: true,
      status: 'completed',
      actual_completed_date: currentDateStr
    };
    
    await db.saveLearningTasks([updated]);

    // ログを追加
    const log: LearningLog = {
      id: `log-${Date.now()}`,
      student_id: student.id,
      unit_id: task.unit_id,
      log_type: 'test_result',
      score: 95,
      total_questions: 10,
      incorrect_genres: [],
      created_at: new Date().toISOString()
    };
    await db.addLearningLog(log);

    // 爆速判定を自動で呼び出す (もし今週の目標をクリアしたか？)
    // テントルの講師ダッシュボード等で更新されるが、ここでも体験のために呼び出す
    const allCurrentTasks = db.getLearningTasks();
    const studentTasks = allCurrentTasks.filter(t => t.student_id === student.id);
    
    // 今週期限を 6/21 (日) と仮定
    const weekEndDate = '2026-06-21';
    const thisWeekTasks = studentTasks.filter(t => {
      const d = new Date(t.scheduled_date).getTime();
      const start = new Date(currentDateStr).getTime();
      const end = new Date(weekEndDate).getTime();
      return d >= start && d <= end;
    });

    const allCompletedThisWeek = thisWeekTasks.length > 0 && thisWeekTasks.every(t => t.status === 'completed');
    if (allCompletedThisWeek) {
      // 来週以降の未完了タスクを探す
      const futureTasks = studentTasks
        .filter(t => new Date(t.scheduled_date).getTime() > new Date(weekEndDate).getTime() && t.status !== 'completed' && t.status !== 'skipped')
        .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

      if (futureTasks.length > 0) {
        // 次のタスクを今日に前倒し
        const targetTask = futureTasks[0];
        const nextUpdated = {
          ...targetTask,
          scheduled_date: currentDateStr,
          period: 4 // 空いているコマ(例: 4時間目)にねじ込む
        };
        await db.saveLearningTasks([nextUpdated]);

        // 生徒を爆速に
        await db.saveStudent({
          ...student,
          status: 'fast'
        });

        alert('【爆速モード突入！】今週の目標を予定より早く達成したため、来週のタスクを自動で先取り（前倒し）しました！講師ダッシュボードに爆速アイコンが表示されます。');
      }
    }

    loadData();
  };

  // 3. テスト不合格時のアクション
  const handleFailTest = async (task: LearningTask) => {
    const updated = {
      ...task,
      status: 'failed' as const
    };
    await db.saveLearningTasks([updated]);

    const log: LearningLog = {
      id: `log-${Date.now()}`,
      student_id: student.id,
      unit_id: task.unit_id,
      log_type: 'test_result',
      score: 40, // 不合格点
      total_questions: 10,
      incorrect_genres: ['計算ミス', '符号の誤り'],
      created_at: new Date().toISOString()
    };
    await db.addLearningLog(log);

    loadData();
  };

  // 4. シミュレーター用の「2日連続未達成」を擬似発生させる関数
  const simulateTwoDaysFailure = async () => {
    // 過去2日間連続で未達成の予定だったという状況を作る
    // 17日と18日のタスクを強制的に未達成 (status = 'unstarted') に変更し、本日日付を19日にセットする
    const allCurrentTasks = db.getLearningTasks();
    const updated = allCurrentTasks.map(t => {
      if (t.student_id === student.id) {
        if (t.scheduled_date === '2026-06-18') {
          return { ...t, status: 'unstarted' as const, video_watched: false, test_passed: false };
        }
        if (t.scheduled_date === '2026-06-19') {
          return { ...t, status: 'unstarted' as const, video_watched: false, test_passed: false, period: 1 };
        }
      }
      return t;
    });

    await db.saveLearningTasks(updated);
    
    // 生徒ステータスもノーマルに戻す
    await db.saveStudent({
      ...student,
      status: 'normal'
    });

    alert('【シミュレーション】18日と19日のタスクを未完了に設定しました。講師ダッシュボード側で「自動リスケジュール」を実行すると、残りのタスク量に応じて自動再編または「計画パンクアラート」が発生します。');
    loadData();
  };

  // 5. シミュレーター用の「爆速前倒し」をテストする前状態に戻す関数
  const resetToNormalState = () => {
    // LocalStorageのモックデータを完全にリセット
    db.clearMockData();
    window.location.reload();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'fast':
        return <span className={`${styles.badge} ${styles.statusFast}`}>爆速中！🔥</span>;
      case 'warning':
        return <span className={`${styles.badge} ${styles.statusWarning}`}>計画パンク⚠️</span>;
      default:
        return <span className={`${styles.badge} ${styles.statusNormal}`}>通常進捗</span>;
    }
  };

  const dashboardClass = `${styles.dashboard} ${theme === 'dark' ? styles.darkTheme : ''}`;

  return (
    <div className={dashboardClass}>
      <div className={styles.header}>
        <div className={styles.studentInfo}>
          <h1>
            {/* Student Icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {student.name} さんの学習画面
          </h1>
          <div className={styles.studentMeta}>
            <span>学年: <strong className={styles.badge}>{student.grade}</strong></span>
            <span>ログインID: <code>{student.student_id}</code></span>
            <span>アカウント状況: {getStatusBadge(student.status)}</span>
          </div>
        </div>
        <button onClick={onBackToPortal} className={styles.backBtn}>
          {/* Back Icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          ログアウト（ポータルへ）
        </button>
      </div>

      <div className={styles.grid}>
        {/* Left Side: Todays Timetable */}
        <div className={styles.todoCard}>
          <h2 className={styles.sectionTitle}>
            {/* Clock Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            今日の時間割・タスク ({currentDateStr})
          </h2>

          {todayTasks.length === 0 ? (
            <div className={styles.emptyTimetable}>
              今日のコマ割り予定はありません。自習で動画視聴やテストを進めましょう。
            </div>
          ) : (
            <div className={styles.timetable}>
              {todayTasks.map(task => {
                const unit = units.find(u => u.id === task.unit_id);
                if (!unit) return null;

                return (
                  <div key={task.id} className={styles.periodRow}>
                    <div className={styles.periodNumber}>{task.period}</div>
                    <div className={styles.periodContent}>
                      <div className={styles.periodHeader}>
                        <span className={styles.subjectName}>{unit.subject}</span>
                        <div>
                          {task.status === 'completed' && <span className={`${styles.badge} ${styles.statusNormal}`}>合格完了！</span>}
                          {task.status === 'failed' && <span className={`${styles.badge} ${styles.statusWarning}`}>不合格 (再挑戦)</span>}
                        </div>
                      </div>
                      <div className={styles.unitName}>{unit.name}</div>

                      {/* Google Drive Link for printing materials */}
                      {unit.google_drive_url && (
                        <div>
                          <a 
                            href={unit.google_drive_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className={styles.printLink}
                          >
                            {/* Document Icon */}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                            授業教材（Googleドライブを印刷）
                          </a>
                        </div>
                      )}



                      {/* Student Tasks Actions */}
                      <div className={styles.actions}>
                        {!task.video_watched && task.status !== 'completed' ? (
                          <button 
                            onClick={() => handleWatchVideo(task)} 
                            className={`${styles.btn} ${styles.btnPrimary}`}
                          >
                            動画を視聴する (10分)
                          </button>
                        ) : (
                          task.status !== 'completed' && (
                            <span className={`${styles.btn} ${styles.btnSecondary}`} style={{ cursor: 'default' }}>
                              動画視聴済み
                            </span>
                          )
                        )}

                        {task.status !== 'completed' && (
                          <>
                            <button 
                              onClick={() => handlePassTest(task)} 
                              className={`${styles.btn} ${styles.btnSuccess}`}
                            >
                              単元テストを受ける (合格)
                            </button>
                            <button 
                              onClick={() => handleFailTest(task)} 
                              className={`${styles.btn} ${styles.btnSecondary}`}
                            >
                              テストを受ける (不合格)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* コマの最後に1つだけ今日の業務連絡を表示 */}
              {todayTasks.some(t => t.office_note) && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#fef3c7', borderRadius: '6px', borderLeft: '4px solid #d97706', fontSize: '0.85rem', color: '#78350f' }}>
                  <strong>💡 今日の業務連絡:</strong> {todayTasks.find(t => t.office_note)?.office_note}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Sugoroku Maps */}
        <div>
          {student.grade.startsWith('中') ? (
            <>
              <SugorokuMap subject="数学" units={units} tasks={tasks} theme={theme} />
              <SugorokuMap subject="英語" units={units} tasks={tasks} theme={theme} />
            </>
          ) : (
            <SugorokuMap subject="算数" units={units} tasks={tasks} theme={theme} />
          )}
        </div>

        {/* Bottom Simulation Panel */}
        <div className={styles.simPanel}>
          <h3 className={styles.simTitle}>
            {/* Settings Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            機能シミュレータ (デモ確認用)
          </h3>
          <div className={styles.simGrid}>
            <button onClick={simulateTwoDaysFailure} className={styles.simBtn}>
              <span className={styles.simBtnTitle}>⚠️ 2日連続未達成を作る</span>
              <span className={styles.simBtnDesc}>昨日・今日のタスクを未完了にし、自動リスケジュールの判定トリガーを満たします。</span>
            </button>
            <button onClick={resetToNormalState} className={styles.simBtn}>
              <span className={styles.simBtnTitle}>🔄 全データをリセット</span>
              <span className={styles.simBtnDesc}>LocalStorageの進捗状況や登録したデータを初期のデモデータに戻します。</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
