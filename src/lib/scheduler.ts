import { CurriculumUnit, CurriculumMaster, LearningTask, Student, ExamThresholdMaster, MilestonePlan, BranchAIRules, DEFAULT_BRANCH_AI_RULES, StudentLessonProgress } from './db';

export const schedulerConfig = {
  maxDailyTasksDefault: 3,
};

/**
 * 授業範囲文字列のフォーマット ("開始 〜 目標" または "開始")
 */
export function formatLessonRange(startName?: string | null, endName?: string | null): string {
  if (!startName && !endName) return '';
  if (startName && endName && startName !== endName) {
    return `${startName} 〜 ${endName}`;
  }
  return startName || endName || '';
}

/**
 * 生徒の前回までの完了状況に基づき、次回授業日の開始授業 (From: 直近の未完了授業) を特定する
 */
export function findNextUncompletedLessonForSubject(params: {
  student?: Student | null;
  subject: string;
  tasks?: LearningTask[];
  curriculumMasters?: CurriculumMaster[];
  curriculumUnits?: CurriculumUnit[];
  schoolId?: string;
  lessonProgressList?: StudentLessonProgress[];
}): {
  lessonId: string | null;
  lessonName: string | null;
  masterIndex: number;
} {
  const {
    student,
    subject,
    tasks = [],
    curriculumMasters = [],
    curriculumUnits = [],
    schoolId = student?.school_id,
    lessonProgressList = []
  } = params;

  // 1. 対象教科の全授業リストを抽出
  let masterLessons = curriculumMasters
    .filter(m => m.subject === subject || (subject === '算数' && m.subject === '数学') || (subject === '数学' && m.subject === '算数'))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(m => ({
      id: m.id,
      name: m.unit_name ? `${m.unit_name} - ${m.lesson_name}` : m.lesson_name,
      sort_order: m.sort_order ?? 0
    }));

  if (masterLessons.length === 0) {
    const unitLessons = curriculumUnits
      .filter(u => (!schoolId || u.school_id === schoolId || !u.school_id) && 
                   (u.subject === subject || (subject === '数学' && u.subject === '算数') || (subject === '算数' && u.subject === '数学')))
      .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
      .map(u => ({
        id: u.id,
        name: u.name,
        sort_order: u.sequence_order ?? 0
      }));
    if (unitLessons.length > 0) {
      masterLessons = unitLessons;
    }
  }

  if (masterLessons.length === 0) {
    return { lessonId: null, lessonName: null, masterIndex: -1 };
  }

  if (!student) {
    return {
      lessonId: masterLessons[0].id,
      lessonName: masterLessons[0].name,
      masterIndex: 0
    };
  }

  // 2. 完了した授業IDを収集
  const completedIds = new Set<string>();
  if (student.completed_lesson_ids) {
    student.completed_lesson_ids.forEach(id => completedIds.add(id));
  }
  lessonProgressList
    .filter(p => p.student_id === student.id && p.status === 'completed')
    .forEach(p => completedIds.add(p.lesson_id));

  // 完了したタスク内の completed_lesson_ids や unit_id
  const studentCompletedTasks = tasks.filter(t => t.student_id === student.id && (t.status === 'completed' || t.test_passed));
  studentCompletedTasks.forEach(t => {
    if (t.completed_lesson_ids) {
      t.completed_lesson_ids.forEach(id => completedIds.add(id));
    }
    if (t.unit_id) completedIds.add(t.unit_id);
    if (t.start_lesson_id) completedIds.add(t.start_lesson_id);
    if (t.end_lesson_id) completedIds.add(t.end_lesson_id);
  });

  // 3. スタート位置設定があれば、その位置より前の授業はスキップ扱い（探索開始位置とする）
  const startUnitId = getStudentStartUnitIdForSubject(student, subject);
  let startThresholdIdx = 0;
  if (startUnitId) {
    const sIdx = masterLessons.findIndex(m => m.id === startUnitId || String(m.sort_order) === String(startUnitId));
    if (sIdx >= 0) startThresholdIdx = sIdx;
  }

  // 4. masterLessons の中で、startThresholdIdx 以降でまだ完了していない最初の授業を探す
  for (let i = startThresholdIdx; i < masterLessons.length; i++) {
    const l = masterLessons[i];
    if (!completedIds.has(l.id)) {
      return {
        lessonId: l.id,
        lessonName: l.name,
        masterIndex: i
      };
    }
  }

  // 全て完了している場合は最後の授業
  const lastLesson = masterLessons[masterLessons.length - 1];
  return {
    lessonId: lastLesson.id,
    lessonName: lastLesson.name,
    masterIndex: masterLessons.length - 1
  };
}

/**
 * 生徒のこれまでの消化ペース（1コマあたりの授業数）と校舎ルールを参照し、
 * 次回授業の適切な目標授業（To）をAI/ロジックが自動推論する
 */
export function inferStudentSubjectPace(params: {
  student?: Student | null;
  subject: string;
  tasks?: LearningTask[];
  branchRules?: BranchAIRules | null;
  lessonProgressList?: StudentLessonProgress[];
}): {
  estimatedLessonsPerSlot: number;
  reason: string;
} {
  const { student, subject, tasks = [], branchRules, lessonProgressList = [] } = params;
  const basePace = branchRules?.lessons_per_slot || 2;

  if (!student) {
    return { estimatedLessonsPerSlot: basePace, reason: `校舎標準ペース (${basePace}授業/コマ)` };
  }

  // 1. 直近の完了タスクから消化スピードを算出
  const completedSubjectTasks = tasks.filter(t => 
    t.student_id === student.id &&
    t.status === 'completed' &&
    (t.subject === subject || (!t.subject && (subject === '数学' || subject === '算数')))
  );

  let totalLessonsCompleted = 0;
  let countOfSessions = 0;

  completedSubjectTasks.forEach(task => {
    if (task.completed_lesson_ids && task.completed_lesson_ids.length > 0) {
      totalLessonsCompleted += task.completed_lesson_ids.length;
      countOfSessions++;
    } else if (task.lesson_range && task.lesson_range.includes('〜')) {
      totalLessonsCompleted += basePace + 0.5;
      countOfSessions++;
    } else {
      totalLessonsCompleted += basePace;
      countOfSessions++;
    }
  });

  // もし過去の実績がある場合、その平均値
  let dynamicPace = countOfSessions > 0 ? (totalLessonsCompleted / countOfSessions) : basePace;

  // 2. 生徒のステータスによる補正
  let reason = '';
  if (student.status === 'fast') {
    dynamicPace = Math.max(dynamicPace, basePace + 1);
    reason = `🚀 爆速進行モード: 直近実績 (${dynamicPace.toFixed(1)}授業) に基づき先取り目標を設定`;
  } else if (student.status === 'warning') {
    dynamicPace = Math.min(dynamicPace, Math.max(1, basePace - 1));
    reason = `⚠️ 計画パンク防止: 確実な定着のためペースを調整 (${Math.round(dynamicPace)}授業/コマ)`;
  } else if (countOfSessions > 0) {
    reason = `🤖 AI推論: 過去${countOfSessions}回の平均消化ペース (${dynamicPace.toFixed(1)}授業/コマ) を適用`;
  } else {
    reason = `校舎設定ルール: 標準${basePace}授業/コマ`;
  }

  // 3. レベル補正
  if (student.level === 'A') {
    dynamicPace = Math.max(dynamicPace, 2);
  } else if (student.level === 'C') {
    dynamicPace = Math.min(dynamicPace, 2);
  }

  const roundedPace = Math.max(1, Math.min(5, Math.round(dynamicPace)));

  return {
    estimatedLessonsPerSlot: roundedPace,
    reason
  };
}

/**
 * 1コマあたりの進捗授業範囲（From 〜 To）を算出する
 */
export function calculateLessonRangeForSlot(params: {
  subject: string;
  startLessonId?: string | null;
  lessonsPerSlot?: number;
  curriculumMasters?: CurriculumMaster[];
  curriculumUnits?: CurriculumUnit[];
  schoolId?: string;
  student?: Student | null;
  tasks?: LearningTask[];
  branchRules?: BranchAIRules | null;
  lessonProgressList?: StudentLessonProgress[];
}): {
  start_lesson_id: string | null;
  end_lesson_id: string | null;
  start_lesson_name: string | null;
  end_lesson_name: string | null;
  lesson_range: string | null;
  inferred_pace?: number;
  pace_reason?: string;
} {
  const {
    subject,
    startLessonId,
    lessonsPerSlot,
    curriculumMasters = [],
    curriculumUnits = [],
    schoolId = params.student?.school_id,
    student,
    tasks = [],
    branchRules,
    lessonProgressList = []
  } = params;

  // 1. 対象教科の授業リストを抽出
  let masterLessons = curriculumMasters
    .filter(m => m.subject === subject || (subject === '算数' && m.subject === '数学') || (subject === '数学' && m.subject === '算数'))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(m => ({
      id: m.id,
      name: m.unit_name ? `${m.unit_name} - ${m.lesson_name}` : m.lesson_name,
      sort_order: m.sort_order ?? 0
    }));

  if (masterLessons.length === 0 || (startLessonId && !masterLessons.some(m => m.id === startLessonId || String(m.sort_order) === String(startLessonId)) && curriculumUnits.some(u => u.id === startLessonId))) {
    const unitLessons = curriculumUnits
      .filter(u => (!schoolId || u.school_id === schoolId || !u.school_id) && (u.subject === subject || (subject === '数学' && u.subject === '算数') || (subject === '算数' && u.subject === '数学')))
      .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
      .map(u => ({
        id: u.id,
        name: u.name,
        sort_order: u.sequence_order ?? 0
      }));
    if (unitLessons.length > 0) {
      masterLessons = unitLessons;
    }
  }

  if (masterLessons.length === 0) {
    return {
      start_lesson_id: startLessonId || null,
      end_lesson_id: startLessonId || null,
      start_lesson_name: null,
      end_lesson_name: null,
      lesson_range: null
    };
  }

  // 2. 開始授業の特定 (startLessonId がなければ直近の未完了授業を自動特定)
  let startIdx = 0;
  if (startLessonId) {
    const foundIdx = masterLessons.findIndex(m => m.id === startLessonId || String(m.sort_order) === String(startLessonId));
    if (foundIdx >= 0) {
      startIdx = foundIdx;
    }
  } else if (student) {
    const nextUncompleted = findNextUncompletedLessonForSubject({
      student,
      subject,
      tasks,
      curriculumMasters,
      curriculumUnits,
      schoolId,
      lessonProgressList
    });
    if (nextUncompleted.masterIndex >= 0) {
      startIdx = nextUncompleted.masterIndex;
    }
  }

  // 3. ペース推論 (lessonsPerSlot が未指定なら AI 推論)
  let effectivePace = lessonsPerSlot;
  let paceReason = '';
  if (!effectivePace) {
    const inference = inferStudentSubjectPace({
      student,
      subject,
      tasks,
      branchRules,
      lessonProgressList
    });
    effectivePace = inference.estimatedLessonsPerSlot;
    paceReason = inference.reason;
  }

  const endIdx = Math.min(startIdx + Math.max(1, effectivePace) - 1, masterLessons.length - 1);
  const startItem = masterLessons[startIdx];
  const endItem = masterLessons[endIdx];

  const startName = startItem?.name || null;
  const endName = endItem?.name || startName;
  const rangeStr = formatLessonRange(startName, endName);

  return {
    start_lesson_id: startItem?.id || null,
    end_lesson_id: endItem?.id || startItem?.id || null,
    start_lesson_name: startName,
    end_lesson_name: endName,
    lesson_range: rangeStr || null,
    inferred_pace: effectivePace,
    pace_reason: paceReason
  };
}

/**
 * 学年区分と通塾時間から「標準コマ数」を自動算出するユーティリティ関数
 * @param gradeType 'elementary' (小学生) または 'junior_high' (中学生/高校生)
 * @param weeklyDuration 通塾時間 ('60min', '90min', '120min', '180min', '240min', 'unlimited', '120' など)
 * @returns コマ数 (2〜10)
 */
export function calculateDefaultSlots(
  gradeType: 'elementary' | 'junior_high' | string,
  weeklyDuration: string
): number {
  if (gradeType === 'elementary') {
    return 2;
  }

  const durationStr = (weeklyDuration || '').toLowerCase().replace('min', '').trim();
  if (durationStr === '120') return 2;
  if (durationStr === '180') return 3;
  if (durationStr === '240') return 4;
  if (durationStr === 'unlimited' || durationStr === '無制限') return 5;

  const numDuration = parseInt(durationStr, 10);
  if (!isNaN(numDuration)) {
    if (numDuration <= 120) return 2;
    if (numDuration <= 180) return 3;
    if (numDuration <= 240) return 4;
    return Math.min(10, Math.max(2, Math.round(numDuration / 60)));
  }

  return 2;
}

// -------------------------------------------------------------
// 0. 日付・進捗ギャップ・通塾開始連動ユーティリティ
// -------------------------------------------------------------
export function getYearMonthWeek(dateStr: string): { month: number; week_number: number } {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  
  // 月曜日を週の始まりとする (0:日, 1:月, ..., 6:土)
  const firstDay = new Date(year, date.getMonth(), 1);
  const firstDayOfWeek = firstDay.getDay();
  const adjFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const weekNum = Math.ceil((dayOfMonth + adjFirstDay) / 7);
  
  return {
    month,
    week_number: Math.min(4, weekNum)
  };
}

/**
 * 通塾開始日・退塾日から在籍期間を自動算出する
 */
export function calculateEnrollmentPeriod(
  startDateStr?: string | null,
  endDateStr?: string | null
): { text: string; isWithdrawn: boolean } | null {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const isWithdrawn = Boolean(endDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  if (isNaN(end.getTime())) return null;

  if (end < start) {
    return { text: '在籍期間: 開始日以降の日付を指定してください', isWithdrawn };
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  let periodStr = '';
  if (years > 0 && months > 0) {
    periodStr = `${years}年${months}ヶ月`;
  } else if (years > 0) {
    periodStr = `${years}年`;
  } else if (months > 0) {
    periodStr = `${months}ヶ月`;
  } else {
    periodStr = '1ヶ月未満';
  }

  const prefix = isWithdrawn ? '在籍期間' : '在籍中';
  return {
    text: `${prefix}: ${periodStr}`,
    isWithdrawn
  };
}

/**
 * 通塾開始日以降で最も早い通塾曜日（Day 1）を特定する
 */
export function getFirstAttendanceDate(
  enrollmentDateStr?: string | null,
  selectedDays?: string[] | null
): string {
  const baseDate = enrollmentDateStr ? new Date(enrollmentDateStr) : new Date();
  if (isNaN(baseDate.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  const days = (selectedDays && selectedDays.length > 0) ? selectedDays : ['tuesday', 'friday'];
  
  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0, '日': 0, '0': 0,
    'monday': 1, 'mon': 1, '月': 1, '1': 1,
    'tuesday': 2, 'tue': 2, '火': 2, '2': 2,
    'wednesday': 3, 'wed': 3, '水': 3, '3': 3,
    'thursday': 4, 'thu': 4, '木': 4, '4': 4,
    'friday': 5, 'fri': 5, '金': 5, '5': 5,
    'saturday': 6, 'sat': 6, '土': 6, '6': 6,
  };

  const targetDayNums = new Set(
    days.map(d => dayMap[d.toLowerCase()] ?? -1).filter(n => n !== -1)
  );

  if (targetDayNums.size === 0) {
    return baseDate.toISOString().split('T')[0];
  }

  const check = new Date(baseDate.getTime());
  for (let i = 0; i < 14; i++) {
    if (targetDayNums.has(check.getDay())) {
      return check.toISOString().split('T')[0];
    }
    check.setDate(check.getDate() + 1);
  }

  return baseDate.toISOString().split('T')[0];
}

/**
 * 通塾開始日（Day 1）から始まる通塾日の日付リストを生成する
 */
export function generateAttendanceDates(
  startDateStr: string,
  selectedDays: string[] | null | undefined,
  count: number
): string[] {
  const dates: string[] = [];
  if (count <= 0) return dates;

  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0, '日': 0, '0': 0,
    'monday': 1, 'mon': 1, '月': 1, '1': 1,
    'tuesday': 2, 'tue': 2, '火': 2, '2': 2,
    'wednesday': 3, 'wed': 3, '水': 3, '3': 3,
    'thursday': 4, 'thu': 4, '木': 4, '4': 4,
    'friday': 5, 'fri': 5, '金': 5, '5': 5,
    'saturday': 6, 'sat': 6, '土': 6, '6': 6,
  };
  const targetDayNums = new Set(
    (selectedDays && selectedDays.length > 0 ? selectedDays : ['tuesday', 'friday'])
      .map(d => dayMap[d.toLowerCase()] ?? -1)
      .filter(n => n !== -1)
  );

  const cur = new Date(startDateStr);
  let attempts = 0;
  while (dates.length < count && attempts < 1000) {
    if (targetDayNums.size === 0 || targetDayNums.has(cur.getDay())) {
      dates.push(cur.toISOString().split('T')[0]);
    }
    cur.setDate(cur.getDate() + 1);
    attempts++;
  }

  return dates;
}

/**
 * 生徒の教科ごとのスタート位置（単元ID）を取得するヘルパー関数
 */
export function getStudentStartUnitIdForSubject(student?: Student | null, subject?: string): string | null {
  if (!student || !subject) return null;
  const sub = subject;

  if (sub === '数学' || sub === '算数') {
    return student.start_unit_math || student.subject_start_positions?.['数学'] || student.subject_start_positions?.['算数'] || student.start_unit_id || null;
  }
  if (sub === '英語') {
    return student.start_unit_english || student.subject_start_positions?.['英語'] || student.start_unit_id || null;
  }
  if (sub === '理科') {
    return student.start_unit_science || student.subject_start_positions?.['理科'] || student.start_unit_id || null;
  }
  if (sub === '社会' || sub === '歴史' || sub === '地理') {
    return student.start_unit_social || student.subject_start_positions?.['社会'] || student.subject_start_positions?.['歴史'] || student.subject_start_positions?.['地理'] || student.start_unit_id || null;
  }
  if (sub === '国語') {
    return student.start_unit_japanese || student.subject_start_positions?.['国語'] || student.start_unit_id || null;
  }
  return student.subject_start_positions?.[sub] || student.start_unit_id || null;
}

/**
 * 生徒の教科別スタート位置に基づき、未完了タスクのスキップ／未着手状態および通塾開始日スケジュールを再配置・再計算する
 */
export function applyStartPositionsToTasks(
  student: Student,
  allTasks: LearningTask[],
  allCurriculumUnits: CurriculumUnit[],
  curriculumMasters?: CurriculumMaster[]
): LearningTask[] {
  const masterUnitsAsCurriculum: CurriculumUnit[] = (curriculumMasters || []).map((m, idx) => ({
    id: m.id,
    school_id: '',
    subject: m.subject,
    name: m.unit_name ? `${m.unit_name} - ${m.lesson_name}` : m.lesson_name,
    sequence_order: m.sort_order ?? (idx + 1),
    created_at: m.created_at || ''
  }));
  const combinedUnits = [...allCurriculumUnits, ...masterUnitsAsCurriculum];
  const studentSchoolUnits = combinedUnits.filter(u => u.school_id === student.school_id || !u.school_id);
  const studentTasks = allTasks.filter(t => t.student_id === student.id);
  const otherTasks = allTasks.filter(t => t.student_id !== student.id);

  let updatedStudentTasks = studentTasks.map(task => {
    // 既に完了したタスクは変更しない
    if (task.status === 'completed') return task;

    const unit = studentSchoolUnits.find(u => u.id === task.unit_id || String(u.sequence_order) === String(task.unit_id));
    if (!unit) return task;

    const startUnitId = getStudentStartUnitIdForSubject(student, unit.subject);
    if (!startUnitId) {
      // スタート位置が指定されていない場合、自動スキップされたものは未着手に復帰
      if (task.status === 'skipped' && (task.office_note?.includes('スタート') || task.office_note?.includes('開始位置'))) {
        return {
          ...task,
          status: 'unstarted' as const,
          office_note: ''
        };
      }
      return task;
    }

    const startUnit = studentSchoolUnits.find(u => u.id === startUnitId || String(u.sequence_order) === String(startUnitId));
    if (!startUnit) return task;

    if (unit.sequence_order < startUnit.sequence_order) {
      // スタート位置より前の単元はスキップ
      if (task.status === 'unstarted') {
        return {
          ...task,
          status: 'skipped' as const,
          office_note: '★ スタートライン指定によりスキップ'
        };
      }
    } else if (task.status === 'skipped' && (task.office_note?.includes('スタート') || task.office_note?.includes('開始位置'))) {
      // スタート位置以降で以前スキップされていたものは未着手にリセット
      return {
        ...task,
        status: 'unstarted' as const,
        office_note: ''
      };
    }
    return task;
  });

  // 通塾開始日 (enrollment_date) が設定されている場合、初回通塾曜日（Day 1）から順にスケジュール日を再割り振り
  if (student.enrollment_date) {
    const firstDay = getFirstAttendanceDate(student.enrollment_date, student.selected_days);
    const activeTasks = updatedStudentTasks.filter(t => t.status === 'unstarted');
    if (activeTasks.length > 0) {
      const attendanceDates = generateAttendanceDates(firstDay, student.selected_days, activeTasks.length);
      let dateIdx = 0;
      updatedStudentTasks = updatedStudentTasks.map(t => {
        if (t.status === 'unstarted' && dateIdx < attendanceDates.length) {
          const newDate = attendanceDates[dateIdx++];
          return {
            ...t,
            scheduled_date: newDate
          };
        }
        return t;
      });
    }
  }

  return [...otherTasks, ...updatedStudentTasks];
}

export function calculateProgressGap(
  student: Student,
  allTasks: LearningTask[],
  milestonePlans: MilestonePlan[],
  curriculumUnits: CurriculumUnit[],
  currentDateStr: string,
  subject: string
): { gapWeeks: number; status: 'normal' | 'fast' | 'warning' } {
  const { month: currMonth, week_number: currWeek } = getYearMonthWeek(currentDateStr);
  
  const matchedPlans = milestonePlans
    .filter(p => p.grade === student.grade && p.subject === subject && p.course === 'standard')
    .sort((a, b) => {
      const monthOrder = (m: number) => m >= 3 ? m : m + 12;
      const am = monthOrder(a.month);
      const bm = monthOrder(b.month);
      if (am !== bm) return am - bm;
      return a.week_number - b.week_number;
    });

  if (matchedPlans.length === 0) {
    return { gapWeeks: 0, status: 'normal' };
  }

  const todayIdx = matchedPlans.findIndex(p => p.month === currMonth && p.week_number === currWeek);
  if (todayIdx === -1) {
    return { gapWeeks: 0, status: 'normal' };
  }

  const studentTasks = allTasks.filter(t => t.student_id === student.id && t.status === 'completed');
  const subjectUnits = curriculumUnits.filter(u => u.subject === subject);
  const subjectUnitIds = new Set(subjectUnits.map(u => u.id));
  const completedSubjectTasks = studentTasks.filter(t => subjectUnitIds.has(t.unit_id));
  
  let currentSequence = 0;
  if (completedSubjectTasks.length > 0) {
    const completedUnitIds = completedSubjectTasks.map(t => t.unit_id);
    const completedUnits = subjectUnits.filter(u => completedUnitIds.includes(u.id));
    currentSequence = Math.max(0, ...completedUnits.map(u => u.sequence_order));
  } else {
    const startUnitId = getStudentStartUnitIdForSubject(student, subject);

    if (startUnitId) {
      const startUnit = subjectUnits.find(u => u.id === startUnitId);
      if (startUnit) {
        currentSequence = startUnit.sequence_order - 1;
      }
    }
  }

  let studentIdx = -1;
  for (let i = 0; i < matchedPlans.length; i++) {
    const target = matchedPlans[i].target_sequence_order ?? 0;
    if (target <= currentSequence) {
      studentIdx = i;
    } else {
      break;
    }
  }

  const gapWeeks = studentIdx - todayIdx;

  let status: 'normal' | 'fast' | 'warning' = 'normal';
  if (gapWeeks <= -1) {
    status = 'warning';
  } else if (gapWeeks >= 1) {
    status = 'fast';
  }

  return { gapWeeks, status };
}

// -------------------------------------------------------------
// 1. カリキュラム順序変更時の未来タスク再編成
// -------------------------------------------------------------
export function reorganizeFutureTasks(
  studentId: string,
  subject: string,
  allTasks: LearningTask[],
  newUnits: CurriculumUnit[]
): LearningTask[] {
  // 当該生徒・当該教科のタスクのみをフィルタリング
  const studentTasks = allTasks.filter(t => t.student_id === studentId);
  const subjectUnitIds = new Set(newUnits.filter(u => u.subject === subject).map(u => u.id));
  
  // 対象のタスク
  const subjectTasks = studentTasks.filter(t => subjectUnitIds.has(t.unit_id));
  const otherTasks = allTasks.filter(t => !subjectTasks.some(st => st.id === t.id));

  // 完了済みのタスク（日付は固定）
  const completedTasks = subjectTasks.filter(t => t.status === 'completed');
  // 未完了のタスク（順序変更の影響を受ける）
  const futureTasks = subjectTasks.filter(t => t.status !== 'completed');

  if (futureTasks.length === 0) {
    return allTasks;
  }

  // 未来タスクの予定日リストを取得（昇順）
  const futureDates = futureTasks
    .map(t => t.scheduled_date)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // 新しい単元順序に従って未来の単元をソート
  // 新しいカリキュラム順での単元IDリスト
  const sortedUnitIds = newUnits
    .filter(u => u.subject === subject)
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map(u => u.id);

  // 未来タスクを新しい順序にソート
  const sortedFutureTasks = [...futureTasks].sort((a, b) => {
    return sortedUnitIds.indexOf(a.unit_id) - sortedUnitIds.indexOf(b.unit_id);
  });

  // 未来タスクに対して、元のスケジュール日を順番に再割り当て
  const reorganizedFutureTasks = sortedFutureTasks.map((task, index) => {
    // 日付リストの上限を超えないように安全に割り当て
    const date = futureDates[index];
    return {
      ...task,
      scheduled_date: date,
    };
  });

  return [...otherTasks, ...completedTasks, ...reorganizedFutureTasks];
}

// -------------------------------------------------------------
// 2. 遅れ時の自動リスケジュール & パンクアラート
// -------------------------------------------------------------
export function rescheduleDelayedTasks(
  student: Student,
  allTasks: LearningTask[],
  currentDate: string,
  futureDates: string[],
  maxDailyTasks: number = schedulerConfig.maxDailyTasksDefault,
  milestonePlans: MilestonePlan[] = [],
  curriculumUnits: CurriculumUnit[] = [],
  branchRules?: BranchAIRules,
  curriculumMasters: CurriculumMaster[] = []
): { updatedTasks: LearningTask[]; updatedStudent: Student; isPunked: boolean } {
  const studentTasks = allTasks.filter(t => t.student_id === student.id);
  const otherTasks = allTasks.filter(t => t.student_id !== student.id);

  // 1. 進捗ギャップ（遅れ週）の確認
  let maxWeeksBehind = 0;
  if (milestonePlans.length > 0 && curriculumUnits.length > 0) {
    const subjects = Array.from(new Set(curriculumUnits.map(u => u.subject)));
    for (const sub of subjects) {
      const { gapWeeks } = calculateProgressGap(student, allTasks, milestonePlans, curriculumUnits, currentDate, sub);
      if (gapWeeks < 0) {
        maxWeeksBehind = Math.max(maxWeeksBehind, Math.abs(gapWeeks));
      }
    }
  }

  // 2. 2日連続未達成のチェック
  const currentMs = new Date(currentDate).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const yesterdayDate = new Date(currentMs - oneDayMs).toISOString().split('T')[0];

  const yesterdayTasks = studentTasks.filter(t => t.scheduled_date === yesterdayDate);
  const todayTasks = studentTasks.filter(t => t.scheduled_date === currentDate);

  const yesterdayUncompleted = yesterdayTasks.length > 0 && yesterdayTasks.every(t => t.status !== 'completed');
  const todayUncompleted = todayTasks.length > 0 && todayTasks.every(t => t.status !== 'completed');

  const is2DaysConsecutiveUncompleted = yesterdayUncompleted && todayUncompleted;

  // 遅れがなく、かつ2日連続未達成でもない場合は何もしない
  if (maxWeeksBehind === 0 && !is2DaysConsecutiveUncompleted) {
    return { updatedTasks: allTasks, updatedStudent: student, isPunked: false };
  }

  // 未完了タスクの抽出
  const uncompletedTasks = studentTasks.filter(t => t.status !== 'completed' && t.status !== 'skipped');
  const completedTasks = studentTasks.filter(t => t.status === 'completed' || t.status === 'skipped');

  if (uncompletedTasks.length === 0 || futureDates.length === 0) {
    return { updatedTasks: allTasks, updatedStudent: student, isPunked: false };
  }

  // 3. デッドライン（目標期日：今週の週末日曜日）の特定
  const currDateObj = new Date(currentDate);
  const day = currDateObj.getDay();
  const diffToSunday = day === 0 ? 0 : 7 - day;
  const deadlineSunday = new Date(currDateObj.getTime() + diffToSunday * oneDayMs);
  const deadlineDateStr = deadlineSunday.toISOString().split('T')[0];

  // 4. 休校週の日付を除外した、デッドラインまでの有効な割り当て可能日を抽出
  const validFutureDates = futureDates.filter(dStr => {
    if (dStr > deadlineDateStr) return false;

    const { month: dMonth, week_number: dWeek } = getYearMonthWeek(dStr);
    const isHoliday = milestonePlans.some(p => 
      p.grade === student.grade && 
      p.course === 'standard' && 
      p.month === dMonth && 
      p.week_number === dWeek && 
      p.is_holiday
    );
    return !isHoliday;
  });

  // もしデッドラインまでに割り当て可能な日がない場合は、全体から休校週を除外した日付を使用
  let targetDates = validFutureDates;
  if (targetDates.length === 0) {
    targetDates = futureDates.filter(dStr => {
      const { month: dMonth, week_number: dWeek } = getYearMonthWeek(dStr);
      return !milestonePlans.some(p => 
        p.grade === student.grade && 
        p.course === 'standard' && 
        p.month === dMonth && 
        p.week_number === dWeek && 
        p.is_holiday
      );
    });
  }

  if (targetDates.length === 0) {
    targetDates = futureDates;
  }

  // 1日あたりの必要タスク数を算出
  const totalTasks = uncompletedTasks.length;
  const daysCount = targetDates.length;
  const tasksPerDay = Math.ceil(totalTasks / daysCount);

  // パンク判定
  if (tasksPerDay > maxDailyTasks) {
    const updatedStudent: Student = {
      ...student,
      status: 'warning',
    };
    return { updatedTasks: allTasks, updatedStudent, isPunked: true };
  }

  const lessonsPerSlot = branchRules?.lessons_per_slot || 2;

  // 均等配分する
  const rescheduledTasks = uncompletedTasks.map((task, index) => {
    const dateIndex = Math.floor(index / tasksPerDay);
    const scheduled_date = targetDates[Math.min(dateIndex, targetDates.length - 1)];
    
    let taskWithRange = { ...task, scheduled_date };
    if (!task.lesson_range && task.subject) {
      const range = calculateLessonRangeForSlot({
        subject: task.subject,
        startLessonId: task.start_lesson_id || task.unit_id,
        lessonsPerSlot,
        curriculumMasters,
        curriculumUnits,
        schoolId: student.school_id
      });
      if (range.lesson_range) {
        taskWithRange = {
          ...taskWithRange,
          start_lesson_name: task.start_lesson_name || range.start_lesson_name,
          end_lesson_name: task.end_lesson_name || range.end_lesson_name,
          start_lesson_id: task.start_lesson_id || range.start_lesson_id,
          end_lesson_id: task.end_lesson_id || range.end_lesson_id,
          lesson_range: range.lesson_range
        };
      }
    }
    return taskWithRange;
  });

  const updatedStudent: Student = {
    ...student,
    status: 'normal',
  };

  return {
    updatedTasks: [...otherTasks, ...completedTasks, ...rescheduledTasks],
    updatedStudent,
    isPunked: false,
  };
}

// -------------------------------------------------------------
// 3. 前倒しと爆速通知
// -------------------------------------------------------------
export function handleForwardTasks(
  student: Student,
  allTasks: LearningTask[],
  currentDate: string,
  weekEndDate: string
): { updatedTasks: LearningTask[]; updatedStudent: Student } {
  const studentTasks = allTasks.filter(t => t.student_id === student.id);
  const otherTasks = allTasks.filter(t => t.student_id !== student.id);

  // 今週期限（currentDate 〜 weekEndDate）までの未完了タスクがあるか確認
  const thisWeekTasks = studentTasks.filter(t => {
    const d = new Date(t.scheduled_date).getTime();
    const start = new Date(currentDate).getTime();
    const end = new Date(weekEndDate).getTime();
    return d >= start && d <= end;
  });

  const allCompletedThisWeek = thisWeekTasks.length > 0 && thisWeekTasks.every(t => t.status === 'completed');

  if (!allCompletedThisWeek) {
    return { updatedTasks: allTasks, updatedStudent: student };
  }

  // 今週のタスクが全て完了しているため、来週以降（weekEndDateより後）の未完了タスクを探す
  const futureUncompletedTasks = studentTasks
    .filter(t => new Date(t.scheduled_date).getTime() > new Date(weekEndDate).getTime() && t.status !== 'completed' && t.status !== 'skipped')
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  if (futureUncompletedTasks.length === 0) {
    return { updatedTasks: allTasks, updatedStudent: student };
  }

  // 最も近い未来のタスクを今日（currentDate）に前倒し
  const targetTask = futureUncompletedTasks[0];
  const updatedTasks = allTasks.map(t => {
    if (t.id === targetTask.id) {
      return {
        ...t,
        scheduled_date: currentDate,
      };
    }
    return t;
  });

  const updatedStudent: Student = {
    ...student,
    status: 'fast', // 爆速ステータス
  };

  return { updatedTasks, updatedStudent };
}

// -------------------------------------------------------------
// 4. 志望校判定合格％算出
// -------------------------------------------------------------
export function calculateMockExamPassRate(
  score: number,
  schoolCode: string,
  thresholds: ExamThresholdMaster[]
): number {
  const schoolThresholds = thresholds.filter(t => t.school_code === schoolCode);
  if (schoolThresholds.length === 0) return 0;

  // スコアが合致する閾値を探す
  const matched = schoolThresholds.find(t => score >= t.min_score && score <= t.max_score);
  if (matched) {
    return matched.probability;
  }

  // 範囲外の場合の極値補正
  const minThreshold = schoolThresholds.reduce((prev, curr) => prev.min_score < curr.min_score ? prev : curr);
  const maxThreshold = schoolThresholds.reduce((prev, curr) => prev.max_score > curr.max_score ? prev : curr);

  if (score < minThreshold.min_score) {
    return minThreshold.probability;
  }
  if (score > maxThreshold.max_score) {
    return maxThreshold.probability;
  }

  return 0;
}

// -------------------------------------------------------------
// 5. AI文体パーソナライズの簡易学習 & 補正ロジック
// -------------------------------------------------------------
export interface PersonalStyle {
  exclamationsCount: number; // 「！」の使用傾向
  positiveWords: string[];   // 好んで使うポジティブワード
}

export function learnFromTeacherCorrections(
  corrections: { original: string; corrected: string }[]
): PersonalStyle {
  let exclamations = 0;
  const wordFrequency: Record<string, number> = {};

  // 講師が好んで使う表現リスト
  const targetWords = [
    '素晴らしい', 'すばらしい', '一歩', '成長', '頑張り', 
    '集中', '見事', '達成', '姿勢', '挑戦', '逃げずに'
  ];

  corrections.forEach(c => {
    // 修正文に含まれる「！」をカウント
    const matches = c.corrected.match(/[！!]/g);
    if (matches) {
      exclamations += matches.length;
    }

    // 特定の言葉が含まれているか
    targetWords.forEach(word => {
      if (c.corrected.includes(word)) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
  });

  // 頻出上位のワードを抽出
  const positiveWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  return {
    exclamationsCount: exclamations,
    positiveWords: positiveWords.length > 0 ? positiveWords : ['成長', '素晴らしい']
  };
}

export function generateAIReportText(
  baseText: string,
  style: PersonalStyle
): string {
  let text = baseText;

  // 1. 文末の句点「。」を「！」に置換する（exclamationsCount がある場合）
  if (style.exclamationsCount > 0) {
    // 最後の文末だけでなく、いくつかの句点を「！」に
    text = text.replace(/。/g, '！');
    // 重複した「！！」を防ぐ
    text = text.replace(/！+/g, '！');
  }

  // 2. ポジティブワードを文頭や要所に織り交ぜる
  // もしテキストに「頑張りました」があるなら、「素晴らしい成長の一歩です！」などに補正
  if (style.positiveWords.includes('成長') || style.positiveWords.includes('一歩')) {
    text = text.replace(/頑張りました[！。]/g, '頑張りました！これは素晴らしい成長の一歩です！');
  }
  if (style.positiveWords.includes('素晴らしい') || style.positiveWords.includes('すばらしい')) {
    text = text.replace(/よくできました[！。]/g, '非常によく頑張り、姿勢がすばらしいです！');
  }
  if (style.positiveWords.includes('逃げずに') || style.positiveWords.includes('姿勢')) {
    text = text.replace(/間違えましたが/g, '間違えた問題もありましたが、そこから逃げずに動画で学び直す姿勢が見られ');
  }

  // 文末の安全対策
  if (!text.endsWith('！') && !text.endsWith('。')) {
    text += style.exclamationsCount > 0 ? '！' : '。';
  }

  return text;
}

/**
 * 未完了の学習予定タスクを、本来のカリキュラム順序（sequence_order）を守りながら、
 * 指定された日程以降へ順次後ろ倒し（再スケジューリング）します。
 */
export function rescheduleFutureUncompletedTasks(
  studentId: string,
  allTasks: LearningTask[],
  curriculumUnits: CurriculumUnit[],
  startDate: string,
  futureDates: string[]
): LearningTask[] {
  const studentTasks = allTasks.filter(t => t.student_id === studentId);
  const otherTasks = allTasks.filter(t => t.student_id !== studentId);

  const todayMs = new Date(startDate).getTime() - 24 * 60 * 60 * 1000;
  const todayStr = new Date(todayMs).toISOString().split('T')[0];

  const completedTasks = studentTasks.filter(t => t.status === 'completed' || (t.scheduled_date === todayStr && t.period !== null));
  const uncompletedTasks = studentTasks.filter(t => t.status !== 'completed' && !(t.scheduled_date === todayStr && t.period !== null));

  if (uncompletedTasks.length === 0 || futureDates.length === 0) {
    return allTasks;
  }

  // startDate 以降の有効な未来日を抽出・ソート
  const validDates = futureDates
    .filter(d => d >= startDate)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  if (validDates.length === 0) {
    return allTasks;
  }

  // 未完了タスクを教科別 ➔ sequence_order順にソートする
  const sortedUncompleted = [...uncompletedTasks].sort((a, b) => {
    const unitA = curriculumUnits.find(u => u.id === a.unit_id);
    const unitB = curriculumUnits.find(u => u.id === b.unit_id);
    if (!unitA || !unitB) return 0;
    if (unitA.subject !== unitB.subject) {
      return unitA.subject.localeCompare(unitB.subject);
    }
    return unitA.sequence_order - unitB.sequence_order;
  });

  // 日付に対して順次割り当て直す（1日あたり最大2タスクを目安に配置）
  const rescheduled = sortedUncompleted.map((task, index) => {
    const dateIdx = Math.floor(index / 2); // 1日最大2コマ
    const scheduled_date = validDates[Math.min(dateIdx, validDates.length - 1)];
    return {
      ...task,
      scheduled_date,
    };
  });

  return [...otherTasks, ...completedTasks, ...rescheduled];
}
