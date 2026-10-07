import React, { useState, useEffect } from 'react';
import styles from './StudentDashboard.module.css';
import { db, Student, LearningTask, CurriculumUnit, CurriculumMaster, LearningLog, MiniTestResult, HomeworkResult, StudentScheduleConfig, StudentLessonProgress } from '../lib/db';
import { ensureMathEnglishUnitTests, normalizeGrade } from '../lib/scheduler';
import SugorokuMap from './SugorokuMap';
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

  const sanitizeCompletedLessonIds = (ids?: any[]): string[] => {
    if (!Array.isArray(ids)) return [];
    return Array.from(new Set(
      ids
        .filter(Boolean)
        .map(String)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.includes('単元確認テスト'))
    ));
  };

  const getLatestStudent = (): Student => {
    const dbSt = typeof db.getStudent === 'function' ? db.getStudent(student.id) : (typeof db.getStudents === 'function' ? db.getStudents().find(s => s.id === student.id) : null);
    const rawIds = dbSt?.completed_lesson_ids || student.completed_lesson_ids || [];
    return {
      ...(dbSt || {}),
      ...student,
      completed_lesson_ids: sanitizeCompletedLessonIds(rawIds)
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
      const mergedCompleted = sanitizeCompletedLessonIds([
        ...(prev?.completed_lesson_ids || []),
        ...(latest?.completed_lesson_ids || []),
        ...(student.completed_lesson_ids || [])
      ]);
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
  const [taskScores, setTaskScores] = useState<Record<string, string>>({});
  const [scheduleConfig, setScheduleConfig] = useState<StudentScheduleConfig | undefined>(() => db.getStudentScheduleConfig(student.id));
  const [activeMobileTab, setActiveMobileTab] = useState<'mission' | 'map'>('mission');
  const [lessonProgressList, setLessonProgressList] = useState<StudentLessonProgress[]>(() => 
    typeof db.getStudentLessonProgressList === 'function' ? db.getStudentLessonProgressList(student.id) : []
  );

  const loadData = async () => {
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

    let progressList: StudentLessonProgress[] = [];
    try {
      progressList = await db.fetchStudentLessonProgressList(student.id);
    } catch {
      progressList = typeof db.getStudentLessonProgressList === 'function' ? db.getStudentLessonProgressList(student.id) : [];
    }
    setLessonProgressList(progressList);

    const dbSt = typeof db.getStudent === 'function' ? db.getStudent(student.id) : (typeof db.getStudents === 'function' ? db.getStudents().find(s => s.id === student.id) : null);
    const originalRawIds = dbSt?.completed_lesson_ids || student.completed_lesson_ids || [];
    const sanitizedIds = sanitizeCompletedLessonIds(originalRawIds);

    const latestStudent: Student = {
      ...(dbSt || {}),
      ...student,
      completed_lesson_ids: sanitizedIds
    };
    setCurrentStudent(latestStudent);

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
    // 旧フォーマットの不要な【やり直し授業】タスクを除外
    const today = studentTasks
      .filter(t => t.scheduled_date === targetDate && t.period !== null)
      .filter(t => 
        !t.custom_unit_name?.includes('【やり直し授業】') &&
        !t.start_lesson_name?.includes('【やり直し授業】') &&
        !t.lesson_range?.includes('【やり直し授業】')
      );
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

    const initialTaskScores: Record<string, string> = {};
    today.forEach(t => {
      const matched = todayMini.find(m => 
        (m.task_id === t.id) ||
        (m.subject === t.subject && (
          m.test_content === (t.lesson_range || t.custom_unit_name || t.start_lesson_name) ||
          (t.start_lesson_name && m.test_content?.includes(t.start_lesson_name)) ||
          m.test_type === 'unit_test'
        ))
      );
      if (matched && matched.score !== null && matched.score !== undefined) {
        initialTaskScores[t.id] = matched.score.toString();
      }
    });
    setTaskScores(initialTaskScores);

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
  const getTaskStepLessons = (task: LearningTask, mastersOverride?: CurriculumMaster[]): Array<{ id: string; name: string; fullTitle: string }> => {
    const isElem = student.grade.startsWith('小') || student.grade === '園児';
    const isJhs = student.grade.startsWith('中');
    const isHs = student.grade.startsWith('高') || student.grade === '既卒';
    const taskSubject = task.subject || (units.find(u => u.id === task.unit_id)?.subject) || (isElem ? '算数' : '数学');

    const cleanStr = (s: string) => {
      if (!s) return '';
      return s.toLowerCase().replace(/[\s\-\_〜～~.・、。()（）「」『』:：]/g, '');
    };

    // やり直しタスクの場合は独自の復習・テストステップをそのまま使用
    const isRemedial = Boolean(
      task.custom_unit_name?.includes('やり直し') ||
      task.start_lesson_name?.includes('やり直し') ||
      task.lesson_range?.includes('やり直し') ||
      task.custom_unit_name?.includes('ーやり直しー') ||
      task.start_lesson_name?.includes('ーやり直しー') ||
      task.lesson_range?.includes('ーやり直しー')
    );
    if (isRemedial) {
      const remedialName = task.start_lesson_name || task.custom_unit_name || task.lesson_range || '単元確認テスト　ーやり直しー';
      return [{ id: task.id || `task-${task.period}`, name: remedialName, fullTitle: remedialName }];
    }

    const mastersSource = mastersOverride || (curriculumMasters.length > 0 ? curriculumMasters : (typeof db.getCurriculumMasters === 'function' ? db.getCurriculumMasters() : []));

    // 1. 該当コマの教科のみに最優先で厳密絞り込み（他教科混入を完全遮断）
    const candidateMasters = mastersSource.filter(m => {
      if (m.subject === taskSubject) return true;
      if ((taskSubject === '算数' || taskSubject === '数学') && (m.subject === '算数' || m.subject === '数学')) return true;
      return false;
    });

    const targetGradeNorm = normalizeGrade(student.grade);
    // 学年での絞り込み（該当するものがあれば優先）
    const gradeExactMasters = candidateMasters.filter(m => normalizeGrade(m.grade) === targetGradeNorm);
    const gradeCategoryMasters = candidateMasters.filter(m => {
      if (isElem && m.grade) return m.grade.startsWith('小') || /^[1-6]年生?$/.test(m.grade) || m.grade === '園児';
      if (isJhs && m.grade) return m.grade.startsWith('中') || /^[7-9]年生?$/.test(m.grade);
      if (isHs && m.grade) return m.grade.startsWith('高') || m.grade === '既卒';
      return true;
    });

    // 検索対象のリスト候補（該当教科内でのみ段階的にフォールバック）
    const listsToTry = [
      gradeExactMasters.length > 0 ? ensureMathEnglishUnitTests(gradeExactMasters) : null,
      gradeCategoryMasters.length > 0 ? ensureMathEnglishUnitTests(gradeCategoryMasters) : null,
      candidateMasters.length > 0 ? ensureMathEnglishUnitTests(candidateMasters) : null
    ].filter(Boolean) as typeof curriculumMasters[];

    // レンジ文字列のスマート分割（レッスン名内の「〜」と区切り記号「 〜 」を明確に区別）
    let parsedFromStr: string | null = task.start_lesson_name || null;
    let parsedToStr: string | null = task.end_lesson_name || null;

    const rangeText = task.lesson_range || task.custom_unit_name;
    if ((!parsedFromStr || !parsedToStr) && rangeText) {
      if (/\s+[〜~～]\s+/.test(rangeText)) {
        const parts = rangeText.split(/\s+[〜~～]\s+/);
        if (parts.length >= 2) {
          if (!parsedFromStr) parsedFromStr = parts[0].trim();
          if (!parsedToStr) parsedToStr = parts[1].trim();
        }
      } else if (rangeText.includes('〜') || rangeText.includes('~') || rangeText.includes('～')) {
        const parts = rangeText.split(/〜|~|～/);
        if (parts.length >= 2) {
          if (!parsedFromStr) parsedFromStr = parts[0].trim();
          if (!parsedToStr) parsedToStr = parts[1].trim();
        }
      }
    }

    const isPureUnitTestTask = Boolean(
      (task.start_lesson_name && task.start_lesson_name.includes('単元確認テスト')) ||
      (task.lesson_range && task.lesson_range.includes('単元確認テスト') && !task.lesson_range.includes('〜'))
    );

    const findIndexInList = (
      list: Array<{ id: string; sort_order?: number; name: string; fullTitle: string; isUnitTest?: boolean }>, 
      targetId?: string | null, 
      targetName?: string | null
    ): number => {
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

        const isTargetTest = raw.includes('テスト');

        // 1. 完全一致
        const exact = list.findIndex(m => m.name === raw || m.fullTitle === raw);
        if (exact >= 0) return exact;

        // 2. 正規化完全一致
        const normExact = list.findIndex(m => cleanStr(m.fullTitle) === norm || cleanStr(m.name) === norm);
        if (normExact >= 0) return normExact;

        // 3. fullTitle での部分一致（targetNameがテストでなければ通常授業を優先）
        if (!isTargetTest) {
          const fullTitleMatchLesson = list.findIndex(m => {
            if (m.isUnitTest) return false;
            const fNorm = cleanStr(m.fullTitle);
            return fNorm.includes(norm) || norm.includes(fNorm);
          });
          if (fullTitleMatchLesson >= 0) return fullTitleMatchLesson;
        }

        const fullTitleMatch = list.findIndex(m => {
          const fNorm = cleanStr(m.fullTitle);
          return fNorm.includes(norm) || norm.includes(fNorm);
        });
        if (fullTitleMatch >= 0) return fullTitleMatch;

        // 4. name での部分一致
        const genericNames = ['テスト', '単元確認テスト', '単元テスト', '確認テスト'];
        if (!isTargetTest) {
          const nameMatchLesson = list.findIndex(m => {
            if (m.isUnitTest) return false;
            const mNorm = cleanStr(m.name);
            if (genericNames.includes(mNorm)) return false;
            return mNorm.length >= 3 && (mNorm.includes(norm) || norm.includes(mNorm));
          });
          if (nameMatchLesson >= 0) return nameMatchLesson;
        }

        const nameMatch = list.findIndex(m => {
          const mNorm = cleanStr(m.name);
          if (genericNames.includes(mNorm)) return false;
          return mNorm.length >= 3 && (mNorm.includes(norm) || norm.includes(mNorm));
        });
        if (nameMatch >= 0) return nameMatch;
      }
      return -1;
    };

    for (const rawList of listsToTry) {
      const masterLessons = rawList
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(m => {
          const isReviewOrCheck = m.lesson_name.includes('まとめテスト') || m.lesson_name.toLowerCase().includes('check test');
          const isUnitTest = !isReviewOrCheck && (
            m.item_type === 'unit_test' || 
            m.lesson_name.includes('単元確認テスト') || 
            m.lesson_name.includes('単元テスト') || 
            m.lesson_name.includes('確認テスト')
          );
          const cleanLessonName = m.lesson_name.replace(/^[^-]+-\s*/, '').trim();
          const displayLessonName = isUnitTest 
            ? (cleanLessonName.includes('単元確認テスト') || cleanLessonName.includes('単元テスト') ? cleanLessonName : `${cleanLessonName} (単元テスト)`)
            : cleanLessonName;
          return {
            id: m.id,
            sort_order: m.sort_order,
            name: displayLessonName || m.unit_name || '',
            fullTitle: m.unit_name ? `${m.unit_name} - ${displayLessonName}` : (displayLessonName || ''),
            unit_name: m.unit_name,
            isUnitTest
          };
        });

      if (masterLessons.length > 0) {
        let startIdx = findIndexInList(masterLessons, task.start_lesson_id, parsedFromStr);
        let endIdx = findIndexInList(masterLessons, task.end_lesson_id, parsedToStr);

        // startIdx と endIdx の両方が特定できた場合
        if (startIdx >= 0 && endIdx >= 0) {
          const startItem = masterLessons[startIdx];
          const endItem = masterLessons[endIdx];

          // 同一単元内の場合は、その単元のみに絞り込んでからスライス（他単元の重複sort_order混入を完全遮断）
          if (startItem.unit_name && endItem.unit_name && startItem.unit_name === endItem.unit_name) {
            const sameUnitLessons = masterLessons.filter(m => m.unit_name === startItem.unit_name);
            const sIdx = sameUnitLessons.findIndex(m => m.id === startItem.id || m.name === startItem.name);
            const eIdx = sameUnitLessons.findIndex(m => m.id === endItem.id || m.name === endItem.name);
            if (sIdx >= 0 && eIdx >= 0) {
              const minI = Math.min(sIdx, eIdx);
              const maxI = Math.max(sIdx, eIdx);
              const sliced = sameUnitLessons.slice(minI, maxI + 1);
              if (!isPureUnitTestTask && sliced.every(item => item.isUnitTest)) {
                const lessonItemsOnly = sameUnitLessons.filter(item => !item.isUnitTest);
                if (lessonItemsOnly.length > 0) return lessonItemsOnly;
              }
              return sliced;
            }
          }

          const minI = Math.min(startIdx, endIdx);
          const maxI = Math.max(startIdx, endIdx);
          const sliced = masterLessons.slice(minI, maxI + 1);
          if (!isPureUnitTestTask && sliced.every(item => item.isUnitTest)) {
            const lessonItemsOnly = masterLessons.filter(item => !item.isUnitTest);
            if (lessonItemsOnly.length > 0) return lessonItemsOnly;
          }
          return sliced;
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
          if (rangeItems.length > 0) {
            if (!isPureUnitTestTask && rangeItems.every(item => item.isUnitTest)) {
              const lessonItemsOnly = masterLessons.filter(item => !item.isUnitTest);
              if (lessonItemsOnly.length > 0) return lessonItemsOnly;
            }
            return rangeItems;
          }
        }

        if (startIdx >= 0 || endIdx >= 0) {
          const minI = startIdx >= 0 && endIdx >= 0 ? Math.min(startIdx, endIdx) : (startIdx >= 0 ? startIdx : endIdx);
          const maxI = startIdx >= 0 && endIdx >= 0 ? Math.max(startIdx, endIdx) : (endIdx >= 0 ? endIdx : startIdx);
          const sliced = masterLessons.slice(minI, maxI + 1);
          if (!isPureUnitTestTask && sliced.every(item => item.isUnitTest)) {
            const validItem = masterLessons[startIdx >= 0 ? startIdx : endIdx];
            if (validItem.unit_name) {
              const sameUnitLessons = masterLessons.filter(m => m.unit_name === validItem.unit_name && !m.isUnitTest);
              if (sameUnitLessons.length > 0) return sameUnitLessons;
            }
          }
          return sliced;
        }
      }
    }

    // fallback to curriculumUnits (該当教科のみに厳密制限)
    const subjectUnits = units
      .filter(u => {
        if (u.subject === taskSubject) return true;
        if ((taskSubject === '算数' || taskSubject === '数学') && (u.subject === '算数' || u.subject === '数学')) return true;
        return false;
      })
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

  // 次回通塾予定日の計算ヘルパー
  const getNextAttendanceDate = (baseDateStr: string, st: Student): string => {
    const validBase = baseDateStr && !isNaN(new Date(baseDateStr).getTime()) ? baseDateStr : new Date().toISOString().split('T')[0];
    const days = st.selected_days && st.selected_days.length > 0 ? st.selected_days : ['tuesday', 'friday'];
    
    const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const targetDayNums = days.map(d => dayMap[d.toLowerCase()]).filter(n => n !== undefined);
    
    const d = new Date(validBase);
    for (let i = 1; i <= 14; i++) {
      const future = new Date(d.getTime() + i * 24 * 60 * 60 * 1000);
      if (targetDayNums.includes(future.getDay())) {
        return future.toISOString().split('T')[0];
      }
    }
    const fallback = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
    return fallback.toISOString().split('T')[0];
  };

  // 合格時：次回通塾日へ新単元の最初の授業（From: 新単元 STEP 1）を自動セット・引き継ぎ
  const scheduleNextUnitForStudent = async (st: Student, targetSubject?: string) => {
    const nextAttendanceDate = getNextAttendanceDate(currentDateStr, st);
    const completedSet = new Set((st.completed_lesson_ids || []).map(String));
    const isElem = st.grade.startsWith('小') || /^[1-6]年生?$/.test(st.grade) || st.grade === '園児';
    const activeSubj = targetSubject || (isElem ? '算数' : '数学');
    
    let candidateMasters = curriculumMasters
      .filter(m => m.subject === activeSubj || (isElem && m.subject === '算数') || (!isElem && m.subject === '数学'))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (candidateMasters.length === 0) {
      candidateMasters = db.getCurriculumMasters()
        .filter(m => m.subject === activeSubj || (isElem && m.subject === '算数') || (!isElem && m.subject === '数学'))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    
    const nextNewMaster = candidateMasters.find(m => !completedSet.has(String(m.id)) && !completedSet.has(String(m.sort_order)));
    if (nextNewMaster) {
      const nextTitle = nextNewMaster.unit_name ? `${nextNewMaster.unit_name} - ${nextNewMaster.lesson_name}` : nextNewMaster.lesson_name;
      const nextNewTask: LearningTask = {
        id: `task-nextunit-${st.id}-${nextAttendanceDate}-1`,
        student_id: st.id,
        unit_id: nextNewMaster.id,
        scheduled_date: nextAttendanceDate,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: activeSubj,
        custom_unit_name: nextTitle,
        start_lesson_id: nextNewMaster.id,
        end_lesson_id: nextNewMaster.id,
        start_lesson_name: nextTitle,
        end_lesson_name: nextTitle,
        lesson_range: nextTitle,
        created_at: new Date().toISOString()
      };
      await db.deleteLearningTasksForDate(st.id, nextAttendanceDate);
      await db.saveLearningTasks([nextNewTask]);
      showToast(`🎉 単元テスト合格＆他教科完了！次回通塾日（${nextAttendanceDate}）から新単元「${nextTitle}」へ進みます！`);
    }
  };

  // テスト不合格時のアクション（やり直し授業の自動追加＆完了ボタン発生、次回通塾日に再テスト自動予約）
  const handleProcessUnitTestFailure = async (
    targetTask?: LearningTask,
    testSubject?: string,
    testUnitName?: string,
    testPassingLine?: string | null
  ) => {
    const unit = targetTask ? units.find(u => u.id === targetTask.unit_id) : undefined;
    const subjectName = targetTask?.subject || testSubject || (unit ? unit.subject : '算数');
    const rawUnitName = targetTask?.start_lesson_name || targetTask?.custom_unit_name || testUnitName || (unit ? unit.name : '単元');
    const cleanUnitName = rawUnitName
      .replace(/【やり直し授業】/g, '')
      .replace(/（再テスト）/g, '')
      .replace(/復習/g, '')
      .replace(/単元確認テスト\s*ーやり直しー/g, '')
      .replace(/ーやり直しー/g, '')
      .replace(/\s*-\s*単元確認テスト/g, '')
      .replace(/\s*-\s*単元テスト/g, '')
      .replace(/\s*-\s*確認テスト/g, '')
      .replace(/単元確認テスト/g, '')
      .replace(/単元テスト/g, '')
      .replace(/確認テスト/g, '')
      .trim() || '単元';
    const reTestContent = `${subjectName}: ${cleanUnitName}（再テスト）`;

    const updatedTask: LearningTask | undefined = targetTask ? {
      ...targetTask,
      status: 'failed' as const,
      test_passed: false
    } : undefined;

    // 0. 本日の小テスト結果管理にも不合格結果を保存・更新（講師ダッシュボードとの完全連動）
    const failedScoreVal = targetTask && taskScores[targetTask.id] ? parseInt(taskScores[targetTask.id], 10) : 60;
    const todayMini = db.getMiniTestResults().filter(r => r.student_id === currentStudent.id && r.date === currentDateStr);
    const existingMini = todayMini.find(m => 
      (targetTask && m.task_id === targetTask.id) ||
      (m.subject === subjectName && (m.test_content?.includes(cleanUnitName) || m.unit_name === cleanUnitName))
    );
    const todayMiniFailed: MiniTestResult = {
      id: existingMini?.id || `mini-unit-fail-${currentStudent.id}-${targetTask?.id || Date.now()}`,
      student_id: currentStudent.id,
      task_id: targetTask?.id,
      date: currentDateStr,
      subject: subjectName,
      test_type: 'unit_test',
      unit_name: cleanUnitName,
      test_content: `${subjectName}: ${cleanUnitName} - 単元確認テスト`,
      score: isNaN(failedScoreVal) ? 60 : failedScoreVal,
      passed: false,
      status: 'failed',
      passing_line: targetTask?.passing_line || testPassingLine || '80%以上',
      target_scope: 'individual',
      completed_at: new Date().toISOString(),
      students: {
        id: currentStudent.id,
        name: currentStudent.name,
        grade: currentStudent.grade
      },
      created_at: existingMini?.created_at || new Date().toISOString()
    };
    await db.saveMiniTestResult(todayMiniFailed);
    setMiniTestResults(prev => {
      const idx = prev.findIndex(p => p.id === todayMiniFailed.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = todayMiniFailed;
        return copy;
      }
      return [...prev, todayMiniFailed];
    });

    // 1. 直後のコマ（2コマ目）に「単元確認テスト　ーやり直しー」を挿入し、後続タスクをシフト＆旧やり直しタスクを排除
    const currentDayAllTasks = db.getLearningTasks().filter(t => t.student_id === currentStudent.id && t.scheduled_date === currentDateStr);

    // クリーンアップ対象: 古い【やり直し授業】を含むタスク、または既存の重複やり直しタスク
    const sanitizedDayTasks = currentDayAllTasks.filter(t => {
      if (targetTask && t.id === targetTask.id) return false;
      const isRemedial = t.custom_unit_name?.includes('【やり直し授業】') ||
                         t.start_lesson_name?.includes('【やり直し授業】') ||
                         t.lesson_range?.includes('【やり直し授業】') ||
                         t.custom_unit_name?.includes('ーやり直しー') ||
                         t.start_lesson_name?.includes('ーやり直しー') ||
                         t.lesson_range?.includes('ーやり直しー');
      return !isRemedial;
    });

    const targetPeriod = targetTask?.period || 1;
    const remedialPeriod = targetPeriod + 1; // 1の不合格なら直後の2コマ目に挿入！
    const remedialTitle = '単元確認テスト　ーやり直しー';

    // targetPeriod より後のタスク（元々のコマ2の英語、コマ3の国語など）の period を +1 シフト
    const shiftedTasks = sanitizedDayTasks.map(t => {
      if ((t.period || 0) >= remedialPeriod) {
        return {
          ...t,
          period: (t.period || 0) + 1
        };
      }
      return t;
    });

    const remedialTask: LearningTask = {
      id: `task-remedial-${currentStudent.id}-${Date.now()}`,
      student_id: currentStudent.id,
      unit_id: `remedial-${Date.now()}`,
      scheduled_date: currentDateStr,
      period: remedialPeriod,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: subjectName,
      custom_unit_name: remedialTitle,
      start_lesson_id: '',
      end_lesson_id: '',
      start_lesson_name: remedialTitle,
      end_lesson_name: remedialTitle,
      lesson_range: remedialTitle,
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };

    const newDayTasks = [
      ...(updatedTask ? [updatedTask] : []),
      remedialTask,
      ...shiftedTasks
    ].sort((a, b) => (a.period || 0) - (b.period || 0));

    // 当日のタスクを新構成で同期保存
    await db.deleteLearningTasksForDate(currentStudent.id, currentDateStr);
    await db.saveLearningTasks(newDayTasks);

    setTasks(prev => {
      const otherDateTasks = prev.filter(t => !(t.student_id === currentStudent.id && t.scheduled_date === currentDateStr));
      return [...otherDateTasks, ...newDayTasks];
    });
    setTodayTasks(newDayTasks);

    // 2. 次回通塾予定日の計算 & 再テスト自動スケジュール
    const nextAttendanceDate = getNextAttendanceDate(currentDateStr, currentStudent);

    // 次回通塾日の「本日のテスト」に再テストを自動セット
    const reTestResult: MiniTestResult = {
      id: `mini-retest-${currentStudent.id}-${nextAttendanceDate}-${Date.now()}`,
      student_id: currentStudent.id,
      date: nextAttendanceDate,
      subject: subjectName,
      test_type: 'unit_test',
      unit_name: cleanUnitName,
      test_content: reTestContent,
      score: null,
      passed: null,
      status: 'unstarted',
      passing_line: targetTask?.passing_line || testPassingLine || '80%以上',
      target_scope: 'individual',
      students: {
        id: currentStudent.id,
        name: currentStudent.name,
        grade: currentStudent.grade
      },
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(reTestResult);

    // 次回通塾日のコマ割りに「開始: 再テスト 〜 終了: 再テスト」を自動セット (新単元授業を割り当てない)
    const reTestTask: LearningTask = {
      id: `task-retest-${currentStudent.id}-${nextAttendanceDate}-1`,
      student_id: currentStudent.id,
      unit_id: targetTask?.unit_id || `retest-${Date.now()}`,
      scheduled_date: nextAttendanceDate,
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: subjectName,
      custom_unit_name: reTestContent,
      start_lesson_id: targetTask?.start_lesson_id || targetTask?.unit_id || '',
      end_lesson_id: targetTask?.end_lesson_id || targetTask?.unit_id || '',
      start_lesson_name: `${cleanUnitName} - 単元確認テスト（再テスト）`,
      end_lesson_name: `${cleanUnitName} - 単元確認テスト（再テスト）`,
      lesson_range: `${cleanUnitName} - 単元確認テスト（再テスト）`,
      created_at: new Date().toISOString()
    };
    await db.deleteLearningTasksForDate(currentStudent.id, nextAttendanceDate);
    await db.saveLearningTasks([reTestTask]);

    // ログ記録
    const log: LearningLog = {
      id: `log-${Date.now()}`,
      student_id: currentStudent.id,
      unit_id: targetTask?.unit_id || `retest-${Date.now()}`,
      log_type: 'test_result',
      score: 40,
      total_questions: 10,
      incorrect_genres: ['計算ミス', '符号の誤り'],
      created_at: new Date().toISOString()
    };
    await db.addLearningLog(log);

    showToast(`⚠️ テスト不合格のため本日の授業に「単元確認テスト　ーやり直しー」を追加しました。次回通塾日（${nextAttendanceDate}）に再テストを実施します。`);
    if (typeof window !== 'undefined') {
      window.alert(`不合格のため、本日の授業に「単元確認テスト　ーやり直しー」を追加しました。\n次回通塾日（${nextAttendanceDate}）に再テスト（${cleanUnitName}）を自動セットしました。`);
    }

    loadData();
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

    const isUnitTest = Boolean(
      task.start_lesson_name?.includes('単元テスト') ||
      task.start_lesson_name?.includes('確認テスト') ||
      task.start_lesson_name?.includes('単元確認テスト') ||
      task.start_lesson_name?.includes('再テスト') ||
      task.end_lesson_name?.includes('単元テスト') ||
      task.end_lesson_name?.includes('確認テスト') ||
      task.end_lesson_name?.includes('単元確認テスト') ||
      task.end_lesson_name?.includes('再テスト') ||
      task.lesson_range?.includes('単元テスト') ||
      task.lesson_range?.includes('確認テスト') ||
      task.lesson_range?.includes('単元確認テスト') ||
      task.lesson_range?.includes('再テスト') ||
      task.custom_unit_name?.includes('単元テスト') ||
      task.custom_unit_name?.includes('確認テスト') ||
      task.custom_unit_name?.includes('単元確認テスト') ||
      task.custom_unit_name?.includes('再テスト')
    ) && !task.custom_unit_name?.includes('ーやり直しー') && !task.start_lesson_name?.includes('ーやり直しー') && !task.lesson_range?.includes('ーやり直しー');

    const isAllStepsCompleted = allSteps.length > 0 && allSteps.every(s => currentTaskCompletedIds.has(String(s.id)));

    let newStatus: LearningTask['status'] = task.status;
    let newTestPassed = task.test_passed || false;
    let newActualCompletedDate = task.actual_completed_date;

    if (isUnitTest) {
      // 単元テストの場合: ステップ完了は「実施した」記録のみ。合否（status / test_passed）は点数判断でのみ決定する！
      // 既に合格している場合を除き、勝手に completed や test_passed: true にしない！
      // 既に failed の場合は failed を維持！
      if (task.status === 'failed') {
        newStatus = 'failed';
        newTestPassed = false;
      } else if (task.status === 'completed') {
        newStatus = 'completed';
        newTestPassed = true;
      } else {
        newStatus = 'unstarted';
        newTestPassed = false;
      }
    } else {
      // 通常授業タスクの場合: 全ステップ完了ならコマ完了（合格）
      if (isAllStepsCompleted) {
        newStatus = 'completed';
        newTestPassed = true;
        newActualCompletedDate = currentDateStr;
      } else {
        newStatus = task.status === 'completed' ? 'completed' : 'unstarted';
      }
    }

    const updatedTask: LearningTask = {
      ...task,
      completed_lesson_ids: Array.from(currentTaskCompletedIds),
      video_watched: true,
      status: newStatus,
      test_passed: newTestPassed,
      actual_completed_date: newActualCompletedDate
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
    setLessonProgressList(prev => [
      ...prev.filter(p => !(p.student_id === student.id && p.lesson_id === stepIdStr)),
      {
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
      }
    ]);

    if (isUnitTest) {
      showToast(`📝 STEP ${stepIndex + 1}「${step.name || step.fullTitle}」を受講しました！テストの点数を入力して判定してください⚔️`);
    } else if (isAllStepsCompleted) {
      showToast(`🎉 【第${task.period}コマ 完了！】全ステップを達成しました！右側の学習マップも進捗しました！`);

      // 他の教科の授業もすべて完了したか確認
      const allCurrentTasks = db.getLearningTasks().filter(t => t.student_id === currentStudent.id && t.scheduled_date === currentDateStr);
      const otherTasks = allCurrentTasks.filter(t => t.id !== task.id);
      const allOthersCompleted = otherTasks.every(t => t.status === 'completed');
      if (allOthersCompleted) {
        // 当日単元テストに合格しているタスクがあるかチェック
        const passedUnitTest = allCurrentTasks.find(t => 
          (t.custom_unit_name?.includes('単元テスト') || t.custom_unit_name?.includes('確認テスト') || t.start_lesson_name?.includes('単元テスト')) &&
          (t.status === 'completed' || t.test_passed)
        );
        if (passedUnitTest) {
          await scheduleNextUnitForStudent(updatedStudent, passedUnitTest.subject);
        }
      }
    } else {
      showToast(`🎉 STEP ${stepIndex + 1}「${step.name || step.fullTitle}」を受講完了にしました！`);
    }

    // 🌐 2. バックエンド (Supabase / LocalStorage) への非同期保存処理（堅牢・フォールバック保存構造）
    try {
      // (a) 生徒情報（completed_lesson_ids）とタスク情報をフォールバックとして最優先保存
      await db.saveStudent(updatedStudent);
      await db.saveLearningTasks([updatedTask]);
    } catch (primarySaveErr) {
      console.error('プライマリデータ保存エラー (フォールバック保持):', primarySaveErr);
    }

    try {
      // (b) レッスン進捗 (student_lesson_progress) を保存
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
    } catch (progressErr) {
      console.error('student_lesson_progress 保存警告 (completed_lesson_idsにて保持済み):', progressErr);
    }

    try {
      // (c) ログ記録
      await db.addLearningLog({
        id: `log-step-${Date.now()}`,
        student_id: student.id,
        unit_id: task.unit_id || stepIdStr,
        log_type: 'video_view',
        duration_seconds: 600,
        created_at: new Date().toISOString()
      });

      if (isAllStepsCompleted && !isUnitTest) {
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
    } catch (logErr) {
      console.warn('学習ログ保存警告 (進捗完了処理は継続):', logErr);
    }
  };

  // 生徒による小テスト結果の送信
  const handleSaveStudentScore = async (testId: string, scoreInput: string) => {
    const test = miniTestResults.find(r => r.id === testId);
    if (!test) return;

    const scoreVal = scoreInput === '' ? null : parseInt(scoreInput, 10);
    if (scoreVal !== null && (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100)) {
      alert('0〜100の点数を入力してください。');
      return;
    }

    const stLevel = student.level || 'A';
    let passScore = stLevel === 'A' ? 90 : stLevel === 'B' ? 80 : 70;
    if (test.passing_line) {
      const matchNum = test.passing_line.match(/\d+/);
      if (matchNum) {
        const limit = parseInt(matchNum[0], 10);
        if (test.passing_line.includes('%') || test.passing_line.includes('割')) {
          passScore = test.passing_line.includes('割') ? limit * 10 : limit;
        } else {
          passScore = limit;
        }
      }
    }

    const isPassed = scoreVal !== null ? scoreVal >= passScore : null;
    const status = scoreVal !== null ? (isPassed ? 'passed' : 'failed') : 'unstarted';
    const completedAt = scoreVal !== null ? new Date().toISOString() : null;

    const updated: MiniTestResult = {
      ...test,
      student_id: test.student_id || student.id,
      score: scoreVal,
      passed: isPassed,
      status: status,
      completed_at: completedAt,
      students: {
        id: student.id,
        name: student.name,
        grade: student.grade
      }
    };

    setMiniTestResults(prev => prev.map(t => t.id === testId ? updated : t));
    setStudentScores(prev => ({
      ...prev,
      [testId]: scoreVal !== null ? String(scoreVal) : ''
    }));

    await db.saveMiniTestResult(updated);

    const isUnitTest = test.test_type === 'unit_test' || 
                       test.unit_name?.includes('単元テスト') || 
                       test.test_content?.includes('単元テスト') ||
                       test.unit_name?.includes('確認テスト');

    if (isUnitTest && scoreVal !== null) {
      const relatedTask = todayTasks.find(t => 
        (t.subject === test.subject || !t.subject) &&
        (t.custom_unit_name?.includes('単元テスト') || t.custom_unit_name?.includes('確認テスト') || t.start_lesson_name?.includes('単元テスト'))
      );

      if (!isPassed) {
        await handleProcessUnitTestFailure(relatedTask, test.subject, test.unit_name || test.test_content, test.passing_line);
        return;
      } else {
        if (relatedTask) {
          await handlePassTest(relatedTask);
          return;
        } else {
          const otherUncompleted = todayTasks.some(t => t.status !== 'completed');
          if (otherUncompleted) {
            showToast('単元テスト合格！他の教科の授業を完了すると、次回から新しい単元に進みます！');
          } else {
            await scheduleNextUnitForStudent(currentStudent, test.subject);
          }
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.alert('小テスト点数を送信しました！');
    }
    showToast('小テスト点数を送信しました！');
    loadData();
  };

  // 生徒学習画面の各教科コマ下から単元テスト結果（点数）を送信・記録
  const handleSaveTaskUnitTestScore = async (task: LearningTask, scoreInput?: string) => {
    const rawVal = scoreInput !== undefined && scoreInput !== '' ? scoreInput : (taskScores[task.id] || '');
    if (rawVal === '') {
      if (typeof window !== 'undefined') window.alert('点数を入力してください。');
      return;
    }

    const scoreVal = parseInt(rawVal, 10);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      if (typeof window !== 'undefined') window.alert('0〜100の点数を入力してください。');
      return;
    }

    const stLevel = currentStudent.level || 'A';
    let passScore = stLevel === 'A' ? 90 : stLevel === 'B' ? 80 : 70;
    if (task.passing_line) {
      const matchNum = task.passing_line.match(/\d+/);
      if (matchNum) {
        const limit = parseInt(matchNum[0], 10);
        passScore = (task.passing_line.includes('%') || task.passing_line.includes('割'))
          ? (task.passing_line.includes('割') ? limit * 10 : limit)
          : limit;
      }
    }

    const isPassed = scoreVal >= passScore;
    const unit = units.find(u => u.id === task.unit_id);
    const subjectName = task.subject || (unit ? unit.subject : 'その他');
    const rawUnitName = task.start_lesson_name || task.custom_unit_name || (unit ? unit.name : '単元');
    const cleanUnitName = rawUnitName
      .replace(/【やり直し授業】/g, '')
      .replace(/（再テスト）/g, '')
      .replace(/復習/g, '')
      .replace(/単元確認テスト\s*ーやり直しー/g, '')
      .replace(/ーやり直しー/g, '')
      .replace(/\s*-\s*単元確認テスト/g, '')
      .replace(/\s*-\s*単元テスト/g, '')
      .replace(/\s*-\s*確認テスト/g, '')
      .replace(/単元確認テスト/g, '')
      .replace(/単元テスト/g, '')
      .replace(/確認テスト/g, '')
      .trim() || '単元';
    const testContent = `${subjectName}: ${cleanUnitName} - 単元確認テスト`;

    // 講師ダッシュボードの「小テスト結果管理」と完全連動するMiniTestResultを作成・更新
    const todayMini = db.getMiniTestResults().filter(r => r.student_id === currentStudent.id && r.date === currentDateStr);
    const existingMini = todayMini.find(m => 
      (m.task_id === task.id) ||
      (m.subject === subjectName && (m.test_content === testContent || m.unit_name === cleanUnitName))
    );

    const miniResult: MiniTestResult = {
      id: existingMini?.id || `mini-unit-${currentStudent.id}-${task.id}`,
      student_id: currentStudent.id,
      task_id: task.id,
      date: currentDateStr,
      subject: subjectName,
      test_type: 'unit_test',
      unit_name: cleanUnitName,
      test_content: testContent,
      score: scoreVal,
      passed: isPassed,
      status: isPassed ? 'passed' : 'failed',
      completed_at: new Date().toISOString(),
      passing_line: task.passing_line || `レベル${stLevel} (${passScore}点以上)`,
      target_scope: 'individual',
      students: {
        id: currentStudent.id,
        name: currentStudent.name,
        grade: currentStudent.grade
      },
      created_at: existingMini?.created_at || new Date().toISOString()
    };

    await db.saveMiniTestResult(miniResult);
    setMiniTestResults(prev => {
      const idx = prev.findIndex(p => p.id === miniResult.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = miniResult;
        return copy;
      }
      return [...prev, miniResult];
    });

    setTaskScores(prev => ({ ...prev, [task.id]: String(scoreVal) }));

    if (isPassed) {
      await handlePassTest(task, scoreVal);
      if (typeof window !== 'undefined') {
        window.alert(`🎉 単元テスト合格！ (${scoreVal}点)\n講師ダッシュボードに小テスト結果が連動・記録されました。`);
      }
    } else {
      await handleProcessUnitTestFailure(task, subjectName, cleanUnitName, miniResult.passing_line);
    }
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
    setLessonProgressList(prev => [
      ...prev.filter(p => !(p.student_id === student.id && stepIds.includes(p.lesson_id))),
      ...stepLessons.map(step => ({
        id: `slp-${student.id}-${String(step.id)}`,
        student_id: student.id,
        subject: task.subject || 'その他',
        lesson_id: String(step.id),
        lesson_name: step.name || step.fullTitle,
        task_id: task.id,
        date: currentDateStr,
        status: 'completed' as const,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }))
    ]);
    showToast(`🎉 【第${task.period}コマ 完了！】授業の全ステップを完了にしました！`);

    // 🌐 2. バックエンド保存（最優先フォールバック保存）
    try {
      await db.saveStudent(updatedStudent);
      await db.saveLearningTasks([updatedTask]);
    } catch (primaryErr) {
      console.error('一括完了 プライマリ保存エラー (フォールバック保持):', primaryErr);
    }

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
      console.warn('addLearningLog error:', e);
    }

    // 他の教科の授業もすべて完了したか確認
    const allCurrentTasks = db.getLearningTasks().filter(t => t.student_id === currentStudent.id && t.scheduled_date === currentDateStr);
    const otherTasks = allCurrentTasks.filter(t => t.id !== task.id);
    const allOthersCompleted = otherTasks.every(t => t.status === 'completed');
    if (allOthersCompleted) {
      const passedUnitTest = allCurrentTasks.find(t => 
        (t.custom_unit_name?.includes('単元テスト') || t.custom_unit_name?.includes('確認テスト') || t.start_lesson_name?.includes('単元テスト')) &&
        (t.status === 'completed' || t.test_passed)
      );
      if (passedUnitTest) {
        await scheduleNextUnitForStudent(updatedStudent, passedUnitTest.subject);
      }
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
  const handlePassTest = async (task: LearningTask, passedScore?: number) => {
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

    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    setTodayTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    await db.saveLearningTasks([updated]);
    await db.saveStudent(updatedStudent);

    // 単元テストの場合、小テスト結果管理にも合格結果を保存（講師ダッシュボード完全連動）
    const unit = units.find(u => u.id === task.unit_id);
    const subjectName = task.subject || (unit ? unit.subject : 'その他');
    const rawUnitName = task.start_lesson_name || task.custom_unit_name || (unit ? unit.name : '単元');
    const cleanUnitName = rawUnitName
      .replace(/【やり直し授業】/g, '')
      .replace(/（再テスト）/g, '')
      .replace(/復習/g, '')
      .replace(/単元確認テスト\s*ーやり直しー/g, '')
      .replace(/ーやり直しー/g, '')
      .replace(/\s*-\s*単元確認テスト/g, '')
      .replace(/\s*-\s*単元テスト/g, '')
      .replace(/\s*-\s*確認テスト/g, '')
      .replace(/単元確認テスト/g, '')
      .replace(/単元テスト/g, '')
      .replace(/確認テスト/g, '')
      .trim() || '単元';
    const testContent = `${subjectName}: ${cleanUnitName} - 単元確認テスト`;
    const todayMini = db.getMiniTestResults().filter(r => r.student_id === currentStudent.id && r.date === currentDateStr);
    const existingMini = todayMini.find(m => (m.task_id === task.id) || (m.subject === subjectName && (m.test_content === testContent || m.unit_name === cleanUnitName)));
    const stLevel = currentStudent.level || 'A';
    const defaultPassScore = stLevel === 'A' ? 90 : stLevel === 'B' ? 80 : 70;
    const finalScore = passedScore !== undefined ? passedScore : (existingMini?.score !== null && existingMini?.score !== undefined ? existingMini.score : 100);

    const miniResult: MiniTestResult = {
      id: existingMini?.id || `mini-unit-${currentStudent.id}-${task.id}`,
      student_id: currentStudent.id,
      task_id: task.id,
      date: currentDateStr,
      subject: subjectName,
      test_type: 'unit_test',
      unit_name: cleanUnitName,
      test_content: testContent,
      score: finalScore,
      passed: true,
      status: 'passed',
      completed_at: new Date().toISOString(),
      passing_line: task.passing_line || `レベル${stLevel} (${defaultPassScore}点以上)`,
      target_scope: 'individual',
      students: {
        id: currentStudent.id,
        name: currentStudent.name,
        grade: currentStudent.grade
      },
      created_at: existingMini?.created_at || new Date().toISOString()
    };
    await db.saveMiniTestResult(miniResult);
    setMiniTestResults(prev => {
      const idx = prev.findIndex(p => p.id === miniResult.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = miniResult;
        return copy;
      }
      return [...prev, miniResult];
    });

    // 合格時：他の教科の授業も完了していれば、次回通塾日へ新単元の最初の授業（From: 新単元 STEP 1）を自動セット・引き継ぎ
    const isUnitTestTask = task.custom_unit_name?.includes('確認テスト') || 
                           task.custom_unit_name?.includes('単元テスト') || 
                           task.start_lesson_name?.includes('確認テスト') ||
                           task.start_lesson_name?.includes('単元テスト') ||
                           task.lesson_range?.includes('単元テスト');
    const allDayTasks = db.getLearningTasks().filter(t => t.student_id === updatedStudent.id && t.scheduled_date === currentDateStr);
    const otherTasksToday = allDayTasks.filter(t => t.id !== task.id);
    const hasUncompletedOtherTask = otherTasksToday.some(t => t.status !== 'completed');

    if (isUnitTestTask) {
      if (hasUncompletedOtherTask) {
        showToast('単元テスト合格！他の教科の授業を完了すると、次回から新しい単元に進みます！');
      } else {
        await scheduleNextUnitForStudent(updatedStudent, task.subject);
      }
    } else {
      // 通常授業完了時でも、本日単元テスト合格済みがあり全教科完了した場合は次回新単元をアンロック
      if (!hasUncompletedOtherTask) {
        const passedUnitTest = allDayTasks.find(t => 
          (t.custom_unit_name?.includes('単元テスト') || t.custom_unit_name?.includes('確認テスト') || t.start_lesson_name?.includes('単元テスト')) &&
          (t.status === 'completed' || t.test_passed)
        );
        if (passedUnitTest) {
          await scheduleNextUnitForStudent(updatedStudent, passedUnitTest.subject);
        }
      }
    }

    const log: LearningLog = {
      id: `log-${Date.now()}`,
      student_id: student.id,
      unit_id: task.unit_id,
      log_type: 'test_result',
      score: passedScore !== undefined ? passedScore : 95,
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

  // 3. テスト不合格時のアクション（新単元ブロック ＆ 次回通塾日に再テスト自動予約＆当日やり直し授業追加）
  const handleFailTest = async (task: LearningTask) => {
    await handleProcessUnitTestFailure(task);
  };

  // 4. 当日全コマ完了後の「🚀 次の単元を先取り学習する」アクション
  const handleStartAdvanceLearning = async () => {
    const isElem = currentStudent.grade.startsWith('小') || currentStudent.grade === '園児';
    const activeSubj = isElem ? '算数' : '数学';
    
    const completedSet = new Set((currentStudent.completed_lesson_ids || []).map(String));
    const candidateMasters = curriculumMasters
      .filter(m => m.subject === activeSubj || (isElem && m.subject === '算数') || (!isElem && m.subject === '数学'))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    
    const nextMaster = candidateMasters.find(m => !completedSet.has(String(m.id)) && !completedSet.has(String(m.sort_order)));
    
    const advanceSubject = nextMaster?.subject || activeSubj;
    const advanceTitle = nextMaster ? (nextMaster.unit_name ? `${nextMaster.unit_name} - ${nextMaster.lesson_name}` : nextMaster.lesson_name) : '新単元先取り学習';
    
    const nextPeriod = todayTasks.length + 1;
    const advanceTask: LearningTask = {
      id: `task-advance-${currentStudent.id}-${currentDateStr}-${Date.now()}`,
      student_id: currentStudent.id,
      unit_id: nextMaster?.id || `advance-${Date.now()}`,
      scheduled_date: currentDateStr,
      period: nextPeriod,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: advanceSubject,
      custom_unit_name: `🚀 先取り: ${advanceTitle}`,
      start_lesson_id: nextMaster?.id || '',
      end_lesson_id: nextMaster?.id || '',
      start_lesson_name: advanceTitle,
      end_lesson_name: advanceTitle,
      lesson_range: advanceTitle,
      created_at: new Date().toISOString()
    };

    await db.saveLearningTasks([advanceTask]);
    showToast(`🚀 【先取り学習開始】${advanceSubject}: ${advanceTitle} を今日のタスクに追加しました！`);
    loadData();
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

      {/* Duolingo Inspired Header */}
      <div className={styles.header}>
        <div className={styles.studentInfo}>
          <div className={styles.studentAvatar}>
            🎓
          </div>
          <div className={styles.studentNameGroup}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0 }}>
                {currentStudent.name} さんの学習画面
              </h1>
              <span className={styles.gradeBadge}>学年: {currentStudent.grade}</span>
            </div>
            <div className={styles.studentMeta}>
              <span className={styles.streakBadge}>🔥 3日連続学習中！</span>
              {currentStudent.status !== 'normal' && (
                <span>
                  {getStatusBadge(currentStudent.status)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button 
            onClick={() => setShowScheduleConfig(!showScheduleConfig)} 
            className={styles.subtleBtn}
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

      {/* Mobile Segment Control (iPad/スマホ対応) */}
      <div className={styles.mobileSegmentControl}>
        <button
          type="button"
          className={`${styles.mobileSegmentBtn} ${activeMobileTab === 'mission' ? styles.mobileSegmentBtnActive : ''}`}
          onClick={() => setActiveMobileTab('mission')}
        >
          🎯 今日のミッション
        </button>
        <button
          type="button"
          className={`${styles.mobileSegmentBtn} ${activeMobileTab === 'map' ? styles.mobileSegmentBtnActive : ''}`}
          onClick={() => setActiveMobileTab('map')}
        >
          🗺️ 冒険マップ
        </button>
      </div>

      <div className={styles.grid}>
        {/* Left Side: Todays Timetable & Missions */}
        <div 
          className={styles.todoCard}
          style={{ display: activeMobileTab === 'map' ? undefined : 'block' }}
        >
          {/* Duolingo-style Mission Progress Bar */}
          {(() => {
            // Calculate today's total missions and completed missions
            let totalMissions = 0;
            let completedMissions = 0;

            // Mini Tests
            miniTestResults.forEach(t => {
              totalMissions += 1;
              if (t.score !== null && t.score !== undefined) {
                const passScore = (student.level === 'A' ? 90 : student.level === 'B' ? 80 : 70);
                if (t.score >= passScore) completedMissions += 1;
              }
            });

            // Timetable Step Lessons
            todayTasks.forEach(task => {
              const stepLessons = getTaskStepLessons(task);
              const completedStepIds = new Set<string>();
              if (task.status === 'completed' || task.test_passed) {
                stepLessons.forEach(s => completedStepIds.add(String(s.id)));
                (task.completed_lesson_ids || []).forEach(id => completedStepIds.add(String(id)));
              } else {
                (task.completed_lesson_ids || []).forEach(id => completedStepIds.add(String(id)));
                lessonProgressList
                  .filter(p => p.student_id === currentStudent.id && p.task_id === task.id && p.status === 'completed')
                  .forEach(p => completedStepIds.add(String(p.lesson_id)));
              }
              stepLessons.forEach(s => {
                totalMissions += 1;
                if (completedStepIds.has(String(s.id))) completedMissions += 1;
              });
            });

            // Homeworks
            homeworkResults.forEach(hw => {
              totalMissions += 1;
              if (hw.status === 'completed') completedMissions += 1;
            });

            const remaining = Math.max(0, totalMissions - completedMissions);
            const percent = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 100;

            return (
              <div className={styles.dailyProgressCard} data-testid="student-daily-progress-card">
                <div className={styles.dailyProgressHeader}>
                  <span>
                    {remaining === 0 && totalMissions > 0 ? (
                      '🎉 今日のミッション全達成！すばらしい！'
                    ) : (
                      `🎯 今日のミッション完了まで あと${remaining}つ！`
                    )}
                  </span>
                  <span>{completedMissions} / {totalMissions} 完了 ({percent}%)</span>
                </div>
                <div className={styles.progressBarTrack}>
                  <div 
                    className={styles.progressBarFill} 
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
              {/* Clock Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  padding: '6px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
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
                  className={styles.subtleBtn}
                  style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                >
                  📅 今日に戻る
                </button>
              )}
            </div>
          </div>

          {/* 直近の通塾予定日を表示している場合の案内バナー */}
          {currentDateStr !== systemTodayStr && todayTasks.length > 0 && (
            <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#eff6ff', borderRadius: '12px', border: '1.5px solid #bfdbfe', fontSize: '0.82rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <span style={{ fontSize: '1.1rem' }}>💡</span>
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
                  borderRadius: '14px', 
                  border: '1.5px solid #fde68a', 
                  borderLeft: '5px solid #f59e0b', 
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)' 
                }} 
                data-testid="office-note-card"
              >
                <h3 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#92400e', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📢 講師からの業務連絡
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#78350f', whiteSpace: 'pre-wrap', fontWeight: 600, lineHeight: 1.5 }}>
                  {officeNote}
                </p>
              </div>
            );
          })()}

          {/* 🎯 本日のテスト（ボス戦 / チャレンジカード） */}
          {miniTestResults.length > 0 && (
            <div 
              className={styles.bossTestCard}
              data-testid="today-test-card"
            >
              <div className={styles.bossTestHeader}>
                <span style={{ fontSize: '1.2rem' }}>⚔️</span>
                <span>🎯 本日のテスト（ボス戦チャレンジ）</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {miniTestResults.map(test => {
                  const stLevel = student.level || 'A';
                  const passScore = stLevel === 'A' ? 90 : stLevel === 'B' ? 80 : 70;
                  const currentScore = test.score;
                  let statusBadge = null;
                  const isPassed = test.status === 'passed' || test.passed === true || (currentScore !== null && currentScore !== undefined && currentScore >= passScore);
                  const isFailed = test.status === 'failed' || test.passed === false || (currentScore !== null && currentScore !== undefined && currentScore < passScore);

                  if (isPassed) {
                    statusBadge = (
                      <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '6px 12px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800, border: '1.5px solid #86efac' }}>
                        合格 ✨
                      </span>
                    );
                  } else if (isFailed) {
                    statusBadge = (
                      <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '6px 12px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800, border: '1.5px solid #fca5a5' }}>
                        不合格 (再挑戦) ⚠️
                      </span>
                    );
                  }
                  const testSub = test.subject || (student.grade?.startsWith('中') ? '数学' : '算数');
                  const isUnitTest = test.test_type === 'unit_test' || test.test_content.includes('単元') || test.test_content.includes('確認');

                  return (
                    <div key={test.id} className={styles.bossTestItem} data-testid={`test-item-${test.id}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: '8px', backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                          {testSub}
                        </span>
                        {isUnitTest && (
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: '8px', backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1.5px solid #d8b4fe' }}>
                            📝 単元テスト
                          </span>
                        )}
                        <span style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: 800 }}>
                          {test.test_content}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
                          ({test.passing_line ? `目標: ${test.passing_line}` : `レベル${stLevel}目標: ${passScore}点`})
                        </span>
                      </div>
                      <div className={styles.testScoreInputGroup}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>点数を入力: </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={studentScores[test.id] !== undefined ? studentScores[test.id] : (test.score !== null && test.score !== undefined ? String(test.score) : '')}
                          onChange={e => setStudentScores({ ...studentScores, [test.id]: e.target.value })}
                          placeholder="点数を入力"
                          className={styles.scoreInput}
                          data-testid={`test-score-input-${test.id}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveStudentScore(test.id, studentScores[test.id])}
                          className={styles.btn3dRed}
                          data-testid={`test-save-btn-${test.id}`}
                        >
                          撃破報告（保存） ⚔️
                        </button>
                        {statusBadge}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 📝 今日の宿題カード */}
          {homeworkResults.length > 0 && (
            <div 
              className={styles.homeworkCard}
              data-testid="today-homework-card"
            >
              <div className={styles.homeworkHeader}>
                <span style={{ fontSize: '1.1rem' }}>📝</span>
                <span>今日の宿題ミッション</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {homeworkResults.map(hw => (
                  <div key={hw.id} className={styles.homeworkItem} data-testid={`homework-item-${hw.id}`}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', color: '#1e293b', whiteSpace: 'pre-wrap', fontWeight: 700, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      {hw.subject && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: 800 }}>
                          {hw.subject}
                        </span>
                      )}
                      {hw.homework_content}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {hw.homework_deadline && (
                        <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700 }}>
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
              {(() => {
                const uniqueTaskMap = new Map<string, LearningTask>();
                todayTasks.forEach(task => {
                  const isOldRemedial = task.custom_unit_name?.includes('【やり直し授業】') ||
                                        task.start_lesson_name?.includes('【やり直し授業】') ||
                                        task.lesson_range?.includes('【やり直し授業】');
                  if (isOldRemedial) return;
                  const key = task.period != null ? `p-${task.period}` : task.id;
                  if (!uniqueTaskMap.has(key)) {
                    uniqueTaskMap.set(key, task);
                  }
                });
                const taskList = Array.from(uniqueTaskMap.values()).sort((a, b) => (a.period || 0) - (b.period || 0));
                const firstIncompleteTask = taskList.find(t => t.status !== 'completed');
                const mainQuestTaskId = firstIncompleteTask ? firstIncompleteTask.id : (taskList[0] ? taskList[0].id : null);

                return taskList.map(task => {
                  const unit = units.find(u => u.id === task.unit_id);
                  const subjectName = task.subject || (unit ? unit.subject : 'その他');
                  const themeName = task.lesson_range 
                    || (task.start_lesson_name && task.end_lesson_name && task.start_lesson_name !== task.end_lesson_name 
                        ? `${task.start_lesson_name} 〜 ${task.end_lesson_name}` 
                        : (task.start_lesson_name || task.custom_unit_name || (unit ? unit.name : 'テーマ設定なし')));
                  const googleDriveUrl = unit?.google_drive_url;
                  const isCustomTask = !unit;
                  const isReviewOrCheckTask = Boolean(
                    task.start_lesson_name?.includes('まとめテスト') ||
                    task.start_lesson_name?.toLowerCase().includes('check test') ||
                    task.lesson_range?.includes('まとめテスト') ||
                    task.lesson_range?.toLowerCase().includes('check test') ||
                    task.custom_unit_name?.includes('まとめテスト') ||
                    task.custom_unit_name?.toLowerCase().includes('check test')
                  );
                  const isRemedialTask = Boolean(
                    task.custom_unit_name?.includes('やり直し授業') ||
                    task.start_lesson_name?.includes('やり直し授業') ||
                    task.lesson_range?.includes('やり直し授業') ||
                    task.custom_unit_name?.includes('ーやり直しー') ||
                    task.start_lesson_name?.includes('ーやり直しー') ||
                    task.lesson_range?.includes('ーやり直しー') ||
                    task.custom_unit_name?.includes('単元確認テスト　ーやり直しー') ||
                    task.start_lesson_name?.includes('単元確認テスト　ーやり直しー') ||
                    task.lesson_range?.includes('単元確認テスト　ーやり直しー')
                  );
                  const isUnitTestTask = Boolean(
                    !isReviewOrCheckTask &&
                    !isRemedialTask && (
                      task.start_lesson_name?.includes('単元テスト') ||
                      task.start_lesson_name?.includes('確認テスト') ||
                      task.start_lesson_name?.includes('単元確認テスト') ||
                      task.start_lesson_name?.includes('再テスト') ||
                      task.end_lesson_name?.includes('単元テスト') ||
                      task.end_lesson_name?.includes('確認テスト') ||
                      task.end_lesson_name?.includes('単元確認テスト') ||
                      task.end_lesson_name?.includes('再テスト') ||
                      task.lesson_range?.includes('単元テスト') ||
                      task.lesson_range?.includes('確認テスト') ||
                      task.lesson_range?.includes('単元確認テスト') ||
                      task.lesson_range?.includes('再テスト') ||
                      task.custom_unit_name?.includes('単元テスト') ||
                      task.custom_unit_name?.includes('確認テスト') ||
                      task.custom_unit_name?.includes('単元確認テスト') ||
                      task.custom_unit_name?.includes('再テスト')
                    )
                  );
                  const showCustomCompletion = !isUnitTestTask && (isCustomTask || isReviewOrCheckTask || isRemedialTask);
                  const isMainQuest = task.id === mainQuestTaskId && task.status !== 'completed';

                  const stLevel = currentStudent.level || 'A';
                  let passScore = stLevel === 'A' ? 90 : stLevel === 'B' ? 80 : 70;
                  if (task.passing_line) {
                    const matchNum = task.passing_line.match(/\d+/);
                    if (matchNum) {
                      const limit = parseInt(matchNum[0], 10);
                      passScore = (task.passing_line.includes('%') || task.passing_line.includes('割'))
                        ? (task.passing_line.includes('割') ? limit * 10 : limit)
                        : limit;
                    }
                  }

                  const stepLessons = getTaskStepLessons(task);
                  const completedStepIds = new Set<string>();
                  if (task.status === 'completed' || task.test_passed) {
                    stepLessons.forEach(s => completedStepIds.add(String(s.id)));
                    (task.completed_lesson_ids || []).forEach(id => completedStepIds.add(String(id)));
                  } else {
                    (task.completed_lesson_ids || []).forEach(id => completedStepIds.add(String(id)));
                    lessonProgressList
                      .filter(p => p.student_id === currentStudent.id && p.task_id === task.id && p.status === 'completed')
                      .forEach(p => completedStepIds.add(String(p.lesson_id)));
                  }

                  const completedCount = stepLessons.filter(s => completedStepIds.has(String(s.id))).length;

                  // 教科バッジスタイル
                  let subjectBadgeClass = styles.subjectBadgeMath;
                  if (subjectName.includes('英語')) subjectBadgeClass = styles.subjectBadgeEnglish;
                  else if (subjectName.includes('国語')) subjectBadgeClass = styles.subjectBadgeJapanese;
                  else if (subjectName.includes('理科')) subjectBadgeClass = styles.subjectBadgeScience;
                  else if (subjectName.includes('社会')) subjectBadgeClass = styles.subjectBadgeSocial;

                  return (
                    <div 
                      key={task.id} 
                      id={`period-row-${task.period}`}
                      className={`${styles.periodRow} ${isMainQuest ? styles.mainQuestRow : ''}`} 
                      data-testid={`period-row-${task.period}`}
                    >
                      <div className={styles.periodNumber}>{task.period}</div>
                      <div className={styles.periodContent}>
                        <div className={styles.periodHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className={styles.subjectName}>
                              <span className={subjectBadgeClass}>{subjectName}</span>
                            </span>
                            {isMainQuest && (
                              <span className={styles.mainQuestBadge}>
                                ★ 今日のメインクエスト
                              </span>
                            )}
                          </div>
                          <div>
                            {task.status === 'completed' && <span className={`${styles.badge} ${styles.statusNormal}`} data-testid={`task-completed-badge-${task.period}`}>合格完了！</span>}
                            {task.status === 'failed' && <span className={`${styles.badge} ${styles.statusWarning}`}>不合格 (再挑戦)</span>}
                          </div>
                        </div>
                        <div className={styles.unitName}>{themeName}</div>

                        {/* Step-by-Step Lesson Progress Cards */}
                        {stepLessons.length > 0 && (
                          <div className={styles.stepCardContainer}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                    <span style={{ color: '#2563eb', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>STEP {sIdx + 1}:</span>
                                    <span style={{ minWidth: 0, wordBreak: 'break-word', flex: '1 1 auto' }}>{step.name || step.fullTitle}</span>
                                  </div>
                                  <div style={{ flexShrink: 0, minWidth: 'max-content' }}>
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
                          <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#b45309', background: '#fffbeb', padding: '4px 10px', borderRadius: '6px', display: 'inline-block', fontWeight: 600 }}>
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

                        {/* 📝 単元テスト結果入力エリア（各教科の下） */}
                        {isUnitTestTask && (
                          <div 
                            className={styles.unitTestScoreSection}
                            data-testid={`unit-test-score-section-${task.period}`}
                            style={{
                              marginTop: '12px',
                              marginBottom: '8px',
                              padding: '12px 14px',
                              backgroundColor: '#f8fafc',
                              borderRadius: '10px',
                              border: '1.5px solid #cbd5e1',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>
                                  📝 単元テスト結果入力
                                </span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                                  {subjectName}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                                目標: レベル{stLevel} ({passScore}点以上で合格)
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <label htmlFor={`task-score-input-${task.period}`} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                                点数を入力:
                              </label>
                              <input
                                id={`task-score-input-${task.period}`}
                                type="number"
                                min="0"
                                max="100"
                                placeholder="点数を入力"
                                value={taskScores[task.id] !== undefined ? taskScores[task.id] : ''}
                                onChange={e => setTaskScores(prev => ({ ...prev, [task.id]: e.target.value }))}
                                style={{
                                  width: '120px',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1.5px solid #cbd5e1',
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                  textAlign: 'center'
                                }}
                                data-testid={`task-score-input-${task.period}`}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveTaskUnitTestScore(task, taskScores[task.id])}
                                className={styles.btn3dRed}
                                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                                data-testid={`task-score-submit-btn-${task.period}`}
                              >
                                結果を送信して判定 ⚔️
                              </button>

                              {task.status === 'completed' && (
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#16a34a', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '6px' }}>
                                  ✅ 合格
                                </span>
                              )}
                              {task.status === 'failed' && (
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#dc2626', backgroundColor: '#fee2e2', padding: '3px 8px', borderRadius: '6px' }}>
                                  ⚠️ 不合格 (やり直し授業へ)
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Student Tasks Actions */}
                        <div className={styles.actions}>
                          {isUnitTestTask ? (
                            task.status !== 'completed' && (
                              task.status === 'failed' ? (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const lastPeriod = todayTasks.length > 0 ? Math.max(...todayTasks.map(t => t.period || 1)) : 1;
                                      const remedialEl = document.querySelector(`[data-testid="period-row-${lastPeriod}"]`) ||
                                                         document.getElementById(`period-row-${lastPeriod}`);
                                      if (typeof remedialEl?.scrollIntoView === 'function') {
                                        remedialEl.scrollIntoView({ behavior: 'smooth' });
                                      }
                                    }}
                                    className={`${styles.btn} ${styles.btnSecondary}`}
                                    style={{
                                      backgroundColor: '#fee2e2',
                                      borderColor: '#fca5a5',
                                      color: '#b91c1c',
                                      fontWeight: 800,
                                      cursor: 'pointer'
                                    }}
                                    data-testid={`remedial-task-action-btn-${task.period}`}
                                  >
                                    単元確認テスト　ーやり直しー
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <button 
                                    onClick={() => handleSaveTaskUnitTestScore(task, taskScores[task.id] || '100')} 
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
                                </div>
                              )
                            )
                          ) : showCustomCompletion ? (
                            task.status !== 'completed' && (
                              <button 
                                onClick={() => handleCompleteCustomTask(task)} 
                                className={isMainQuest ? styles.btn3dQuest : `${styles.btn} ${styles.btnSuccess}`}
                                data-testid={`complete-task-btn-${task.period}`}
                              >
                                {isRemedialTask ? 'この授業を完了にする' : (stepLessons.length > 1 ? 'このコマの全ステップを一括完了にする' : (isMainQuest ? '学習をスタート！ ▶' : 'この授業を完了にする'))}
                              </button>
                            )
                          ) : (
                            <>
                              {!task.video_watched && task.status !== 'completed' ? (
                                <button 
                                  onClick={() => handleWatchVideo(task)} 
                                  className={isMainQuest ? styles.btn3dQuest : `${styles.btn} ${styles.btnPrimary}`}
                                >
                                  {isMainQuest ? '学習をスタート！ ▶ (動画10分)' : '動画を視聴する (10分)'}
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
                });
              })()}
              {todayTasks.length > 0 && todayTasks.every(t => t.status === 'completed') && (
                <div style={{ marginTop: '16px', padding: '18px', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderRadius: '16px', border: '2px solid #34d399', textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#065f46', fontSize: '1.05rem', fontWeight: 800 }}>
                    🎉 本日の学習予定をすべて完了しました！お疲れ様でした！
                  </h4>
                  <p style={{ margin: '0 0 14px 0', color: '#047857', fontSize: '0.85rem', fontWeight: 600 }}>
                    時間に余力がある場合は、次の単元を先取りしてさらにステップアップしましょう！
                  </p>
                  <button
                    type="button"
                    onClick={handleStartAdvanceLearning}
                    className={`${styles.btn} ${styles.btnSuccess}`}
                    style={{ width: 'auto', padding: '10px 24px', fontSize: '0.9rem', margin: '0 auto' }}
                    data-testid="advance-learning-btn"
                  >
                    🚀 次の単元を先取り学習する（新単元 STEP 1〜）
                  </button>
                </div>
              )}
              {/* コマの最後に1つだけ今日の業務連絡を表示 */}
              {todayTasks.some(t => t.office_note) && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#fef3c7', borderRadius: '10px', borderLeft: '4px solid #d97706', fontSize: '0.85rem', color: '#78350f', fontWeight: 600 }}>
                  <strong>💡 今日の業務連絡:</strong> {todayTasks.find(t => t.office_note)?.office_note}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Sugoroku Maps */}
        <div style={{ display: activeMobileTab === 'mission' ? undefined : 'block' }}>
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
      </div>
    </div>
  );
}
