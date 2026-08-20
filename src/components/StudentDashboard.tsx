import React, { useState, useEffect } from 'react';
import styles from './StudentDashboard.module.css';
import { db, Student, LearningTask, CurriculumUnit, CurriculumMaster, LearningLog, MiniTestResult, HomeworkResult, StudentScheduleConfig } from '../lib/db';
import SugorokuMap from './SugorokuMap';
import { TestScoreRadarChart } from './TestScoreRadarChart';
import { WeeklyScheduleViewer } from './WeeklyScheduleViewer';
import { StudentScheduleConfigForm } from './StudentScheduleConfigForm';

interface StudentDashboardProps {
  student: Student;
  onBackToPortal: () => void;
  theme?: 'light' | 'dark';
  initialDate?: string;
}

export default function StudentDashboard({ student, onBackToPortal, theme = 'light', initialDate }: StudentDashboardProps) {
  const getSystemTodayStr = () => new Date().toISOString().split('T')[0];
  const systemTodayStr = getSystemTodayStr();

  const determineInitialDate = () => {
    if (initialDate) return initialDate;
    const todayStr = getSystemTodayStr();
    const stTasks = db.getLearningTasks().filter(t => t.student_id === student.id);
    const hasTodayTasks = stTasks.some(t => t.scheduled_date === todayStr && t.period !== null);
    const hasTodayTestsOrHw = db.getMiniTestResults().some(r => r.student_id === student.id && r.date === todayStr) ||
      db.getHomeworkResults().some(r => r.student_id === student.id && r.date === todayStr);
    if (hasTodayTasks || hasTodayTestsOrHw) return todayStr;
    const upcomingTasks = stTasks
      .filter(t => t.scheduled_date >= todayStr && t.period !== null)
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    if (upcomingTasks.length > 0) return upcomingTasks[0].scheduled_date;
    const allScheduledTasks = stTasks
      .filter(t => t.period !== null)
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
    if (allScheduledTasks.length > 0) return allScheduledTasks[0].scheduled_date;
    return todayStr;
  };

  const getLatestStudent = (): Student => {
    const dbSt = typeof db.getStudent === 'function' ? db.getStudent(student.id) : (typeof db.getStudents === 'function' ? db.getStudents().find(s => s.id === student.id) : null);
    return {
      ...(dbSt || {}),
      ...student,
      completed_lesson_ids: dbSt?.completed_lesson_ids || student.completed_lesson_ids
    };
  };

  const [currentStudent, setCurrentStudent] = useState<Student>(getLatestStudent);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    if (initialDate && initialDate !== currentDateStr) {
      setCurrentDateStr(initialDate);
      setHasAutoSelectedDate(true);
    }
  }, [initialDate]);

  useEffect(() => {
    setCurrentStudent(prev => {
      const latest = getLatestStudent();
      const mergedCompleted = Array.from(new Set([
        ...(prev?.completed_lesson_ids || []).map(String),
        ...(latest?.completed_lesson_ids || []).map(String),
        ...(student.completed_lesson_ids || []).map(String)
      ]));
      return {
        ...latest,
        ...student,
        completed_lesson_ids: mergedCompleted
      };
    });
  }, [student.id, student.grade, student.name, student.status]);

  const [currentDateStr, setCurrentDateStr] = useState<string>(determineInitialDate);
  const [hasAutoSelectedDate, setHasAutoSelectedDate] = useState<boolean>(Boolean(initialDate));
  const [tasks, setTasks] = useState<LearningTask[]>(() => db.getLearningTasks().filter(t => t.student_id === student.id));
  const [units, setUnits] = useState<CurriculumUnit[]>(() => db.getCurriculumUnits());
  const [curriculumMasters, setCurriculumMasters] = useState<CurriculumMaster[]>(() => db.getCurriculumMasters());
  const [todayTasks, setTodayTasks] = useState<LearningTask[]>(() => {
    const d = determineInitialDate();
    const stTasks = db.getLearningTasks().filter(t => t.student_id === student.id);
    const today = stTasks.filter(t => t.scheduled_date === d && t.period !== null);
    today.sort((a, b) => (a.period || 0) - (b.period || 0));
    return today;
  });
  const [showScheduleConfig, setShowScheduleConfig] = useState(false);
  const [miniTestResults, setMiniTestResults] = useState<MiniTestResult[]>(() => {
    const d = determineInitialDate();
    return db.getMiniTestResults().filter(r => r.student_id === student.id && r.date === d);
  });
  const [homeworkResults, setHomeworkResults] = useState<HomeworkResult[]>(() => {
    const d = determineInitialDate();
    return db.getHomeworkResults().filter(r => r.student_id === student.id && r.date === d);
  });
  const [studentScores, setStudentScores] = useState<Record<string, string>>({});
  const [scheduleConfig, setScheduleConfig] = useState<StudentScheduleConfig | undefined>(() => db.getStudentScheduleConfig(student.id));

  const loadData = async () => {
    const latestStudent = getLatestStudent();
    setCurrentStudent(latestStudent);

    let studentTasks: LearningTask[] = [];
    try {
      studentTasks = await db.fetchLearningTasks(student.id);
    } catch {
      studentTasks = db.getLearningTasks().filter(t => t.student_id === student.id);
    }
    const allUnits = db.getCurriculumUnits();
    let allMasters: CurriculumMaster[] = [];
    try {
      allMasters = await db.fetchCurriculumMasters();
    } catch {
      allMasters = db.getCurriculumMasters();
    }
    const config = db.getStudentScheduleConfig(student.id);
    setScheduleConfig(config);
    setTasks(studentTasks);
    setUnits(allUnits);
    setCurriculumMasters(allMasters);

    // 日付の決定ロジック
    let targetDate = currentDateStr;
    if (!hasAutoSelectedDate && !initialDate) {
      const todayStr = getSystemTodayStr();
      const hasTodayTasks = studentTasks.some(t => t.scheduled_date === todayStr && t.period !== null);
      if (hasTodayTasks) {
        targetDate = todayStr;
      } else {
        // 未来の通塾日を優先検索
        const upcomingTasks = studentTasks
          .filter(t => t.scheduled_date >= todayStr && t.period !== null)
          .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
        if (upcomingTasks.length > 0) {
          targetDate = upcomingTasks[0].scheduled_date;
        } else {
          // モックやテスト用など、全タスクの中で最新のコマ割り日を検索
          const allScheduledTasks = studentTasks
            .filter(t => t.period !== null)
            .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
          if (allScheduledTasks.length > 0) {
            targetDate = allScheduledTasks[0].scheduled_date;
          } else {
            targetDate = todayStr;
          }
        }
      }
      setCurrentDateStr(targetDate);
      setHasAutoSelectedDate(true);
    }

    // 今日のタスク (period があり、予定日が targetDate)
    const today = studentTasks.filter(t => t.scheduled_date === targetDate && t.period !== null);
    today.sort((a, b) => (a.period || 0) - (b.period || 0));
    setTodayTasks(today);

    // 小テスト結果
    let todayMini: MiniTestResult[] = [];
    try {
      todayMini = await db.fetchMiniTestResults(student.id, targetDate);
    } catch {
      todayMini = db.getMiniTestResults().filter(r => r.student_id === student.id && r.date === targetDate);
    }
    console.log("STUDENT_DASHBOARD_FILTER_DIAGNOSTICS:", {
      studentId: student.id,
      currentDateStr: targetDate,
      miniResultsCount: todayMini.length,
      todayMiniCount: todayMini.length,
      todayMiniItems: todayMini
    });
    setMiniTestResults(todayMini);
    
    const initialScores: Record<string, string> = {};
    todayMini.forEach(r => {
      initialScores[r.id] = r.score !== null && r.score !== undefined ? r.score.toString() : '';
    });
    setStudentScores(initialScores);

    // 宿題結果
    let todayHw: HomeworkResult[] = [];
    try {
      todayHw = await db.fetchHomeworkResults(student.id, targetDate);
    } catch {
      todayHw = db.getHomeworkResults().filter(r => r.student_id === student.id && r.date === targetDate);
    }
    setHomeworkResults(todayHw);
  };

  useEffect(() => {
    loadData();
  }, [student.id, student.level, currentDateStr]);

  // 1コマに含まれる授業ステップ（複数レッスン）の展開関数
  // 1コマに含まれる授業ステップ（複数レッスン）の展開関数
  const getTaskStepLessons = (task: LearningTask): Array<{ id: string; name: string; fullTitle: string }> => {
    const isElem = student.grade.startsWith('小') || student.grade === '園児';
    const isJhs = student.grade.startsWith('中');
    const isHs = student.grade.startsWith('高') || student.grade === '既卒';
    const taskSubject = task.subject || (units.find(u => u.id === task.unit_id)?.subject) || (isElem ? '算数' : '数学');

    const cleanStr = (s: string) => {
      if (!s) return '';
      return s.toLowerCase().replace(/[\s\-\_〜～~.・、。()（）「」『』:：]/g, '');
    };

    // 関連するカリキュラムマスターのリストを抽出
    let candidateMasters = curriculumMasters.filter(m => {
      const matchesSubject = m.subject === taskSubject || 
        (isElem && (m.subject === '算数' || (taskSubject === '算数' && m.subject === '数学'))) || 
        (!isElem && (m.subject === '数学' || (taskSubject === '数学' && m.subject === '算数')));
      return matchesSubject;
    });

    if (candidateMasters.length === 0 && curriculumMasters.length > 0) {
      candidateMasters = curriculumMasters;
    }

    // 学年での絞り込み（該当するものがあれば優先）
    const gradeExactMasters = candidateMasters.filter(m => m.grade === student.grade);
    const gradeCategoryMasters = candidateMasters.filter(m => {
      if (isElem && m.grade) return m.grade.startsWith('小') || m.grade === '園児';
      if (isJhs && m.grade) return m.grade.startsWith('中');
      if (isHs && m.grade) return m.grade.startsWith('高') || m.grade === '既卒';
      return true;
    });

    // 検索対象のリスト候補（段階的にフォールバック）
    const listsToTry = [
      gradeExactMasters.length > 0 ? gradeExactMasters : null,
      gradeCategoryMasters.length > 0 ? gradeCategoryMasters : null,
      candidateMasters.length > 0 ? candidateMasters : null,
      curriculumMasters.length > 0 ? curriculumMasters : null
    ].filter(Boolean) as typeof curriculumMasters[];

    const findIndexInList = (list: Array<{ id: string; sort_order?: number; name: string; fullTitle: string }>, targetId?: string, targetName?: string): number => {
      if (targetId) {
        const byId = list.findIndex(m => 
          m.id === targetId || 
          String(m.id) === String(targetId) || 
          (m.sort_order !== undefined && String(m.sort_order) === String(targetId))
        );
        if (byId >= 0) return byId;
      }
      if (targetName && targetName.trim()) {
        const raw = targetName.trim();
        const norm = cleanStr(raw);
        if (!norm) return -1;

        // 1. 完全一致
        const exact = list.findIndex(m => m.name === raw || m.fullTitle === raw);
        if (exact >= 0) return exact;

        // 2. 正規化一致
        const normMatch = list.findIndex(m => {
          const mNorm = cleanStr(m.name);
          const fNorm = cleanStr(m.fullTitle);
          return mNorm === norm || fNorm === norm || 
                 (mNorm.length >= 2 && norm.includes(mNorm)) || 
                 (norm.length >= 2 && mNorm.includes(norm)) ||
                 (fNorm.length >= 2 && norm.includes(fNorm)) ||
                 (norm.length >= 2 && fNorm.includes(norm));
        });
        if (normMatch >= 0) return normMatch;
      }
      return -1;
    };

    for (const rawList of listsToTry) {
      const masterLessons = rawList
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(m => ({
          id: m.id,
          sort_order: m.sort_order,
          name: m.lesson_name || m.unit_name || '',
          fullTitle: m.unit_name ? `${m.unit_name} - ${m.lesson_name}` : (m.lesson_name || '')
        }));

      if (masterLessons.length > 0) {
        let startIdx = findIndexInList(masterLessons, task.start_lesson_id, task.start_lesson_name);
        let endIdx = findIndexInList(masterLessons, task.end_lesson_id, task.end_lesson_name);

        const rangeText = task.lesson_range || task.custom_unit_name;
        if ((startIdx < 0 || endIdx < 0) && rangeText && (rangeText.includes('〜') || rangeText.includes('~') || rangeText.includes('～'))) {
          const parts = rangeText.split(/〜|~|～/);
          if (parts.length >= 2) {
            const fromStr = parts[0].trim();
            const toStr = parts[1].trim();
            if (startIdx < 0 && fromStr) startIdx = findIndexInList(masterLessons, undefined, fromStr);
            if (endIdx < 0 && toStr) endIdx = findIndexInList(masterLessons, undefined, toStr);
          }
        }

        // sort_order 基準での範囲特定 (From〜To)
        let startOrder: number | undefined;
        let endOrder: number | undefined;

        if (startIdx >= 0) startOrder = masterLessons[startIdx].sort_order;
        if (endIdx >= 0) endOrder = masterLessons[endIdx].sort_order;

        if (startOrder === undefined && task.start_lesson_id && !isNaN(Number(task.start_lesson_id))) {
          startOrder = Number(task.start_lesson_id);
        }
        if (endOrder === undefined && task.end_lesson_id && !isNaN(Number(task.end_lesson_id))) {
          endOrder = Number(task.end_lesson_id);
        }

        if (startOrder !== undefined && endOrder !== undefined) {
          const minOrder = Math.min(startOrder, endOrder);
          const maxOrder = Math.max(startOrder, endOrder);
          const rangeItems = masterLessons.filter(m => m.sort_order !== undefined && m.sort_order >= minOrder && m.sort_order <= maxOrder);
          if (rangeItems.length > 0) return rangeItems;
        }

        if (startIdx >= 0 || endIdx >= 0) {
          const minI = startIdx >= 0 && endIdx >= 0 ? Math.min(startIdx, endIdx) : (startIdx >= 0 ? startIdx : endIdx);
          const maxI = startIdx >= 0 && endIdx >= 0 ? Math.max(startIdx, endIdx) : (endIdx >= 0 ? endIdx : startIdx);
          return masterLessons.slice(minI, maxI + 1);
        }
      }
    }

    // fallback to curriculumUnits
    const subjectUnits = units
      .filter(u => u.subject === taskSubject || (isElem && (u.subject === '算数' || u.subject === '数学')) || (!isElem && (u.subject === '数学' || u.subject === '算数')))
      .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
      .map(u => ({
        id: u.id,
        sort_order: u.sequence_order,
        name: u.name,
        fullTitle: u.name
      }));

    if (subjectUnits.length > 0) {
      let sIdx = findIndexInList(subjectUnits as any, task.start_lesson_id, task.start_lesson_name);
      let eIdx = findIndexInList(subjectUnits as any, task.end_lesson_id, task.end_lesson_name);

      const rangeText = task.lesson_range || task.custom_unit_name;
      if ((sIdx < 0 || eIdx < 0) && rangeText && (rangeText.includes('〜') || rangeText.includes('~') || rangeText.includes('～'))) {
        const parts = rangeText.split(/〜|~|～/);
        if (parts.length >= 2) {
          const fromStr = parts[0].trim();
          const toStr = parts[1].trim();
          if (sIdx < 0 && fromStr) sIdx = findIndexInList(subjectUnits as any, undefined, fromStr);
          if (eIdx < 0 && toStr) eIdx = findIndexInList(subjectUnits as any, undefined, toStr);
        }
      }

      if (sIdx >= 0 || eIdx >= 0) {
        const minI = sIdx >= 0 && eIdx >= 0 ? Math.min(sIdx, eIdx) : (sIdx >= 0 ? sIdx : eIdx);
        const maxI = sIdx >= 0 && eIdx >= 0 ? Math.max(sIdx, eIdx) : (eIdx >= 0 ? eIdx : sIdx);
        return subjectUnits.slice(minI, maxI + 1);
      }

      if (task.unit_id) {
        const u = subjectUnits.find(unit => unit.id === task.unit_id);
        if (u) return [u];
      }
    }

    if (task.unit_id) {
      const unit = units.find(u => u.id === task.unit_id);
      if (unit) {
        return [{ id: unit.id, name: unit.name, fullTitle: unit.name }];
      }
    }

    const defaultName = task.start_lesson_name || task.custom_unit_name || task.lesson_range || '授業';
    return [{ id: task.id || `task-${task.period}`, name: defaultName, fullTitle: defaultName }];
  };

  // 各授業ステップの受講完了アクション (Optimistic UI & Async Save)
  const handleCompleteLessonStep = async (
    task: LearningTask,
    step: { id: string; name: string; fullTitle: string },
    stepIndex: number,
    allSteps: Array<{ id: string; name: string; fullTitle: string }>
  ) => {
    const stepIdStr = String(step.id);
    
    // 既存の完了済みIDセット
    const currentTaskCompletedIds = new Set<string>(task.completed_lesson_ids?.map(String) || []);
    currentTaskCompletedIds.add(stepIdStr);

    const studentCompletedIds = new Set<string>(currentStudent.completed_lesson_ids?.map(String) || []);
    studentCompletedIds.add(stepIdStr);

    const isAllStepsCompleted = allSteps.length > 0 && allSteps.every(s => currentTaskCompletedIds.has(String(s.id)));

    const updatedTask: LearningTask = {
      ...task,
      completed_lesson_ids: Array.from(currentTaskCompletedIds),
      video_watched: true,
      ...(isAllStepsCompleted ? {
        status: 'completed' as const,
        test_passed: true,
        actual_completed_date: currentDateStr
      } : {
        status: task.status === 'completed' ? 'completed' : 'unstarted',
        test_passed: task.test_passed || false
      })
    };

    const updatedStudent: Student = {
      ...currentStudent,
      completed_lesson_ids: Array.from(studentCompletedIds),
      last_completed_lesson_id: stepIdStr,
      last_completed_at: new Date().toISOString()
    };

    // ⚡️ 1. Optimistic UI Update: Reactステートを即座に更新（通信完了を待たずに画面描画）
    setCurrentStudent(updatedStudent);
    setTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
    setTodayTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));

    if (isAllStepsCompleted) {
      showToast(`🎉 【第${task.period}コマ 完了！】全ステップを達成しました！右側の学習マップも進捗しました！`);
    } else {
      showToast(`🎉 STEP ${stepIndex + 1}「${step.name || step.fullTitle}」を受講完了にしました！`);
    }

    // 🌐 2. バックエンド (Supabase / LocalStorage) への非同期保存処理
    try {
      // (a) レッスン進捗 (student_lesson_progress) を保存
      await db.saveStudentLessonProgress({
        id: `slp-${student.id}-${stepIdStr}`,
        student_id: student.id,
        subject: task.subject || 'その他',
        lesson_id: stepIdStr,
        lesson_name: step.name || step.fullTitle,
        task_id: task.id,
        date: currentDateStr,
        status: 'completed',
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      // (b) タスクと生徒情報を保存 (Supabase + LocalStorage)
      await db.saveLearningTasks([updatedTask]);
      await db.saveStudent(updatedStudent);

      // (c) ログ記録
      await db.addLearningLog({
        id: `log-step-${Date.now()}`,
        student_id: student.id,
        unit_id: task.unit_id || stepIdStr,
        log_type: 'video_view',
        duration_seconds: 600,
        created_at: new Date().toISOString()
      });

      if (isAllStepsCompleted) {
        await db.addLearningLog({
          id: `log-pass-${Date.now()}`,
          student_id: student.id,
          unit_id: task.unit_id || stepIdStr,
          log_type: 'test_result',
          score: 100,
          total_questions: 10,
          incorrect_genres: [],
          created_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('ステップ進捗の保存中にエラーが発生しました:', err);
      showToast('⚠️ 進捗のサーバー保存に失敗しました。');
    }
  };

  // 生徒による小テスト結果の送信
  const handleSaveStudentScore = async (testId: string, scoreInput: string) => {
    const test = miniTestResults.find(r => r.id === testId)!;

    const scoreVal = scoreInput === '' ? null : parseInt(scoreInput);
    if (scoreVal !== null && (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100)) {
      alert('0〜100の点数を入力してください。');
      return;
    }

    const updated = {
      ...test,
      score: scoreVal
    };
    await db.saveMiniTestResult(updated);
    if (typeof window !== 'undefined') {
      window.alert('小テスト点数を送信しました！');
    }
    showToast('小テスト点数を送信しました！');
    loadData();
  };

  // カリキュラム外タスク または 全ステップを一括完了にする
  const handleCompleteCustomTask = async (task: LearningTask) => {
    const stepLessons = getTaskStepLessons(task);
    const stepIds = stepLessons.map(s => String(s.id));

    const currentTaskCompletedIds = new Set<string>(task.completed_lesson_ids?.map(String) || []);
    stepIds.forEach(id => currentTaskCompletedIds.add(id));

    const studentCompletedIds = new Set<string>(currentStudent.completed_lesson_ids?.map(String) || []);
    stepIds.forEach(id => studentCompletedIds.add(id));

    const updatedTask: LearningTask = {
      ...task,
      completed_lesson_ids: Array.from(currentTaskCompletedIds),
      status: 'completed',
      video_watched: true,
      test_passed: true,
      actual_completed_date: currentDateStr
    };

    const updatedStudent: Student = {
      ...currentStudent,
      completed_lesson_ids: Array.from(studentCompletedIds),
      last_completed_lesson_id: stepIds[stepIds.length - 1] || currentStudent.last_completed_lesson_id,
      last_completed_at: new Date().toISOString()
    };

    // ⚡️ 1. Optimistic UI Update: Reactステートを即座に更新
    setCurrentStudent(updatedStudent);
    setTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
    setTodayTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
    showToast(`🎉 【第${task.period}コマ 完了！】授業の全ステップを完了にしました！`);

    // 🌐 2. バックエンド保存
    for (const step of stepLessons) {
      try {
        await db.saveStudentLessonProgress({
          id: `slp-${student.id}-${String(step.id)}`,
          student_id: student.id,
          subject: task.subject || 'その他',
          lesson_id: String(step.id),
          lesson_name: step.name || step.fullTitle,
          task_id: task.id,
          date: currentDateStr,
          status: 'completed',
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('saveStudentLessonProgress error:', e);
      }
    }

    try {
      await db.saveLearningTasks([updatedTask]);
      await db.saveStudent(updatedStudent);

      await db.addLearningLog({
        id: `log-pass-${Date.now()}`,
        student_id: student.id,
        unit_id: task.unit_id || task.id,
        log_type: 'test_result',
        score: 100,
        total_questions: 10,
        incorrect_genres: [],
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('handleCompleteCustomTask error:', e);
    }
  };

  // 1. 動画視聴ボタンのアクション
  const handleWatchVideo = async (task: LearningTask) => {
    const updated: LearningTask = {
      ...task,
      video_watched: true,
      status: task.status === 'unstarted' ? 'unstarted' : task.status
    };
    
    await db.saveLearningTasks([updated]);
    
    const log: LearningLog = {
      id: `log-${Date.now()}`,
      student_id: student.id,
      unit_id: task.unit_id,
      log_type: 'video_view',
      duration_seconds: 600,
      created_at: new Date().toISOString()
    };
    await db.addLearningLog(log);

    loadData();
  };

  // 2. テスト受験ボタンのアクション (合格)
  const handlePassTest = async (task: LearningTask) => {
    const stepLessons = getTaskStepLessons(task);
    const stepIds = stepLessons.map(s => String(s.id));

    const currentTaskCompletedIds = new Set<string>(task.completed_lesson_ids?.map(String) || []);
    stepIds.forEach(id => currentTaskCompletedIds.add(id));

    const studentCompletedIds = new Set<string>(currentStudent.completed_lesson_ids?.map(String) || []);
    stepIds.forEach(id => studentCompletedIds.add(id));

    const updated: LearningTask = {
      ...task,
      completed_lesson_ids: Array.from(currentTaskCompletedIds),
      video_watched: true,
      test_passed: true,
      status: 'completed',
      actual_completed_date: currentDateStr
    };

    const updatedStudent: Student = {
      ...currentStudent,
      completed_lesson_ids: Array.from(studentCompletedIds),
      last_completed_lesson_id: stepIds[stepIds.length - 1] || currentStudent.last_completed_lesson_id,
      last_completed_at: new Date().toISOString()
    };

    for (const step of stepLessons) {
      try {
        await db.saveStudentLessonProgress({
          id: `slp-${student.id}-${String(step.id)}`,
          student_id: student.id,
          subject: task.subject || 'その他',
          lesson_id: String(step.id),
          lesson_name: step.name || step.fullTitle,
          task_id: task.id,
          date: currentDateStr,
          status: 'completed',
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('saveStudentLessonProgress error:', e);
      }
    }

    await db.saveLearningTasks([updated]);
    await db.saveStudent(updatedStudent);

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

    // 爆速判定を自動で呼び出す
    const allCurrentTasks = db.getLearningTasks();
    const studentTasks = allCurrentTasks.filter(t => t.student_id === student.id);
    
    const curDate = new Date(currentDateStr);
    const dayOfWeek = isNaN(curDate.getTime()) ? 0 : curDate.getDay();
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const weekEnd = new Date(curDate.getTime() + daysToSunday * 24 * 60 * 60 * 1000);
    const weekEndDate = isNaN(weekEnd.getTime()) ? currentDateStr : weekEnd.toISOString().split('T')[0];

    const thisWeekTasks = studentTasks.filter(t => {
      const d = new Date(t.scheduled_date).getTime();
      const start = new Date(currentDateStr).getTime();
      const end = new Date(weekEndDate).getTime();
      return d >= start && d <= end;
    });

    const allCompletedThisWeek = thisWeekTasks.length > 0 && thisWeekTasks.every(t => t.status === 'completed');
    if (allCompletedThisWeek) {
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
    const d = new Date(currentDateStr);
    const dMinus1 = new Date(d.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const targetToday = currentDateStr;

    const allCurrentTasks = db.getLearningTasks();
    const updated = allCurrentTasks.map(t => {
      if (t.student_id === student.id) {
        if (t.scheduled_date === dMinus1) {
          return { ...t, status: 'unstarted' as const, video_watched: false, test_passed: false };
        }
        if (t.scheduled_date === targetToday) {
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

    alert('【シミュレーション】過去2日間のタスクを未完了に設定しました。講師ダッシュボード側で「自動リスケジュール」を実行すると、残りのタスク量に応じて自動再編または「計画パンクアラート」が発生します。');
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
      {toastMessage && (
        <div 
          data-testid="student-toast"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
            fontSize: '0.9rem',
            fontWeight: 700,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          {toastMessage}
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.studentInfo}>
          <h1>
            {/* Student Icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {currentStudent.name} さんの学習画面
          </h1>
          <div className={styles.studentMeta}>
            <span>学年: <strong className={styles.badge}>{currentStudent.grade}</strong></span>
            <span>ログインID: <code>{currentStudent.student_id}</code></span>
            <span>アカウント状況: {getStatusBadge(currentStudent.status)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowScheduleConfig(!showScheduleConfig)} 
            className={styles.backBtn}
            style={{ background: '#4f46e5', color: '#fff' }}
          >
            ⚙️ 通塾設定
          </button>
          {onBackToPortal && (
            <button onClick={onBackToPortal} className={styles.backBtn}>
              ログアウト（ポータルへ）
            </button>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        {/* Left Side: Todays Timetable */}
        <div className={styles.todoCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
              {/* Clock Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {currentDateStr === systemTodayStr ? '今日の時間割・タスク' : '時間割・タスク'} ({currentDateStr})
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={currentDateStr}
                data-testid="student-date-picker"
                onChange={e => {
                  if (e.target.value) {
                    setCurrentDateStr(e.target.value);
                    setHasAutoSelectedDate(true);
                  }
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  cursor: 'pointer'
                }}
              />
              {currentDateStr !== systemTodayStr && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentDateStr(systemTodayStr);
                    setHasAutoSelectedDate(true);
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  📅 今日に戻る
                </button>
              )}
            </div>
          </div>

          {/* 直近の通塾予定日を表示している場合の案内バナー */}
          {currentDateStr !== systemTodayStr && todayTasks.length > 0 && (
            <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.8rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💡</span>
              <span>本日はコマ割りがありません。直近の通塾予定日（<strong>{currentDateStr}</strong>）の時間割・タスクを表示しています。</span>
            </div>
          )}

          {/* 📢 業務連絡カード */}
          {(() => {
            const todayAllTasks = tasks.filter(t => t.scheduled_date === currentDateStr);
            const officeNote = todayTasks.find(t => t.office_note && t.office_note.trim() !== '')?.office_note
              || todayAllTasks.find(t => t.office_note && t.office_note.trim() !== '')?.office_note;
            if (!officeNote) return null;
            return (
              <div 
                style={{ 
                  margin: '12px 0', 
                  padding: '14px 16px', 
                  background: '#fffbeb', 
                  borderRadius: '8px', 
                  border: '1px solid #fef3c7', 
                  borderLeft: '4px solid #f59e0b', 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)' 
                }} 
                data-testid="office-note-card"
              >
                <h3 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#92400e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📢 講師からの業務連絡
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#78350f', whiteSpace: 'pre-wrap', fontWeight: 600 }}>
                  {officeNote}
                </p>
              </div>
            );
          })()}

          {/* 🎯 本日のテストカード */}
          {miniTestResults.length > 0 && (
            <div 
              style={{ margin: '12px 0', padding: '16px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fee2e2' }}
              data-testid="today-test-card"
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#991b1b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                🎯 本日のテスト
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {miniTestResults.map(test => {
                  const stLevel = student.level || 'A';
                  const passScore = stLevel === 'A' ? 90 : stLevel === 'B' ? 80 : 70;
                  const currentScore = test.score;
                  let statusBadge = null;
                  if (currentScore !== null && currentScore !== undefined) {
                    const isPassed = currentScore >= passScore;
                    statusBadge = isPassed ? (
                      <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>合格 ✨</span>
                    ) : (
                      <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '8px' }}>不合格 (再挑戦) ⚠️</span>
                    );
                  }
                  return (
                    <div key={test.id} style={{ borderBottom: '1px dashed #fee2e2', paddingBottom: '12px' }} data-testid={`test-item-${test.id}`}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
                        {test.test_content}
                        <span style={{ marginLeft: '10px', fontSize: '0.75rem', color: '#4b5563', fontWeight: 'normal' }}>
                          (レベル{stLevel}目標: {passScore}点)
                        </span>
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>テスト結果点数: </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={studentScores[test.id]}
                          onChange={e => setStudentScores({ ...studentScores, [test.id]: e.target.value })}
                          placeholder="点数を入力"
                          className={styles.input}
                          style={{ width: '90px', padding: '4px 8px', fontSize: '0.8rem', display: 'inline-block' }}
                          data-testid={`test-score-input-${test.id}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveStudentScore(test.id, studentScores[test.id])}
                          className={styles.btn}
                          style={{ width: 'auto', padding: '4px 12px', fontSize: '0.8rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          data-testid={`test-save-btn-${test.id}`}
                        >
                          結果を保存
                        </button>
                        {statusBadge}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 📝 宿題カード */}
          {homeworkResults.length > 0 && (
            <div 
              style={{ margin: '12px 0', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}
              data-testid="today-homework-card"
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                📝 今日の宿題
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {homeworkResults.map(hw => (
                  <div key={hw.id} style={{ borderBottom: '1px dashed #dcfce7', paddingBottom: '12px' }} data-testid={`homework-item-${hw.id}`}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#374151', whiteSpace: 'pre-wrap', fontWeight: 600 }}>
                      {hw.homework_content}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {hw.homework_deadline && (
                        <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
                          提出期限: {hw.homework_deadline}
                        </div>
                      )}
                      <div>
                        {hw.status === 'completed' && <span className={`${styles.badge} ${styles.statusNormal}`} style={{ background: '#10b981', color: '#fff' }}>提出済み</span>}
                        {hw.status === 'skipped' && <span className={`${styles.badge} ${styles.statusNormal}`} style={{ background: '#64748b', color: '#fff' }}>スキップ</span>}
                        {hw.status === 'incomplete' && <span className={`${styles.badge} ${styles.statusWarning}`} style={{ background: '#ef4444', color: '#fff' }}>未完</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {todayTasks.length === 0 ? (
            <div className={styles.emptyTimetable}>
              {currentDateStr === systemTodayStr
                ? '今日のコマ割り予定はありません。自習で動画視聴やテストを進めましょう。'
                : `${currentDateStr} のコマ割り予定はありません。`}
            </div>
          ) : (
            <div className={styles.timetable}>
              {todayTasks.map(task => {
                const unit = units.find(u => u.id === task.unit_id);
                const subjectName = task.subject || (unit ? unit.subject : 'その他');
                const themeName = task.lesson_range 
                  || (task.start_lesson_name && task.end_lesson_name && task.start_lesson_name !== task.end_lesson_name 
                      ? `${task.start_lesson_name} 〜 ${task.end_lesson_name}` 
                      : (task.start_lesson_name || task.custom_unit_name || (unit ? unit.name : 'テーマ設定なし')));
                const googleDriveUrl = unit?.google_drive_url;
                const isCustomTask = !unit;

                const stepLessons = getTaskStepLessons(task);
                const completedStepIds = new Set<string>();
                (task.completed_lesson_ids || []).forEach(id => completedStepIds.add(String(id)));
                (currentStudent.completed_lesson_ids || []).forEach(id => completedStepIds.add(String(id)));
                if (task.status === 'completed' || task.test_passed) {
                  stepLessons.forEach(s => completedStepIds.add(String(s.id)));
                }

                const completedCount = stepLessons.filter(s => completedStepIds.has(String(s.id))).length;

                return (
                  <div key={task.id} className={styles.periodRow} data-testid={`period-row-${task.period}`}>
                    <div className={styles.periodNumber}>{task.period}</div>
                    <div className={styles.periodContent}>
                      <div className={styles.periodHeader}>
                        <span className={styles.subjectName}>{subjectName}</span>
                        <div>
                          {task.status === 'completed' && <span className={`${styles.badge} ${styles.statusNormal}`} data-testid={`task-completed-badge-${task.period}`}>合格完了！</span>}
                          {task.status === 'failed' && <span className={`${styles.badge} ${styles.statusWarning}`}>不合格 (再挑戦)</span>}
                        </div>
                      </div>
                      <div className={styles.unitName}>{themeName}</div>

                      {/* Step-by-Step Lesson Progress Cards */}
                      {stepLessons.length > 0 && (
                        <div className={styles.stepCardContainer}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>進捗ステップ</span>
                            <span data-testid={`step-progress-count-${task.period}`}>{completedCount} / {stepLessons.length} 完了</span>
                          </div>
                          {stepLessons.map((step, sIdx) => {
                            const isStepDone = completedStepIds.has(String(step.id));
                            return (
                              <div 
                                key={step.id || sIdx} 
                                className={`${styles.stepCard} ${isStepDone ? styles.stepCardCompleted : ''}`}
                                data-testid={`step-card-${task.period}-${sIdx}`}
                              >
                                <div className={styles.stepTitle}>
                                  <span style={{ color: '#4f46e5', fontWeight: 700 }}>STEP {sIdx + 1}:</span>
                                  <span>{step.name || step.fullTitle}</span>
                                </div>
                                <div>
                                  {isStepDone ? (
                                    <span className={styles.stepCompletedBadge} data-testid={`step-done-badge-${task.period}-${sIdx}`}>
                                      ✅ 受講完了
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleCompleteLessonStep(task, step, sIdx, stepLessons);
                                      }}
                                      className={styles.stepCompleteBtn}
                                      data-testid={`step-complete-btn-${task.period}-${sIdx}`}
                                    >
                                      🎯 完了にする
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Period-specific office note */}
                      {task.office_note && (
                        <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#b45309', background: '#fffbeb', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                          📝 連絡: {task.office_note}
                        </div>
                      )}

                      {/* Google Drive Link for printing materials */}
                      {googleDriveUrl && (
                        <div style={{ marginTop: '6px' }}>
                          <a 
                            href={googleDriveUrl} 
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
                        {isCustomTask ? (
                          task.status !== 'completed' && (
                            <button 
                              onClick={() => handleCompleteCustomTask(task)} 
                              className={`${styles.btn} ${styles.btnSuccess}`}
                              data-testid={`complete-task-btn-${task.period}`}
                            >
                              {stepLessons.length > 1 ? 'このコマの全ステップを一括完了にする' : 'この授業を完了にする'}
                            </button>
                          )
                        ) : (
                          <>
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
                                  data-testid={`complete-task-btn-${task.period}`}
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
          <SugorokuMap
            student={currentStudent}
            subjects={currentStudent.selected_subjects && currentStudent.selected_subjects.length > 0 
              ? currentStudent.selected_subjects 
              : (currentStudent.grade.startsWith('小') ? ['算数', '国語', '英語', '理科', '社会'] : ['数学', '英語', '国語', '理科', '社会'])}
            subject={currentStudent.grade.startsWith('小') ? '算数' : '数学'}
            units={units}
            tasks={tasks}
            todayTasks={todayTasks}
            theme={theme}
          />
        </div>

        {/* 週間スケジュール・仮予定表示ビュー */}
        <div style={{ gridColumn: '1 / -1' }}>
          <WeeklyScheduleViewer
            tasks={tasks}
            scheduleConfig={scheduleConfig}
            currentDateStr={currentDateStr}
          />
        </div>

        {/* テスト結果レーダーチャート */}
        <div style={{ gridColumn: '1 / -1' }}>
          <TestScoreRadarChart
            title={`${student.name} さんの教科別理解度・得点レーダーチャート`}
            data={student.grade.startsWith('小') ? [
              { subject: '国語', score: 78 },
              { subject: '算数', score: 85 },
              { subject: '英語', score: 90 },
              { subject: '理科', score: 72 },
              { subject: '社会', score: 68 },
            ] : [
              { subject: '国語', score: 75 },
              { subject: '数学', score: 88 },
              { subject: '英語', score: 82 },
              { subject: '理科', score: 79 },
              { subject: '社会', score: 70 },
            ]}
          />
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
