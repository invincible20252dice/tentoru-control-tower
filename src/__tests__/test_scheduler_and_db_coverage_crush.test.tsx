import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ensureMathEnglishUnitTests,
  findNextUncompletedLessonForSubject,
  calculateLessonRangeForSlot,
  getDisplaySteps,
  getFirstAttendanceDate,
  formatLessonRange,
  inferStudentSubjectPace
} from '../lib/scheduler';
import {
  db,
  type Student,
  type CurriculumMaster,
  type CurriculumUnit,
  type LearningTask,
  type MiniTestResult,
  normalizeStandardGrade,
  getSchoolYear
} from '../lib/db';

describe('Scheduler and DB Complete Branch Crush Suite', () => {
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

  describe('ensureMathEnglishUnitTests All Branch Variations', () => {
    it('exhaustively covers auto-generation for elementary Math, English, Japanese, and Science', () => {
      const masters: CurriculumMaster[] = [
        // Elementary Math without summaries
        { id: 'cm-m-elem-1', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算の基礎', sort_order: 1 },
        // Elementary Math with only summary 1 (to test missing 2 and 3)
        { id: 'cm-m-elem-2', grade: '小3', subject: '算数', unit_name: 'かけ算の筆算', lesson_name: 'かけ算の筆算', sort_order: 10 },
        { id: 'cm-m-elem-2-sum1', grade: '小3', subject: '算数', unit_name: 'かけ算の筆算', lesson_name: 'まとめテスト（１）', sort_order: 11 },
        // Elementary English without Check Test
        { id: 'cm-en-elem-1', grade: '小5', subject: '英語', unit_name: 'Greetings', lesson_name: 'Hello', sort_order: 20 },
        // Elementary English WITH Check Test
        { id: 'cm-en-elem-2', grade: '小5', subject: '英語', unit_name: 'Colors', lesson_name: 'Blue and Red', sort_order: 30 },
        { id: 'cm-en-elem-2-chk', grade: '小5', subject: '英語', unit_name: 'Colors', lesson_name: 'Check Test', sort_order: 31 },
        // Elementary Japanese without summaries
        { id: 'cm-jp-elem-1', grade: '小4', subject: '国語', unit_name: '漢字の成り立ち', lesson_name: '象形文字', sort_order: 40 },
        // Junior High Math (tests single auto unit test)
        { id: 'cm-m-jhs-auto', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: '変化の割合', sort_order: 50 },
        // Unit without unit_name or 単元未設定 (skipped)
        { id: 'cm-skip-1', grade: '小1', subject: '算数', unit_name: '単元未設定', lesson_name: 'かず', sort_order: 60 },
        // High School master (no auto gen)
        { id: 'cm-high-1', grade: '高1', subject: '数学', unit_name: '数と式', lesson_name: '展開', sort_order: 70 }
      ];

      const ensured = ensureMathEnglishUnitTests(masters);
      expect(ensured.length).toBeGreaterThan(masters.length);

      // Verify Math summaries generated
      expect(ensured.some(m => m.unit_name === 'わり算' && m.lesson_name === 'まとめテスト（１）')).toBe(true);
      expect(ensured.some(m => m.unit_name === 'わり算' && m.lesson_name === 'まとめテスト（２）')).toBe(true);
      expect(ensured.some(m => m.unit_name === 'わり算' && m.lesson_name === 'まとめテスト（３）')).toBe(true);
      expect(ensured.some(m => m.unit_name === 'かけ算の筆算' && m.lesson_name === 'まとめテスト（２）')).toBe(true);

      // Verify English check test generated
      expect(ensured.some(m => m.unit_name === 'Greetings' && m.lesson_name === 'Check Test')).toBe(true);

      // Verify Japanese summaries generated
      expect(ensured.some(m => m.unit_name === '漢字の成り立ち' && m.lesson_name === 'まとめテスト（１）')).toBe(true);

      // Verify Math unit test auto-generated
      expect(ensured.some(m => m.unit_name === '一次関数' && m.item_type === 'unit_test')).toBe(true);
    });
  });

  describe('findNextUncompletedLessonForSubject Edge Branches', () => {
    it('covers failedUnitTest multi-way matching by unit_name and test_content cross-fields', () => {
      const student: Student = {
        id: 'st-failed-cross',
        name: 'クロス合否生徒',
        grade: '中2',
        completed_lesson_ids: ['cm-f-1']
      };

      const dynamicDate = getDynamicDate(-1);

      const failedTest1: MiniTestResult = {
        id: 'mt-cross-1',
        student_id: student.id,
        subject: '数学',
        unit_name: '連立方程式',
        test_content: '連立方程式 単元確認テスト',
        test_type: 'unit_test',
        date: dynamicDate,
        score: 30,
        status: 'failed'
      };

      const masters: CurriculumMaster[] = [
        { id: 'cm-f-1', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '加減法', sort_order: 1 },
        { id: 'cm-f-2', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '連立方程式 単元確認テスト', sort_order: 2, item_type: 'unit_test' },
        { id: 'cm-f-3', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: 'Check Test', sort_order: 3 }
      ];

      const res = findNextUncompletedLessonForSubject({
        subject: '数学',
        student,
        curriculumMasters: masters,
        miniTestResults: [failedTest1]
      });

      expect(res.hasFailedUnitTest).toBe(true);
    });

    it('covers graduate, high school, and student level fallback branches', () => {
      const studentGrad: Student = {
        id: 'st-grad',
        name: '既卒生',
        grade: '既卒',
        level: undefined
      };

      const masters: CurriculumMaster[] = [
        { id: 'cm-grad-1', grade: '既卒', subject: '英語', unit_name: '長文読解', lesson_name: '論説文', sort_order: 1 }
      ];

      const res = findNextUncompletedLessonForSubject({
        subject: '英語',
        student: studentGrad,
        curriculumMasters: masters
      });

      expect(res.lessonId).toBe('cm-grad-1');

      // Test pace inference
      const taskWithRange: LearningTask = {
        id: 't-range',
        student_id: studentGrad.id,
        subject: '英語',
        lesson_range: 'ステップ1 〜 ステップ2',
        period: 1,
        date: getDynamicDate(0)
      };

      const paceA = inferStudentSubjectPace({
        student: studentGrad,
        subject: '英語',
        tasks: [taskWithRange]
      });
      expect(paceA.estimatedLessonsPerSlot).toBeDefined();
    });
  });

  describe('calculateLessonRangeForSlot and getDisplaySteps Edge Branches', () => {
    it('covers High School curriculum calculation and lesson name extraction with dashes', () => {
      const highStudent: Student = {
        id: 'st-high-calc',
        name: '高校生計算',
        grade: '高2'
      };

      const masters: CurriculumMaster[] = [
        { id: 'cm-h-1', grade: '高2', subject: '数学', unit_name: '三角関数', lesson_name: '第1節 - 加法定理の証明', sort_order: 1 },
        { id: 'cm-h-2', grade: '高2', subject: '数学', unit_name: '三角関数', lesson_name: '第2節 - 2倍角の公式', sort_order: 2 }
      ];

      const plan = calculateLessonRangeForSlot({
        subject: '数学',
        student: highStudent,
        curriculumMasters: masters,
        lessonsPerSlot: 2
      });

      expect(plan.lesson_ids?.length).toBe(2);

      // getDisplaySteps with High School student and dashed lesson name
      const slot = {
        subject: '数学',
        start_lesson_id: 'cm-h-1',
        end_lesson_id: 'cm-h-2',
        lesson_range: '加法定理の証明 〜 2倍角の公式'
      };

      const steps = getDisplaySteps(slot, {
        curriculumMasters: masters,
        studentGrade: '高2'
      });

      expect(steps.length).toBe(2);
      expect(steps[0].name).toContain('加法定理');
    });

    it('covers date parsing edge cases (invalid dates, custom durations, and selectedDays)', () => {
      const student: Student = {
        id: 'st-days',
        name: '通塾日生徒',
        grade: '中1',
        weekly_duration_minutes: '90min',
        enrollment_date: 'invalid-date-string',
        selected_days: ['TUESDAY', 'FRIDAY', 'INVALID_DAY' as any]
      };

      const firstDate = getFirstAttendanceDate(student.enrollment_date, student.selected_days);
      expect(firstDate).toBeDefined();
    });
  });

  describe('db.ts School Type Auto-Inference and Grade Normalization Branches', () => {
    it('covers normalizeStandardGrade all patterns (kindergarten, graduated, grades 1-6, 7-9, high school)', () => {
      expect(normalizeStandardGrade('園児')).toBe('園児');
      expect(normalizeStandardGrade('幼児')).toBe('園児');
      expect(normalizeStandardGrade('kindergarten')).toBe('園児');
      expect(normalizeStandardGrade('既卒')).toBe('既卒');
      expect(normalizeStandardGrade('graduated')).toBe('既卒');
      expect(normalizeStandardGrade('小学3年')).toBe('小3');
      expect(normalizeStandardGrade('小5年生')).toBe('小5');
      expect(normalizeStandardGrade('4年生')).toBe('小4');
      expect(normalizeStandardGrade('中学2年')).toBe('中2');
      expect(normalizeStandardGrade('中3年生')).toBe('中3');
      expect(normalizeStandardGrade('8年生')).toBe('中2');
      expect(normalizeStandardGrade('高校1年')).toBe('高1');
      expect(normalizeStandardGrade('高3年生')).toBe('高3');
      expect(normalizeStandardGrade('11年生')).toBe('高2');
      expect(normalizeStandardGrade('その他')).toBe('その他');
      expect(normalizeStandardGrade(undefined)).toBe('');
    });

    it('covers saveStudent school type inference for elementary, high, and junior high', async () => {
      // 1. Elementary
      const elemRes = await db.saveStudent({
        id: 'st-auto-elem',
        name: '小学校生徒',
        grade: '小2',
        school_name: '緑ヶ丘小学校'
      });
      expect(elemRes).toBeDefined();

      // 2. High School
      const highRes = await db.saveStudent({
        id: 'st-auto-high',
        name: '高校生徒',
        grade: '高1',
        school_name: '都立青山高等学校'
      });
      expect(highRes).toBeDefined();

      // 3. Junior High School
      const jhsRes = await db.saveStudent({
        id: 'st-auto-jhs',
        name: '中学校生徒',
        grade: '中1',
        school_name: '渋谷中学校'
      });
      expect(jhsRes).toBeDefined();
    });

    it('covers saveLearningTasks with studentId filter and sanitizeLearningTask', async () => {
      const dynamicDate = getDynamicDate(0);
      const studentId = 'st-task-save-test';

      const tasks: LearningTask[] = [
        {
          id: 'task-clean-1',
          student_id: studentId,
          subject: '数学',
          period: 1,
          date: dynamicDate,
          scheduled_date: dynamicDate,
          status: 'unstarted'
        }
      ];

      await db.saveLearningTasks(tasks, studentId);
      const loaded = db.getLearningTasks().filter(t => t.student_id === studentId);
      expect(loaded.length).toBe(1);
    });
  });
});
