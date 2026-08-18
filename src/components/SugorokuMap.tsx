import React, { useState, useEffect } from 'react';
import styles from './SugorokuMap.module.css';
import { db, CurriculumUnit, LearningTask, CurriculumMaster, Student } from '../lib/db';

export interface SugorokuMapProps {
  subject?: string;
  subjects?: string[];
  student?: Student;
  units?: CurriculumUnit[];
  tasks?: LearningTask[];
  todayTasks?: LearningTask[];
  theme?: 'light' | 'dark';
  onSelectSubject?: (sub: string) => void;
}

export default function SugorokuMap({
  subject,
  subjects,
  student,
  units = [],
  tasks = [],
  todayTasks = [],
  theme = 'light',
  onSelectSubject
}: SugorokuMapProps) {
  // Determine available subjects
  const defaultSubjects = student?.grade?.startsWith('小')
    ? ['算数', '国語', '英語', '理科', '社会']
    : ['数学', '英語', '国語', '理科', '社会'];

  const availableSubjects = (subjects && subjects.length > 0)
    ? subjects
    : (student?.selected_subjects && student.selected_subjects.length > 0)
      ? student.selected_subjects
      : (subject ? [subject] : defaultSubjects);

  const [activeSubject, setActiveSubject] = useState<string>(() => subject || availableSubjects[0] || '数学');
  const [mastersList, setMastersList] = useState<CurriculumMaster[]>(() => db.getCurriculumMasters(subject || availableSubjects[0]));

  useEffect(() => {
    if (subject && subject !== activeSubject) {
      setActiveSubject(subject);
    }
  }, [subject]);

  useEffect(() => {
    // Load curriculum masters for the active subject
    const cached = db.getCurriculumMasters(activeSubject);
    setMastersList(cached);

    // Also async fetch if available
    db.fetchCurriculumMasters(activeSubject).then(fetched => {
      if (fetched && fetched.length > 0) {
        setMastersList(fetched);
      }
    }).catch(err => {
      console.warn('fetchCurriculumMasters error:', err);
    });
  }, [activeSubject]);

  // 当該教科の単元・マスターリスト
  // curriculum_masters があればそれを優先、なければ units を使用
  const currentSubjectMasters = mastersList
    .filter(m => m.subject === activeSubject)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const fallbackUnits = units
    .filter(u => u.subject === activeSubject)
    .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));

  const useMasters = currentSubjectMasters.length > 0;
  const nodes = useMasters
    ? currentSubjectMasters.map(m => ({
        id: m.id,
        name: m.lesson_name || m.unit_name,
        fullTitle: `${m.unit_name ? m.unit_name + ' ' : ''}${m.lesson_name || ''}`,
        sortOrder: m.sort_order || 0
      }))
    : fallbackUnits.map(u => ({
        id: u.id,
        name: u.name,
        fullTitle: u.name,
        sortOrder: u.sequence_order || 0
      }));

  // 学生のタスクをマッピング (キー: unit_id / start_lesson_id)
  const taskMap = new Map<string, LearningTask>();
  tasks.forEach(t => {
    if (t.unit_id) taskMap.set(t.unit_id, t);
    if (t.start_lesson_id) taskMap.set(t.start_lesson_id, t);
    if (t.end_lesson_id) taskMap.set(t.end_lesson_id, t);
  });

  // 本日のタスク情報 (今日の挑戦中範囲)
  const subjectTodayTasks = todayTasks.filter(t => t.subject === activeSubject || (!t.subject && activeSubject === '数学'));

  // 現在の「プレイヤーの位置」を計算
  let playerNodeId: string | null = null;
  let playerSubStep: 'video' | 'test' | null = null;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const task = taskMap.get(node.id) || tasks.find(t => 
      t.subject === activeSubject && 
      (t.custom_unit_name?.includes(node.name) || t.lesson_range?.includes(node.name) || t.start_lesson_name === node.name)
    );
    
    if (!task) {
      playerNodeId = node.id;
      playerSubStep = 'video';
      break;
    }

    if (task.status === 'skipped') {
      continue;
    }

    if (!task.video_watched && task.status !== 'completed') {
      playerNodeId = node.id;
      playerSubStep = 'video';
      break;
    }

    if (!task.test_passed && task.status !== 'completed') {
      playerNodeId = node.id;
      playerSubStep = 'test';
      break;
    }
  }

  // もし全てクリアしているなら、プレイヤー位置は最後
  if (!playerNodeId && nodes.length > 0) {
    const lastNode = nodes[nodes.length - 1];
    playerNodeId = lastNode.id;
    playerSubStep = 'test';
  }

  const containerClass = `${styles.container} ${theme === 'dark' ? styles.darkTheme : ''}`;

  return (
    <div className={containerClass}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {/* Map Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
          {activeSubject}の学習マップ
        </h3>
        <span className={styles.badge}>すごろく進捗</span>
      </div>

      {/* Subject Tabs */}
      {availableSubjects.length > 0 && (
        <div className={styles.subjectTabs} data-testid="sugoroku-subject-tabs">
          {availableSubjects.map(sub => {
            const isActive = sub === activeSubject;
            return (
              <button
                key={sub}
                type="button"
                className={`${styles.subjectTab} ${isActive ? styles.subjectTabActive : ''}`}
                onClick={() => {
                  setActiveSubject(sub);
                  if (onSelectSubject) onSelectSubject(sub);
                }}
              >
                {sub === '算数' && '🧮 '}
                {sub === '数学' && '📐 '}
                {sub === '英語' && '🌍 '}
                {sub === '国語' && '📖 '}
                {sub === '理科' && '🔬 '}
                {sub === '社会' && '🏛️ '}
                {sub}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.mapWrapper}>
        {/* SVG track path background (decorative) */}
        <svg className={styles.svgTrack}>
          <path 
            d="M 50 80 Q 200 20 400 80 T 750 80" 
            className={styles.trackPath}
          />
        </svg>

        <div className={styles.nodesContainer}>
          {nodes.map((node, index) => {
            const task = taskMap.get(node.id) || tasks.find(t => 
              t.subject === activeSubject && 
              (t.custom_unit_name?.includes(node.name) || t.lesson_range?.includes(node.name) || t.start_lesson_name === node.name)
            );

            const isSkipped = task?.status === 'skipped';
            const isCompleted = task?.status === 'completed' || task?.test_passed === true;
            const isVideoWatched = task?.video_watched || isCompleted;
            const isTestPassed = task?.test_passed || isCompleted;

            // Check if this node is in today's task range
            const isTodayTask = subjectTodayTasks.some(tt => {
              if (tt.unit_id === node.id || tt.start_lesson_id === node.id || tt.end_lesson_id === node.id) return true;
              if (tt.lesson_range?.includes(node.name) || tt.custom_unit_name?.includes(node.name) || tt.start_lesson_name === node.name || tt.end_lesson_name === node.name) return true;
              return false;
            });

            // 各ステップ（ビデオ、テスト）の表示ステータス
            let videoClass = styles.stepCircle;
            let testClass = styles.stepCircle;

            if (isSkipped) {
              videoClass += ` ${styles.stepSkipped}`;
              testClass += ` ${styles.stepSkipped}`;
            } else if (isCompleted) {
              videoClass += ` ${styles.stepCompleted}`;
              testClass += ` ${styles.stepCompleted}`;
            } else if (isTodayTask) {
              videoClass += ` ${styles.stepToday}`;
              testClass += ` ${styles.stepToday}`;
            } else {
              if (isVideoWatched) {
                videoClass += ` ${styles.stepCompleted}`;
              } else if (playerNodeId === node.id && playerSubStep === 'video') {
                videoClass += ` ${styles.stepWatchedOnly}`; // 進行中の動画アニメーション
              } else {
                videoClass += ` ${styles.stepUnstarted}`;
              }

              if (isTestPassed) {
                testClass += ` ${styles.stepCompleted}`;
              } else if (playerNodeId === node.id && playerSubStep === 'test') {
                testClass += ` ${styles.stepWatchedOnly}`;
              } else {
                testClass += ` ${styles.stepUnstarted}`;
              }
            }

            const isCurrentNode = playerNodeId === node.id || isTodayTask;

            return (
              <div 
                key={node.id} 
                className={`${styles.nodeCard} ${isCurrentNode ? styles.activeNode : ''}`}
              >
                <div className={styles.nodeSteps}>
                  {/* Video Node */}
                  <div className={videoClass} title={`${node.fullTitle} - 動画視聴`}>
                    影
                    <span className={styles.stepLabel}>動画</span>
                    {isCurrentNode && playerSubStep === 'video' && (
                      <div className={styles.activePlayer} />
                    )}
                  </div>

                  {/* Test Node */}
                  <div className={testClass} title={`${node.fullTitle} - テスト合格`}>
                    試
                    <span className={styles.stepLabel}>テスト</span>
                    {isCurrentNode && (playerSubStep === 'test' || isTodayTask) && (
                      <div className={styles.activePlayer} />
                    )}
                  </div>
                </div>

                <div className={styles.nodeName} title={node.fullTitle}>
                  {index + 1}. {node.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }} />
          <span>🟢 クリア（合格）</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }} />
          <span>🟠 本日の目標・挑戦中</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: '#f3f4f6', border: '2px solid #e5e7eb' }} />
          <span>⚪️ 未着手</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: '#e0e7ff', border: '2px dashed #c7d2fe' }} />
          <span>スキップ</span>
        </div>
      </div>
    </div>
  );
}
