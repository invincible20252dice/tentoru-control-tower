'use client';

import React, { useState, useEffect } from 'react';
import { CurriculumUnit, Student, LearningTask, MiniTestResult, sanitizeCorruptedCompletedLessonIds } from '../lib/db';
import { isMatchingUnitOrTest } from '../lib/scheduler';

export interface TimelineSubjectViewProps {
  student: Student;
  subject: string;
  initialDate?: string;
  targetDate?: string;
  scheduleDate?: string;
  onDateChange?: (date: string) => void;
  timelineUnits?: CurriculumUnit[];
  studentTasks?: LearningTask[];
  miniTestResults?: MiniTestResult[];
  theme?: string;
  onExcludeLesson?: (id: string, name: string) => void;
  onOpenEditUnitTestModal?: (unit: any) => void;
  onDeleteUnitTestMaster?: (id: string) => void;
}

export default function TimelineSubjectView({
  student,
  subject,
  initialDate,
  targetDate,
  scheduleDate: propScheduleDate,
  onDateChange,
  timelineUnits = [],
  studentTasks = [],
  miniTestResults = [],
  theme = 'light',
  onExcludeLesson,
  onOpenEditUnitTestModal,
  onDeleteUnitTestMaster
}: TimelineSubjectViewProps) {
  // 動的初期化（ハードコード日付は一切使用しない）
  const [currentDate, setCurrentDate] = useState<string>(() => {
    if (targetDate) return targetDate;
    if (propScheduleDate) return propScheduleDate;
    if (initialDate) return initialDate;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryDate = urlParams.get('targetDate') || urlParams.get('date') || urlParams.get('scheduleDate');
      if (queryDate) return queryDate;
    }
    return new Date().toISOString().split('T')[0];
  });

  // 外部 props との同期
  useEffect(() => {
    const effective = targetDate || propScheduleDate || initialDate;
    if (effective && effective !== currentDate) {
      setCurrentDate(effective);
    }
  }, [targetDate, propScheduleDate, initialDate]);

  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  const handleSetToday = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    handleDateChange(todayStr);
  };

  // 教科の一致判定（算数・数学の相互互換を含む）
  const isTargetSubject = (sub?: string) => {
    if (!sub) return false;
    return sub === subject || 
      (subject === '算数' && sub === '数学') || 
      (subject === '数学' && sub === '算数');
  };

  // 選択日（currentDate）のアクティブタスク・単元テストの抽出
  const targetTasks = studentTasks.filter(t => isTargetSubject(t.subject));
  const activeTasksOnDate = targetTasks.filter(t => t.scheduled_date === currentDate && t.period !== null && t.status !== 'completed' && !t.test_passed);
  
  // スロットからレッスンIDを抽出
  const extractLessonIds = (task: any): string[] => {
    if (Array.isArray(task.lesson_ids) && task.lesson_ids.length > 0) {
      return task.lesson_ids.map((id: any) => String(id));
    }
    const ids: string[] = [];
    if (task.unit_id) ids.push(String(task.unit_id));
    if (task.start_lesson_id) ids.push(String(task.start_lesson_id));
    if (task.end_lesson_id) ids.push(String(task.end_lesson_id));
    return ids;
  };

  const todayActiveLessonIds = new Set<string>();
  activeTasksOnDate.forEach(task => {
    extractLessonIds(task).forEach(id => todayActiveLessonIds.add(id));
  });

  // 選択日の単元テスト枠（未合格のもの）
  const activeMiniTests = miniTestResults.filter(m => 
    m.student_id === student.id && 
    m.date === currentDate && 
    isTargetSubject(m.subject) &&
    !m.passed
  );

  activeMiniTests.forEach(test => {
    const matched = timelineUnits.find((u: any) => {
      const isUT = u.item_type === 'unit_test' || 
                   (u.lesson_name && (u.lesson_name.includes('単元確認テスト') || u.lesson_name.includes('単元テスト'))) ||
                   (u.name && (u.name.includes('単元確認テスト') || u.name.includes('単元テスト')));
      if (!isUT) return false;
      if (test.unit_name && (u.unit_name === test.unit_name || u.name === test.unit_name || isMatchingUnitOrTest(u.unit_name, test.unit_name))) return true;
      if (test.test_content && (u.lesson_name === test.test_content || u.name === test.test_content || isMatchingUnitOrTest(u.name, test.test_content))) return true;
      return false;
    });
    if (matched) {
      todayActiveLessonIds.add(String(matched.id));
      if ((matched as any).sort_order !== undefined) {
        todayActiveLessonIds.add(String((matched as any).sort_order));
      }
    }
  });

  // 受講完了レッスンID（サニタイズ適用）
  const rawCompletedIds = student.completed_lesson_ids || [];
  const { cleanedIds: sanitizedCompletedIds } = sanitizeCorruptedCompletedLessonIds(
    rawCompletedIds,
    {
      timelineUnits,
      activeLessonIds: todayActiveLessonIds,
      subject
    }
  );

  const completedLessonIdSet = new Set<string>(sanitizedCompletedIds.map(id => String(id).trim()));

  // 飛び石・中抜き受講防止ロジック
  const trulyCompletedStepIds = new Set<string>();
  let hasEncounteredIncomplete = false;

  for (let i = 0; i < timelineUnits.length; i++) {
    const step = timelineUnits[i];
    const stepIdStr = String(step.id);
    const stepOrderStr = (step as any).sort_order !== undefined ? String((step as any).sort_order) : '';

    if (hasEncounteredIncomplete) {
      continue;
    }

    const isMarkedDone = completedLessonIdSet.has(stepIdStr) || (stepOrderStr && completedLessonIdSet.has(stepOrderStr));
    if (isMarkedDone) {
      trulyCompletedStepIds.add(stepIdStr);
      if (stepOrderStr) trulyCompletedStepIds.add(stepOrderStr);
    } else {
      hasEncounteredIncomplete = true;
    }
  }

  return (
    <div data-testid="timeline-subject-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 動的日付ヘッダー */}
      <div 
        data-testid="timeline-header" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          padding: '12px 16px', 
          backgroundColor: '#f8fafc', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.9rem' }}>
            現在の日付: <strong style={{ color: '#4f46e5' }} data-testid="timeline-current-date-text">{currentDate}</strong>
          </div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>対象日付（コマ割り反映日）: </label>
          <input
            type="date"
            data-testid="timeline-schedule-date-picker"
            value={currentDate}
            onChange={e => handleDateChange(e.target.value)}
            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
          <button
            type="button"
            data-testid="timeline-today-btn"
            onClick={handleSetToday}
            style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            今日
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          生徒: <strong>{student.name}</strong> ({student.grade}) | 教科: <strong>{subject}</strong>
        </div>
      </div>

      {/* タイムラインステップ一覧 */}
      <div data-testid="timeline-steps-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {timelineUnits.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
            カリキュラムデータがありません。
          </div>
        ) : (
          timelineUnits.map((unit, idx) => {
            const stepNum = idx + 1;
            const uIdStr = String(unit.id);
            const uOrderStr = (unit as any).sort_order !== undefined ? String((unit as any).sort_order) : '';
            
            const isCompleted = trulyCompletedStepIds.has(uIdStr) || (uOrderStr && trulyCompletedStepIds.has(uOrderStr));
            const isTodayActive = todayActiveLessonIds.has(uIdStr) || (uOrderStr && todayActiveLessonIds.has(uOrderStr));
            const isCurrent = !isCompleted && isTodayActive;
            const isUnitTest = (unit as any).item_type === 'unit_test' || 
                               (unit.name && (unit.name.includes('単元確認テスト') || unit.name.includes('単元テスト')));

            return (
              <div
                key={unit.id || idx}
                data-testid={`timeline-step-${stepNum}`}
                data-step-status={isCompleted ? 'completed' : isCurrent ? 'current' : 'planned'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  backgroundColor: isCurrent ? '#eff6ff' : isCompleted ? '#f0fdf4' : '#ffffff',
                  border: isCurrent ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  boxShadow: isCurrent ? '0 2px 4px rgba(37, 99, 235, 0.15)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: isUnitTest ? '#8b5cf6' : (isCompleted ? '#22c55e' : (isCurrent ? '#2563eb' : '#cbd5e1')),
                      color: '#ffffff'
                    }}
                  >
                    STEP {stepNum}
                  </span>
                  {isUnitTest && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#f3e8ff',
                        color: '#7c3aed',
                        border: '1px solid #c084fc'
                      }}
                    >
                      📝 単元テスト
                    </span>
                  )}
                  <span style={{ fontSize: '0.88rem', fontWeight: isCurrent ? 800 : (isCompleted ? 600 : 500), color: isCurrent ? '#1d4ed8' : (isCompleted ? '#166534' : '#334155') }}>
                    {unit.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isCompleted ? (
                    <span style={{ fontSize: '0.78rem', backgroundColor: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '6px', fontWeight: 700 }}>
                      ✓ 完了
                    </span>
                  ) : isCurrent ? (
                    <span style={{ fontSize: '0.78rem', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: '6px', fontWeight: 800 }}>
                      📍 現在地（取り組み中）
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', backgroundColor: '#f1f5f9', color: '#64748b', padding: '3px 10px', borderRadius: '6px', fontWeight: 600 }}>
                      ○ 予定
                    </span>
                  )}

                  {isUnitTest && onOpenEditUnitTestModal && (
                    <button
                      type="button"
                      data-testid="timeline-edit-unittest-btn"
                      onClick={() => onOpenEditUnitTestModal(unit)}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      ✏️ 編集
                    </button>
                  )}
                  {isUnitTest && onDeleteUnitTestMaster && (
                    <button
                      type="button"
                      data-testid="timeline-delete-unittest-btn"
                      onClick={() => onDeleteUnitTestMaster(unit.id)}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      🗑️ テスト削除
                    </button>
                  )}
                  {onExcludeLesson && (
                    <button
                      type="button"
                      data-testid="timeline-exclude-btn"
                      data-test-unit-id={unit.id}
                      onClick={() => onExcludeLesson(unit.id, unit.name)}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      🗑️ 除外
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
