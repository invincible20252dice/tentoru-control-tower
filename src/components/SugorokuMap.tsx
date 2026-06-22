import React from 'react';
import styles from './SugorokuMap.module.css';
import { CurriculumUnit, LearningTask } from '../lib/db';

interface SugorokuMapProps {
  subject: string;
  units: CurriculumUnit[];
  tasks: LearningTask[];
  theme?: 'light' | 'dark';
}

export default function SugorokuMap({ subject, units, tasks, theme = 'light' }: SugorokuMapProps) {
  // 当該教科の単元をソート
  const subjectUnits = units
    .filter(u => u.subject === subject)
    .sort((a, b) => a.sequence_order - b.sequence_order);

  // 学生のタスクをマッピング (キー: unit_id)
  const taskMap = new Map<string, LearningTask>();
  tasks.forEach(t => {
    taskMap.set(t.unit_id, t);
  });

  // 現在の「プレイヤーの位置」を計算
  // 最後に完了した位置を特定し、その次の未着手または進行中マスを現在位置とする
  let playerUnitId: string | null = null;
  let playerSubStep: 'video' | 'test' | null = null;

  for (let i = 0; i < subjectUnits.length; i++) {
    const unit = subjectUnits[i];
    const task = taskMap.get(unit.id);
    
    if (!task) {
      playerUnitId = unit.id;
      playerSubStep = 'video';
      break;
    }

    if (task.status === 'skipped') {
      continue;
    }

    if (!task.video_watched) {
      playerUnitId = unit.id;
      playerSubStep = 'video';
      break;
    }

    if (!task.test_passed) {
      playerUnitId = unit.id;
      playerSubStep = 'test';
      break;
    }
  }

  // もし全てクリアしているなら、プレイヤー位置はなし
  if (!playerUnitId && subjectUnits.length > 0) {
    // 全てクリアした場合は最後のマスのテスト位置
    const lastUnit = subjectUnits[subjectUnits.length - 1];
    playerUnitId = lastUnit.id;
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
          {subject}の学習マップ
        </h3>
        <span className={styles.badge}>すごろく進捗</span>
      </div>

      <div className={styles.mapWrapper}>
        {/* SVG track path background (decorative) */}
        <svg className={styles.svgTrack}>
          <path 
            d="M 50 80 Q 200 20 400 80 T 750 80" 
            className={styles.trackPath}
          />
        </svg>

        <div className={styles.nodesContainer}>
          {subjectUnits.map((unit, index) => {
            const task = taskMap.get(unit.id);
            const isSkipped = task?.status === 'skipped';
            const isCompleted = task?.status === 'completed';
            const isVideoWatched = task?.video_watched || isCompleted;
            const isTestPassed = task?.test_passed || isCompleted;

            // 各ステップ（ビデオ、テスト）の表示ステータス
            let videoClass = styles.stepCircle;
            let testClass = styles.stepCircle;

            if (isSkipped) {
              videoClass += ` ${styles.stepSkipped}`;
              testClass += ` ${styles.stepSkipped}`;
            } else {
              if (isVideoWatched) {
                videoClass += ` ${styles.stepCompleted}`;
              } else if (playerUnitId === unit.id && playerSubStep === 'video') {
                videoClass += ` ${styles.stepWatchedOnly}`; // 進行中の動画アニメーション
              }

              if (isTestPassed) {
                testClass += ` ${styles.stepCompleted}`;
              } else if (playerUnitId === unit.id && playerSubStep === 'test') {
                // 動画視聴のみ終わっているなら、動画は完了、テストが次のターゲット
                testClass += ` ${styles.stepWatchedOnly}`;
              }
            }

            const isCurrentUnit = playerUnitId === unit.id;

            return (
              <div 
                key={unit.id} 
                className={`${styles.nodeCard} ${isCurrentUnit ? styles.activeNode : ''}`}
              >
                <div className={styles.nodeSteps}>
                  {/* Video Node */}
                  <div className={videoClass} title={`${unit.name} - 動画視聴`}>
                    影
                    <span className={styles.stepLabel}>動画</span>
                    {isCurrentUnit && playerSubStep === 'video' && (
                      <div className={styles.activePlayer} />
                    )}
                  </div>

                  {/* Test Node */}
                  <div className={testClass} title={`${unit.name} - テスト合格`}>
                    試
                    <span className={styles.stepLabel}>テスト</span>
                    {isCurrentUnit && playerSubStep === 'test' && (
                      <div className={styles.activePlayer} />
                    )}
                  </div>
                </div>

                <div className={styles.nodeName} title={unit.name}>
                  {index + 1}. {unit.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }} />
          <span>クリア（合格）</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} />
          <span>挑戦中・動画視聴完了</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: '#f3f4f6', border: '2px solid #e5e7eb' }} />
          <span>未着手</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: '#e0e7ff', border: '2px dashed #c7d2fe' }} />
          <span>スキップ</span>
        </div>
      </div>
    </div>
  );
}
