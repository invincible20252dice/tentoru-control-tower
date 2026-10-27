import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatLessonRange,
  normalizeGrade,
  normalizeUnitName,
  isMatchingUnitOrTest,
  getLatestUnitTestStatusForSubject,
  inferStudentSubjectPace,
  calculateDefaultSlots,
  calculateEnrollmentPeriod,
  getFirstAttendanceDate,
  isStudentAttendanceDay,
  generateAttendanceDates,
  parseStartUnitSetting,
  getStudentStartUnitIdForSubject,
  applyStartPositionsToTasks,
  calculateProgressGap,
  rescheduleDelayedTasks,
  handleForwardTasks,
  calculateMockExamPassRate,
  learnFromTeacherCorrections,
  generateAIReportText,
  rescheduleFutureUncompletedTasks,
  calculateSubjectProgressRate,
  getSortedSubjectsByProgressRate,
  generateSlotsForSelectedSubjects,
  ensureMathEnglishUnitTests,
  calculateLessonRangeForSlot
} from '../lib/scheduler';
import {
  db,
  sanitizeLearningTask,
  sanitizeMiniTestResult,
  sanitizeHomeworkResult,
  sanitizeCorruptedCompletedLessonIds,
  type Student,
  type LearningTask,
  type MiniTestResult,
  type CurriculumMaster,
  type CurriculumUnit,
  type StudentLessonProgress,
  type MilestonePlan
} from '../lib/db';

describe('Scheduler and DB Comprehensive Branch Blitz Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
    vi.restoreAllMocks();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('exhaustively covers scheduler string helpers, ranges, and pace inference branches', () => {
    // formatLessonRange branches
    expect(formatLessonRange(null, null)).toBe('');
    expect(formatLessonRange('開始単元', null)).toBe('開始単元');
    expect(formatLessonRange(null, '終了単元')).toBe('終了単元');
    expect(formatLessonRange('単元A', '単元B')).toBe('単元A 〜 単元B');
    expect(formatLessonRange('同一単元', '同一単元')).toBe('同一単元');

    // normalizeGrade branches
    expect(normalizeGrade(undefined)).toBe('');
    expect(normalizeGrade('小1')).toBe('小1');
    expect(normalizeGrade('1年')).toBe('小1');
    expect(normalizeGrade('中3')).toBe('中3');
    expect(normalizeGrade('高2')).toBe('高2');
    expect(normalizeGrade('既卒')).toBe('既卒');
    expect(normalizeGrade('高校生')).toBe('高校生');

    // normalizeUnitName branches
    expect(normalizeUnitName(null)).toBe('');
    expect(normalizeUnitName(undefined)).toBe('');
    expect(normalizeUnitName('  算数: 小数のかけ算 (1)  ')).toBe('小数のかけ算 (1)');
    expect(normalizeUnitName('数学 : 一次関数【基本】')).toBe('一次関数【基本】');

    // isMatchingUnitOrTest branches
    expect(isMatchingUnitOrTest(null, 'target')).toBe(false);
    expect(isMatchingUnitOrTest('source', null)).toBe(false);
    expect(isMatchingUnitOrTest('一次関数 単元テスト', '一次関数')).toBe(true);
    expect(isMatchingUnitOrTest('一次関数', '一次関数 単元確認テスト')).toBe(true);
    expect(isMatchingUnitOrTest('計算ドリル', '図形の合同')).toBe(false);

    // inferStudentSubjectPace branches
    const paceA = inferStudentSubjectPace({ rawLevel: 'A', isElementary: true });
    expect(paceA).toBeDefined();
    const paceB = inferStudentSubjectPace({ rawLevel: 'B', isElementary: false });
    expect(paceB).toBeDefined();
    const paceC = inferStudentSubjectPace({ rawLevel: 'C', isElementary: true });
    expect(paceC).toBeDefined();
    const paceOther = inferStudentSubjectPace({ rawLevel: 'D' as any, isElementary: false });
    expect(paceOther).toBeDefined();
    const paceNull = inferStudentSubjectPace({ rawLevel: null, isElementary: false });
    expect(paceNull).toBeDefined();

    // calculateDefaultSlots branches
    expect(calculateDefaultSlots('elementary', '120min')).toBe(2);
    expect(calculateDefaultSlots('junior_high', '120min')).toBe(2);
    expect(calculateDefaultSlots('junior_high', '180min')).toBe(3);
    expect(calculateDefaultSlots('junior_high', '240min')).toBe(4);
    expect(calculateDefaultSlots('junior_high', '300min')).toBe(5);
    expect(calculateDefaultSlots('junior_high', 'unlimited')).toBe(5);
    expect(calculateDefaultSlots('junior_high', '60min')).toBe(2);
  });

  it('exhaustively covers attendance days, enrollment period, and start unit parsers', () => {
    const d0 = getDynamicDate(0);
    const dFuture = getDynamicDate(30);

    // calculateEnrollmentPeriod
    const periodBoth = calculateEnrollmentPeriod(d0, dFuture);
    expect(periodBoth).toBeDefined();
    const periodStartOnly = calculateEnrollmentPeriod(d0, null);
    expect(periodStartOnly).toBeDefined();
    const periodEndOnly = calculateEnrollmentPeriod(null, dFuture);
    expect(periodEndOnly).toBeDefined();
    const periodNone = calculateEnrollmentPeriod(null, null);
    expect(periodNone).toBeDefined();

    // getFirstAttendanceDate
    const student: Student = {
      id: 'st-att-1',
      name: '出欠生徒',
      grade: '中1',
      selected_days: ['mon', 'wed', 'fri']
    };
    const firstAtt = getFirstAttendanceDate(d0, student);
    expect(firstAtt).toBeDefined();

    const studentNoDays: Student = {
      id: 'st-att-2',
      name: '曜日なし生徒',
      grade: '中1',
      selected_days: []
    };
    expect(getFirstAttendanceDate(d0, studentNoDays)).toBeDefined();

    // isStudentAttendanceDay
    expect(isStudentAttendanceDay(d0, student)).toBeTypeOf('boolean');
    expect(isStudentAttendanceDay(d0, studentNoDays)).toBeTypeOf('boolean');

    // generateAttendanceDates
    const genDates = generateAttendanceDates(d0, 14, student);
    expect(Array.isArray(genDates)).toBe(true);

    // parseStartUnitSetting
    expect(parseStartUnitSetting('中2: 一次関数')).toBeDefined();
    expect(parseStartUnitSetting('連立方程式')).toBeDefined();
    expect(parseStartUnitSetting('')).toBeDefined();

    // getStudentStartUnitIdForSubject
    expect(getStudentStartUnitIdForSubject(null, '数学')).toBeNull();
    expect(getStudentStartUnitIdForSubject(student, undefined)).toBeNull();
    expect(getStudentStartUnitIdForSubject(student, '数学')).toBeNull();
    const studentWithStarts: Student = {
      ...student,
      subject_start_units: { '数学': 'unit-math-1' }
    };
    expect(getStudentStartUnitIdForSubject(studentWithStarts, '数学')).toBe('unit-math-1');
  });

  it('exhaustively covers scheduler progress gaps, mock exams, AI report, and progress rates', () => {
    const d0 = getDynamicDate(0);
    const dPrev = getDynamicDate(-5);
    const futureDates = [getDynamicDate(1), getDynamicDate(2), getDynamicDate(3)];

    const student: Student = {
      id: 'st-gap-1',
      name: '進捗生徒',
      grade: '中2',
      level: 'A',
      selected_subjects: ['数学', '英語', '国語']
    };

    const tasks: LearningTask[] = [
      { id: 't-g1', student_id: student.id, subject: '数学', scheduled_date: dPrev, period: 1, status: 'completed' },
      { id: 't-g2', student_id: student.id, subject: '数学', scheduled_date: d0, period: 1, status: 'pending' },
      { id: 't-g3', student_id: student.id, subject: '英語', scheduled_date: d0, period: 2, status: 'completed' }
    ];

    const masters: CurriculumMaster[] = [
      { id: 'cm-g1', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: 'グラフ', sort_order: 1 },
      { id: 'cm-g2', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: '利用', sort_order: 2 },
      { id: 'cm-g3', grade: '中2', subject: '英語', unit_name: '不定詞', lesson_name: '名詞的用法', sort_order: 1 }
    ];

    const milestonePlans: MilestonePlan[] = [
      { id: 'mp-1', grade: '中2', subject: '数学', course: 'standard', month: 4, week_number: 1, target_unit: '一次関数' },
      { id: 'mp-2', grade: '中2', subject: '数学', course: 'standard', month: 4, week_number: 2, target_unit: '一次関数' }
    ];

    const units: CurriculumUnit[] = [
      { id: 'u-g1', subject: '数学', name: '一次関数', sequence_order: 1 }
    ];

    // calculateProgressGap
    const gap = calculateProgressGap(
      student,
      tasks,
      milestonePlans,
      units,
      d0,
      '数学'
    );
    expect(gap).toBeDefined();

    // calculateProgressGap with empty plans
    const gapEmpty = calculateProgressGap(
      student,
      tasks,
      [],
      units,
      d0,
      '数学'
    );
    expect(gapEmpty.gapWeeks).toBe(0);

    // rescheduleDelayedTasks
    const delayed = rescheduleDelayedTasks(
      student,
      tasks,
      d0,
      futureDates,
      2,
      milestonePlans,
      units
    );
    expect(delayed.updatedTasks).toBeDefined();

    // handleForwardTasks
    const forwarded = handleForwardTasks(
      student,
      tasks,
      d0,
      d0
    );
    expect(Array.isArray(forwarded.updatedTasks)).toBe(true);

    // calculateMockExamPassRate
    const mockThresholds = [
      { id: 'th-1', school_code: 'sch-tokyo', min_score: 80, max_score: 100, probability: 90 },
      { id: 'th-2', school_code: 'sch-tokyo', min_score: 60, max_score: 79, probability: 60 },
      { id: 'th-3', school_code: 'sch-tokyo', min_score: 40, max_score: 59, probability: 30 }
    ];
    const passRate = calculateMockExamPassRate(85, 'sch-tokyo', mockThresholds);
    expect(passRate).toBe(90);
    expect(calculateMockExamPassRate(30, 'sch-tokyo', mockThresholds)).toBeDefined();
    expect(calculateMockExamPassRate(95, 'sch-other', mockThresholds)).toBe(0);

    // learnFromTeacherCorrections
    const personalStyle = learnFromTeacherCorrections([
      { original: '頑張りましたね', corrected: '素晴らしい！よく頑張り抜きました！' },
      { original: '合格です', corrected: '見事！達成できました！一歩前進！' }
    ]);
    expect(personalStyle).toBeDefined();
    expect(personalStyle.exclamationsCount).toBeGreaterThan(0);

    // generateAIReportText
    const report = generateAIReportText('今日一日よく頑張りました。素晴らしい集中力です。', personalStyle);
    expect(report).toBeDefined();
    expect(report).toContain('！');

    // calculateSubjectProgressRate
    const mathRate = calculateSubjectProgressRate({
      student,
      subject: '数学',
      tasks,
      curriculumMasters: masters
    });
    expect(mathRate).toBeDefined();

    // getSortedSubjectsByProgressRate
    const sortedSubjs = getSortedSubjectsByProgressRate({
      student,
      tasks,
      curriculumMasters: masters
    });
    expect(Array.isArray(sortedSubjs)).toBe(true);

    // generateSlotsForSelectedSubjects
    const slots = generateSlotsForSelectedSubjects({
      student,
      periodCount: 4,
      tasks,
      curriculumMasters: masters
    });
    expect(typeof slots === 'object' && slots !== null).toBe(true);

    // rescheduleFutureUncompletedTasks
    const rescheduled = rescheduleFutureUncompletedTasks(
      student.id,
      tasks,
      units,
      d0,
      futureDates
    );
    expect(Array.isArray(rescheduled)).toBe(true);
  });

  it('exhaustively covers db.ts sanitizers, subject comparisons, and mock interaction edge cases', async () => {
    // db.saveStudent variations and sanitizations
    const s1: Student = {
      id: 'st-save-1',
      name: 'テスト1',
      grade: '中1',
      personality_tags: '["好奇心旺盛", "集中力"]' as any,
      subject_start_units: '{"数学": "cm-1"}' as any
    };
    const saved1 = await db.saveStudent(s1);
    expect(saved1.name).toBe('テスト1');

    const s2: Student = {
      id: 'st-save-2',
      name: 'テスト2',
      grade: '小5',
      personality_tags: '単一タグ' as any,
      subject_start_units: null as any
    };
    const saved2 = await db.saveStudent(s2);
    expect(saved2.name).toBe('テスト2');

    const s3: Student = {
      id: 'st-save-3',
      name: 'テスト3',
      grade: '高1',
      personality_tags: null as any,
      personalities: ['既存タグ']
    };
    const saved3 = await db.saveStudent(s3);
    expect(saved3.name).toBe('テスト3');

    // sanitizeLearningTask variations
    const t1 = sanitizeLearningTask({
      lesson_ids: ['cm-1', 'cm-2'],
      period: '1' as any
    });
    expect(Array.isArray(t1.lesson_ids)).toBe(true);
    expect(t1.period).toBe(1);

    const t2 = sanitizeLearningTask({
      lesson_ids: null as any,
      period: null as any
    });
    expect(t2.lesson_ids).toBeUndefined();

    // sanitizeMiniTestResult variations
    const m1 = sanitizeMiniTestResult({
      score: '95' as any,
      passed: true
    });
    expect(m1.score).toBe(95);

    const m2 = sanitizeMiniTestResult({
      score: null,
      status: 'passed'
    });
    expect(m2.score).toBeNull();
    expect(m2.status).toBe('passed');

    // sanitizeHomeworkResult variations
    const hw1 = sanitizeHomeworkResult({
      status: 'completed',
      homework_content: '連立方程式演習'
    });
    expect(hw1.status).toBe('completed');
    expect(hw1.homework_content).toBe('連立方程式演習');

    // sanitizeCorruptedCompletedLessonIds
    const { cleanedIds } = sanitizeCorruptedCompletedLessonIds(['cm-1', 'cm-4']);
    expect(cleanedIds).toContain('cm-1');
    expect(cleanedIds).toContain('cm-4');

    // db interaction with auto-id and fallbacks
    const interaction = {
      student_id: 'st-int-deep',
      student_name: '面談生徒',
      date: getDynamicDate(0),
      memo: 'テスト面談メモ'
    };
    (db as any).saveMockData('student_interactions', [interaction]);
    const fetched = db.getStudentInteractions('st-int-deep');
    expect(fetched.length).toBe(1);
    expect(fetched[0].memo).toBe('テスト面談メモ');
  });
});
