import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isMatchingUnitOrTest,
  getLatestUnitTestStatusForSubject,
  ensureMathEnglishUnitTests,
  findNextUncompletedLessonForSubject,
  calculateLessonRangeForSlot,
  CurriculumSkipViolationError,
  normalizeGrade,
  inferStudentSubjectPace,
  calculateSubjectProgressRate,
  getSortedSubjectsByProgressRate,
  calculateProgressGap,
  generateSlotsForSelectedSubjects,
  reorganizeFutureTasks,
  rescheduleDelayedTasks,
  handleForwardTasks,
  generateAIReportText,
  learnFromTeacherCorrections,
  calculateMockExamPassRate,
  parseStartUnitSetting,
  getStudentStartUnitIdForSubject,
  applyStartPositionsToTasks,
  calculateEnrollmentPeriod,
  generateAttendanceDates,
  isStudentAttendanceDay
} from '../lib/scheduler';
import {
  db,
  Student,
  CurriculumMaster,
  CurriculumUnit,
  MiniTestResult,
  LearningTask,
  StudentLessonProgress,
  sanitizeCorruptedCompletedLessonIds,
  normalizeStandardGrade,
  isElementaryStudent,
  isJuniorHighStudent,
  isHighSchoolStudent,
  enforceUnitTestPassingGate
} from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const getDynamicISO = (offsetDays: number = 0, hour: number = 10): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe('Scheduler and DB Comprehensive Branch Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. isMatchingUnitOrTest Detailed Branch Coverage', () => {
    it('should test all edge cases and branch permutations', () => {
      // 1. null / undefined / empty strings
      expect(isMatchingUnitOrTest(null, 'test')).toBe(false);
      expect(isMatchingUnitOrTest('test', null)).toBe(false);
      expect(isMatchingUnitOrTest('', 'test')).toBe(false);
      expect(isMatchingUnitOrTest('test', '')).toBe(false);
      expect(isMatchingUnitOrTest('   ', 'test')).toBe(false);

      // 2. Exact raw match
      expect(isMatchingUnitOrTest('Lesson 1', 'Lesson 1')).toBe(true);

      // 3. Check Test permutations
      // s is check, t is not check -> false
      expect(isMatchingUnitOrTest('Unit 1 Check Test', 'Unit 1 Regular Lesson')).toBe(false);
      // s is not check, t is check -> false
      expect(isMatchingUnitOrTest('Unit 1 Regular Lesson', 'Unit 1 Check Test')).toBe(false);
      // both check test with different unit names should not match
      expect(isMatchingUnitOrTest('cm-auto-check-1', 'cm-auto-check-2')).toBe(false);
      // both check test with same unit name
      expect(isMatchingUnitOrTest('Chapter 1 Check Test', 'Chapter 1 Check Test')).toBe(true);
      // both check test with substring
      expect(isMatchingUnitOrTest('Chapter 1 Check Test Extended', 'Chapter 1 Check Test')).toBe(true);

      // 4. Unit Test permutations (s is unit test, t is regular lesson)
      // should return false when other is a lesson with STEP, たしざん, etc.
      expect(isMatchingUnitOrTest('たしざん 単元確認テスト', 'STEP 1 たしざん')).toBe(false);
      expect(isMatchingUnitOrTest('かず 単元テスト', 'かずとすうじ (1)')).toBe(false);
      expect(isMatchingUnitOrTest('ひきざん 単元確認テスト', 'ひきざんのけいさん')).toBe(false);
      expect(isMatchingUnitOrTest('STEP 1 たしざん', 'たしざん 単元確認テスト')).toBe(false);

      // 5. Raw string containment
      expect(isMatchingUnitOrTest('cm-master-12345', 'cm-master-12345-sub')).toBe(true);
      expect(isMatchingUnitOrTest('cm-master-12345-sub', 'cm-master-12345')).toBe(true);

      // 6. Normalized unit name comparison
      expect(isMatchingUnitOrTest('１章 たしざん', '1章 たしざん')).toBe(true);
      expect(isMatchingUnitOrTest('Unit A: Basic Algebra', 'Basic Algebra')).toBe(true);
    });
  });

  describe('2. getLatestUnitTestStatusForSubject Detailed Branch Coverage', () => {
    it('should cover all branches including review tests, evaluations, and fallback fetches', async () => {
      const studentId = 'student-branch-eval-1';

      // 1. Without passing miniTestResults directly (fetches from db.getMiniTestResults)
      const resEmpty = getLatestUnitTestStatusForSubject({
        studentId,
        subject: '算数'
      });
      expect(resEmpty.hasFailedUnitTest).toBe(false);
      expect(resEmpty.failedUnitTest).toBeNull();
      expect(resEmpty.completedUnitTestKeys.size).toBe(0);

      // 2. With rich mini test results exercising all evaluation branches
      const sampleResults: MiniTestResult[] = [
        // a. Passed review test (まとめテスト)
        {
          id: 'mini-rev-1',
          student_id: studentId,
          subject: '算数',
          date: getDynamicDateStr(-10),
          test_content: '算数: まとめテスト(1)',
          unit_name: 'たしざん',
          score: 90,
          passed: true,
          created_at: getDynamicISO(-10, 10)
        },
        // b. Failed Check Test
        {
          id: 'mini-check-1',
          student_id: studentId,
          subject: '算数',
          date: getDynamicDateStr(-8),
          test_content: 'Check Test 1',
          unit_name: 'Check Test Unit',
          score: 50,
          passed: false,
          status: 'failed',
          created_at: getDynamicISO(-8, 10)
        },
        // c. Passed unit test (単元確認テスト)
        {
          id: 'mini-ut-pass',
          student_id: studentId,
          subject: '算数',
          date: getDynamicDateStr(-5),
          test_type: 'unit_test',
          test_content: 'かずとすうじ 単元確認テスト',
          unit_name: 'かずとすうじ',
          score: 100,
          passed: true,
          status: 'passed',
          created_at: getDynamicISO(-5, 10)
        },
        // d. Result without evaluation followed by result with evaluation for same key
        {
          id: 'mini-no-eval',
          student_id: studentId,
          subject: '数学', // Math / Arithmetic compatibility branch
          date: getDynamicDateStr(-3),
          test_type: 'unit_test',
          test_content: 'ひきざん 単元確認テスト',
          unit_name: 'ひきざん',
          score: null,
          passed: undefined,
          status: undefined,
          created_at: getDynamicISO(-3, 9)
        },
        {
          id: 'mini-with-eval',
          student_id: studentId,
          subject: '数学',
          date: getDynamicDateStr(-3),
          test_type: 'unit_test',
          test_content: 'ひきざん 単元確認テスト',
          unit_name: 'ひきざん',
          score: 85,
          passed: true,
          created_at: getDynamicISO(-3, 11)
        },
        // e. Result with no subject (should match 算数/数学)
        {
          id: 'mini-no-sub',
          student_id: studentId,
          subject: undefined,
          date: getDynamicDateStr(-1),
          test_type: 'unit_test',
          test_content: 'とけい 単元確認テスト',
          unit_name: 'とけい',
          score: 40,
          passed: false,
          created_at: getDynamicISO(-1, 10)
        }
      ];

      const status = getLatestUnitTestStatusForSubject({
        studentId,
        subject: '算数',
        miniTestResults: sampleResults
      });

      expect(status.hasFailedUnitTest).toBe(true);
      expect(status.completedUnitTestKeys.has('かずとすうじ')).toBe(true);
      expect(status.completedUnitKeys?.has('かずとすうじ')).toBe(true);
    });
  });

  describe('3. ensureMathEnglishUnitTests Detailed Branch Coverage', () => {
    it('should cover sorting adjustments, automatic creation, and non-target subjects', () => {
      const masters: CurriculumMaster[] = [
        // 1. Math unit with existing unit test that has low sort_order
        {
          id: 'cm-m-1',
          grade: '小1',
          subject: '算数',
          unit_name: 'たしざん',
          lesson_name: 'たしざん (1)',
          sort_order: 10
        },
        {
          id: 'cm-m-2',
          grade: '小1',
          subject: '算数',
          unit_name: 'たしざん',
          lesson_name: 'たしざん 単元確認テスト',
          sort_order: 5 // lower than lesson, should be adjusted
        },
        // 2. English unit without any test item (should auto-generate)
        {
          id: 'cm-e-1',
          grade: '小1',
          subject: '英語',
          unit_name: 'Alphabet',
          lesson_name: 'Letter A',
          sort_order: 20
        },
        // 3. Subject with unit_name === '単元未設定' (should skip auto-generate)
        {
          id: 'cm-e-unset',
          grade: '小1',
          subject: '英語',
          unit_name: '単元未設定',
          lesson_name: 'Free Talk',
          sort_order: 30
        },
        // 4. Non-target subject (国語) without tests (should not auto-generate)
        {
          id: 'cm-j-1',
          grade: '小1',
          subject: '国語',
          unit_name: 'ひらがな',
          lesson_name: 'あいうえお',
          sort_order: 40
        }
      ];

      const ensured = ensureMathEnglishUnitTests(masters);
      expect(ensured.length).toBeGreaterThan(masters.length);

      // Verify adjusted sort_order for existing test
      const mathTest = ensured.find(m => m.item_type === 'unit_test' && m.unit_name === 'たしざん');
      expect(mathTest?.sort_order).toBeGreaterThan(10);

      // Verify auto-generated English test
      const engTest = ensured.find(m => m.id.includes('cm-auto-ut-英語-小1-Alphabet'));
      expect(engTest).toBeDefined();
      expect(engTest?.item_type).toBe('unit_test');

      // Verify no auto-test for 国語
      const japaneseTest = ensured.find(m => m.subject === '国語' && m.item_type === 'unit_test');
      expect(japaneseTest).toBeUndefined();
    });
  });

  describe('4. findNextUncompletedLessonForSubject Detailed Branch Coverage', () => {
    it('should cover directMasterLessons, curriculumUnits fallbacks, and junior/high school filters', () => {
      // 1. Direct master lessons branch
      const resDirect = findNextUncompletedLessonForSubject({
        subject: '算数',
        masterLessons: [
          { id: 'l-1', name: '授業1', sort_order: 1 },
          { id: 'l-2', name: '授業2', sort_order: 2 }
        ]
      });
      expect(resDirect.lessonId).toBe('l-1');
      expect(resDirect.masterIndex).toBe(0);

      // 2. Empty lessons branch (using non-existent subject like 美術)
      const resEmpty = findNextUncompletedLessonForSubject({
        subject: '美術'
      });
      expect(resEmpty.lessonId).toBeNull();
      expect(resEmpty.masterIndex).toBe(-1);

      // 3. Junior high school student filter branch
      const juniorStudent: Student = {
        id: 'junior-st-1',
        name: '中学生徒',
        grade: '中1',
        grade_category: 'junior_high',
        school_name: '中1校',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['数学'],
        completed_lesson_ids: ['cm-j-m-1'],
        created_at: new Date().toISOString()
      };

      const juniorMasters: CurriculumMaster[] = [
        { id: 'cm-j-m-1', grade: '中1', subject: '数学', unit_name: '正負の数', lesson_name: '正負の数(1)', sort_order: 1 },
        { id: 'cm-j-m-2', grade: '中1', subject: '数学', unit_name: '正負の数', lesson_name: '正負の数(2)', sort_order: 2 }
      ];

      const resJunior = findNextUncompletedLessonForSubject({
        student: juniorStudent,
        subject: '数学',
        curriculumMasters: juniorMasters
      });
      expect(resJunior.lessonId).toBe('cm-j-m-2');
      expect(resJunior.masterIndex).toBe(1);

      // 4. High school student filter branch
      const highStudent: Student = {
        id: 'high-st-1',
        name: '高校生徒',
        grade: '高1',
        grade_category: 'high_school',
        school_name: '高校',
        period_count: 1,
        day_of_week: ['tue'],
        selected_subjects: ['英語'],
        completed_lesson_ids: [],
        created_at: new Date().toISOString()
      };

      const highMasters: CurriculumMaster[] = [
        { id: 'cm-h-e-1', grade: '高1', subject: '英語', unit_name: 'Grammar', lesson_name: 'Tenses', sort_order: 1 }
      ];

      const resHigh = findNextUncompletedLessonForSubject({
        student: highStudent,
        subject: '英語',
        curriculumMasters: highMasters
      });
      expect(resHigh.lessonId).toBe('cm-h-e-1');

      // 5. curriculumUnits fallback when curriculumMasters is empty
      const unitsFallback: CurriculumUnit[] = [
        { id: 'u-fb-1', name: 'フォールバック単元1', sequence_order: 1, subject: '算数', grade: '小1' },
        { id: 'u-fb-2', name: 'フォールバック単元2', sequence_order: 2, subject: '算数', grade: '小1' }
      ];

      (db as any).saveMockData('curriculum_masters', []);
      const resFb = findNextUncompletedLessonForSubject({
        student: { id: 'elem-st-fb', grade: '小1', name: '小学生' } as any,
        subject: '算数',
        curriculumUnits: unitsFallback
      });
      expect(resFb.lessonId).toBe('u-fb-1');
    });
  });

  describe('5. calculateLessonRange Detailed Branch Coverage', () => {
    it('should cover skip violation, empty lessons, and multiple lessons expansion', () => {
      const student: Student = {
        id: 'calc-range-st',
        name: 'レンジ計算生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: '学校',
        period_count: 2,
        day_of_week: ['wed'],
        selected_subjects: ['算数'],
        completed_lesson_ids: ['m-step-1'],
        created_at: new Date().toISOString()
      };

      const curriculumMastersList: CurriculumMaster[] = [
        { id: 'm-step-1', grade: '小1', subject: '算数', lesson_name: 'かずとすうじ(1)', sort_order: 1, unit_name: 'かずとすうじ' },
        { id: 'm-step-2', grade: '小1', subject: '算数', lesson_name: 'かずとすうじ(2)', sort_order: 2, unit_name: 'かずとすうじ' },
        { id: 'm-step-3', grade: '小1', subject: '算数', lesson_name: 'かずとすうじ(3)', sort_order: 3, unit_name: 'かずとすうじ' },
        { id: 'm-step-4', grade: '小1', subject: '算数', lesson_name: 'たしざん(1)', sort_order: 4, unit_name: 'たしざん' }
      ];

      // 1. Empty master lessons (using non-existent subject like 美術)
      const emptyRange = calculateLessonRangeForSlot({
        student,
        subject: '美術'
      });
      expect(emptyRange.start_lesson_id).toBeNull();
      expect(emptyRange.lesson_range).toBeNull();

      // 2. Normal range calculation from specified start step (m-step-2)
      const normalRange = calculateLessonRangeForSlot({
        student,
        subject: '算数',
        curriculumMasters: curriculumMastersList,
        startLessonId: 'm-step-2',
        lessonsPerSlot: 2
      });
      expect(normalRange.start_lesson_id).toBe('m-step-2');
      expect(normalRange.end_lesson_id).toBe('m-step-3');

      // 3. Skip violation when enforceNoSkip is true and attempting to start at m-step-4
      expect(() => {
        calculateLessonRangeForSlot({
          student,
          subject: '算数',
          curriculumMasters: curriculumMastersList,
          startLessonId: 'm-step-4',
          enforceNoSkip: true
        });
      }).toThrow(CurriculumSkipViolationError);
    });
  });

  describe('6. db.ts Branch Coverage for Cleanup, Dedupe & Interviews', () => {
    it('should exercise cleanupStudentCorruptedCompletedLessonIds with various passing lines and masters', async () => {
      const student: Student = {
        id: 'st-cleanup-branch',
        name: 'クリーンアップ分岐検証生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: '学校',
        period_count: 2,
        day_of_week: ['thu'],
        selected_subjects: ['算数'],
        completed_lesson_ids: ['step-m-1', 'step-m-ut-unpassed'],
        created_at: new Date().toISOString()
      };
      await db.saveStudent(student);

      // 単元テストマスタ
      (db as any).saveMockData('curriculum_masters', [
        {
          id: 'step-m-ut-unpassed',
          grade: '1年生',
          subject: '算数',
          unit_name: 'かずとすうじ',
          lesson_name: 'かずとすうじ 単元確認テスト',
          sort_order: 5,
          item_type: 'unit_test',
          passing_line: '90点以上'
        }
      ]);

      // 未合格の小テスト結果
      await db.saveMiniTestResult({
        id: 'mini-unpassed-1',
        student_id: student.id,
        date: getDynamicDateStr(-5),
        subject: '算数',
        test_type: 'unit_test',
        unit_name: 'かずとすうじ',
        test_content: 'かずとすうじ 単元確認テスト',
        score: 70, // 90点未満なので不合格
        passed: false,
        created_at: new Date().toISOString()
      });

      const cleaned = await db.cleanupStudentCorruptedCompletedLessonIds(student.id);
      expect(cleaned).toBeDefined();
      expect(cleaned?.completed_lesson_ids).not.toContain('step-m-ut-unpassed');
      expect(cleaned?.completed_lesson_ids).toContain('step-m-1');
    });

    it('should exercise getStudentInteractions with sorting and filtering', () => {
      (db as any).saveMockData('student_interactions', [
        {
          id: 'si-test-1',
          student_id: 'std-1',
          category: '面談',
          memo: 'テスト面談',
          date: getDynamicDateStr(-2),
          staff_name: '講師',
          created_at: getDynamicISO(-2, 10)
        }
      ]);
      const allInteractions = db.getStudentInteractions();
      expect(allInteractions.length).toBeGreaterThan(0);

      const studentInteractions = db.getStudentInteractions('std-1');
      expect(studentInteractions.length).toBeGreaterThan(0);
    });

    it('should test normalizeGrade utility thoroughly', () => {
      expect(normalizeGrade('1年生')).toBe('小1');
      expect(normalizeGrade('中学1年')).toBe('中1');
      expect(normalizeGrade('高校1年')).toBe('高1');
      expect(normalizeGrade('2年生')).toBe('小2');
      expect(normalizeGrade('中学2年')).toBe('中2');
      expect(normalizeGrade('高校2年')).toBe('高2');
      expect(normalizeGrade('3年生')).toBe('小3');
      expect(normalizeGrade('中学3年')).toBe('中3');
      expect(normalizeGrade('高校3年')).toBe('高3');
      expect(normalizeGrade('4年生')).toBe('小4');
      expect(normalizeGrade('5年生')).toBe('小5');
      expect(normalizeGrade('6年生')).toBe('小6');
      expect(normalizeGrade('')).toBe('');
      expect(normalizeGrade('既卒')).toBe('既卒');
    });
  });

  describe('7. Scheduler Pace, Progress, Slots & Reorganize Branches', () => {
    it('should test inferStudentSubjectPace branches', () => {
      const student: Student = {
        id: 'st-pace-1',
        name: 'ペース検証生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: '学校',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['算数'],
        completed_lesson_ids: ['l-1', 'l-2'],
        created_at: new Date().toISOString()
      };

      // 1. Without tasks (fallback pace)
      const paceEmpty = inferStudentSubjectPace({
        student,
        subject: '算数',
        tasks: []
      });
      expect(paceEmpty.estimatedLessonsPerSlot).toBeGreaterThanOrEqual(1);
      expect(paceEmpty.reason).toBeDefined();

      // 2. With high pass rate tasks
      const fastTasks: LearningTask[] = [
        {
          id: 't-1',
          student_id: student.id,
          subject: '算数',
          scheduled_date: getDynamicDateStr(-14),
          period: 1,
          status: 'completed',
          test_passed: true,
          created_at: getDynamicISO(-14, 0)
        },
        {
          id: 't-2',
          student_id: student.id,
          subject: '算数',
          scheduled_date: getDynamicDateStr(-7),
          period: 1,
          status: 'completed',
          test_passed: true,
          created_at: getDynamicISO(-7, 0)
        }
      ];
      const paceFast = inferStudentSubjectPace({
        student,
        subject: '算数',
        tasks: fastTasks
      });
      expect(paceFast.estimatedLessonsPerSlot).toBeGreaterThanOrEqual(1);
    });

    it('should test calculateSubjectProgressRate and getSortedSubjectsByProgressRate', () => {
      const student: Student = {
        id: 'st-prog-rate',
        name: '進捗率検証生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: '学校',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['算数', '国語'],
        completed_lesson_ids: ['m-1'],
        created_at: new Date().toISOString()
      };

      const masters: CurriculumMaster[] = [
        { id: 'm-1', grade: '小1', subject: '算数', lesson_name: '授業1', sort_order: 1 },
        { id: 'm-2', grade: '小1', subject: '算数', lesson_name: '授業2', sort_order: 2 },
        { id: 'j-1', grade: '小1', subject: '国語', lesson_name: '国語1', sort_order: 1 }
      ];

      const rateMath = calculateSubjectProgressRate({
        student,
        subject: '算数',
        curriculumMasters: masters
      });
      expect(rateMath.progressRate).toBeGreaterThan(0);
      expect(rateMath.totalCount).toBeGreaterThanOrEqual(2);

      const sorted = getSortedSubjectsByProgressRate({
        student,
        subjects: ['算数', '国語'],
        curriculumMasters: masters
      });
      expect(sorted.length).toBe(2);
    });

    it('should test calculateProgressGap and slot generation', () => {
      const student: Student = {
        id: 'st-gap',
        name: 'ギャップ検証生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: '学校',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['算数'],
        completed_lesson_ids: [],
        created_at: new Date().toISOString()
      };

      const gap = calculateProgressGap(
        student,
        [],
        [],
        [],
        getDynamicDateStr(0),
        '算数'
      );
      expect(gap).toBeDefined();

      const slots = generateSlotsForSelectedSubjects({
        student,
        periodCount: 2,
        selectedSubjects: ['算数']
      });
      expect(slots[1]).toBeDefined();
      expect(slots[1].subject).toBe('算数');
    });

    it('should test reorganizeFutureTasks, rescheduleDelayedTasks, and handleForwardTasks', () => {
      const student: Student = {
        id: 'st-reorg',
        name: '再編検証生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: '学校',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['算数'],
        completed_lesson_ids: ['task-1'],
        created_at: new Date().toISOString()
      };

      const tasks: LearningTask[] = [
        {
          id: 'task-1',
          student_id: student.id,
          subject: '算数',
          scheduled_date: getDynamicDateStr(-7),
          period: 1,
          status: 'completed',
          created_at: getDynamicISO(-7, 0)
        },
        {
          id: 'task-2',
          student_id: student.id,
          subject: '算数',
          scheduled_date: getDynamicDateStr(0),
          period: 1,
          status: 'unstarted',
          created_at: getDynamicISO(0, 0)
        }
      ];

      const reorg = reorganizeFutureTasks(
        student.id,
        '算数',
        tasks,
        []
      );
      expect(Array.isArray(reorg)).toBe(true);

      const delayed = rescheduleDelayedTasks(
        student,
        tasks,
        getDynamicDateStr(1),
        [getDynamicDateStr(7)]
      );
      expect(delayed.updatedTasks).toBeDefined();

      const forwarded = handleForwardTasks(
        student,
        tasks,
        getDynamicDateStr(-7),
        getDynamicDateStr(0)
      );
      expect(forwarded.updatedTasks).toBeDefined();
    });

    it('should test AI reports, teacher learning, and mock exams', async () => {
      const student: Student = {
        id: 'st-ai-rep',
        name: 'AI報告書検証生徒',
        grade: '中3',
        grade_category: 'junior_high',
        school_name: '中3校',
        period_count: 2,
        day_of_week: ['tue'],
        selected_subjects: ['数学', '英語'],
        completed_lesson_ids: [],
        created_at: new Date().toISOString()
      };

      // 1. learnFromTeacherCorrections
      const learnedStyle = learnFromTeacherCorrections([
        { original: '頑張りました。', corrected: 'よく頑張りました！素晴らしい成長です！' }
      ]);
      expect(learnedStyle.exclamationsCount).toBeGreaterThan(0);

      // 2. generateAIReportText
      const repText = generateAIReportText(
        '本日も集中して頑張りました。',
        learnedStyle
      );
      expect(repText).toBeDefined();
      expect(repText).toContain('！');

      // 3. calculateMockExamPassRate
      const passRate = calculateMockExamPassRate(
        85,
        'SCH001',
        [
          {
            id: 'th-1',
            school_code: 'SCH001',
            school_name: '第一志望校',
            min_score: 80,
            max_score: 90,
            probability: 85,
            created_at: new Date().toISOString()
          } as any
        ]
      );
      expect(passRate).toBe(85);
    });

    it('should test start unit settings, attendance dates, and enrollment period', () => {
      // 1. parseStartUnitSetting
      const parsed1 = parseStartUnitSetting('小1: 0のたしざんとひきざん');
      expect(parsed1.unitName).toBeDefined();
      const parsed2 = parseStartUnitSetting('');
      expect(parsed2.unitName).toBeNull();

      // 2. getStudentStartUnitIdForSubject
      const stWithStart: Student = {
        id: 'st-start-u',
        name: '開始単元生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: '校',
        period_count: 1,
        day_of_week: ['mon'],
        selected_subjects: ['算数'],
        start_unit_math: 'cm-start-123',
        completed_lesson_ids: [],
        created_at: new Date().toISOString()
      };
      expect(getStudentStartUnitIdForSubject(stWithStart, '算数')).toBe('cm-start-123');
      expect(getStudentStartUnitIdForSubject(stWithStart, '国語')).toBeNull();

      // 3. isStudentAttendanceDay & generateAttendanceDates
      const baseDate = new Date();
      const dayOfWeek = baseDate.getDay();
      const daysUntilMonday = (1 + 7 - dayOfWeek) % 7 || 7;
      const nextMonday = new Date(baseDate);
      nextMonday.setDate(baseDate.getDate() + daysUntilMonday);
      const nextMondayStr = nextMonday.toISOString().split('T')[0];

      const studentAtt: any = { selected_days: ['monday', 'wednesday'] };
      expect(isStudentAttendanceDay(studentAtt, nextMondayStr)).toBe(true);
      const dates = generateAttendanceDates(nextMondayStr, ['monday'], 4);
      expect(dates.length).toBe(4);

      // 4. calculateEnrollmentPeriod
      const pastStart = getDynamicDateStr(-120);
      const recentEnd = getDynamicDateStr(0);
      const period = calculateEnrollmentPeriod(pastStart, recentEnd);
      expect(period?.text).toBeDefined();
      expect(period?.isWithdrawn).toBe(true);
      expect(calculateEnrollmentPeriod(null, null)).toBeNull();
      expect(calculateEnrollmentPeriod(getDynamicDateStr(10), getDynamicDateStr(0))?.text).toContain('開始日以降');
    });

    it('should test normalizeStandardGrade, student category checkers, and enforceUnitTestPassingGate', () => {
      // 1. normalizeStandardGrade permutations
      expect(normalizeStandardGrade('kindergarten')).toBe('園児');
      expect(normalizeStandardGrade('幼児')).toBe('園児');
      expect(normalizeStandardGrade('graduated')).toBe('既卒');
      expect(normalizeStandardGrade('1')).toBe('小1');
      expect(normalizeStandardGrade('1年')).toBe('小1');
      expect(normalizeStandardGrade('3年生')).toBe('小3');
      expect(normalizeStandardGrade('7')).toBe('中1');
      expect(normalizeStandardGrade('7年')).toBe('中1');
      expect(normalizeStandardGrade('8年生')).toBe('中2');
      expect(normalizeStandardGrade('10')).toBe('高1');
      expect(normalizeStandardGrade('11年')).toBe('高2');
      expect(normalizeStandardGrade('12年生')).toBe('高3');
      expect(normalizeStandardGrade('その他')).toBe('その他');

      // 2. isElementaryStudent, isJuniorHighStudent, isHighSchoolStudent
      expect(isElementaryStudent('小1')).toBe(true);
      expect(isElementaryStudent(undefined, '小学生')).toBe(true);
      expect(isElementaryStudent('中1')).toBe(false);
      expect(isJuniorHighStudent('中2')).toBe(true);
      expect(isJuniorHighStudent(undefined, '中学生')).toBe(true);
      expect(isJuniorHighStudent('高1')).toBe(false);
      expect(isHighSchoolStudent('高3')).toBe(true);
      expect(isHighSchoolStudent(undefined, '高校生')).toBe(true);
      expect(isHighSchoolStudent('小2')).toBe(false);

      // 3. enforceUnitTestPassingGate branches
      expect(enforceUnitTestPassingGate('s-1', [])).toEqual([]);
      expect(enforceUnitTestPassingGate('s-1', undefined)).toEqual([]);

      const mockMasters: CurriculumMaster[] = [
        { id: 'm-ut-pass', grade: '中1', subject: '数学', unit_name: '正の数・負の数', lesson_name: '正の数・負の数 単元確認テスト', item_type: 'unit_test', sort_order: 1 },
        { id: 'm-ut-fail', grade: '中1', subject: '数学', unit_name: '文字の式', lesson_name: '文字の式 単元確認テスト', item_type: 'unit_test', sort_order: 2 }
      ];

      const mockMiniResults: MiniTestResult[] = [
        {
          id: 'mini-p',
          student_id: 's-gate-1',
          subject: '数学',
          date: getDynamicDateStr(0),
          test_content: '数学: 正の数・負の数 単元確認テスト',
          unit_name: '正の数・負の数',
          status: '合格',
          score: 95,
          passed: true,
          created_at: getDynamicISO(0)
        }
      ];

      const gated = enforceUnitTestPassingGate(
        's-gate-1',
        ['m-ut-pass', 'm-ut-fail', 'STEP 1', 'STEP 2'],
        mockMiniResults,
        mockMasters
      );

      expect(gated).toContain('m-ut-pass');
      expect(gated).not.toContain('m-ut-fail');
      expect(gated).not.toContain('STEP 2');
    });
  });
});


