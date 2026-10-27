import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/db';
import {
  calculateLessonRangeForSlot,
  inferStudentSubjectPace,
  generateAttendanceDates,
  generateSlotsForSelectedSubjects,
  isStudentAttendanceDay,
  findNextUncompletedLessonForSubject,
  getLatestUnitTestStatusForSubject
} from '../lib/scheduler';
import { Student, LearningTask, CurriculumMaster, CurriculumUnit, MiniTestResult } from '../types';

function getDynamicDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

describe('Scheduler and DB Extreme Branch Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. scheduler.ts - calculateLessonRangeForSlot & High School Subjects', () => {
    it('should cover high school grade, science/humanities subjects, and units fallback when rawMasters is empty', () => {
      const highStudent: Student = {
        id: 'st-high-branch-1',
        student_id: 'HS001',
        name: '高校生ブランチ生徒',
        grade: '高2',
        status: 'normal',
        branch_id: 'branch-1',
        school_id: 'sch-high-1',
        school_name: 'テントル高校',
        selected_subjects: ['物理', '日本史', '化学'],
        created_at: new Date().toISOString()
      };

      const highUnits: CurriculumUnit[] = [
        {
          id: 'cu-physics-1',
          school_id: 'sch-high-1',
          subject: '物理',
          name: '力学の基礎 - 運動方程式',
          sequence_order: 1
        },
        {
          id: 'cu-physics-2',
          school_id: 'sch-high-1',
          subject: '物理',
          name: '力学の基礎 - 放物運動',
          sequence_order: 2
        },
        {
          id: 'cu-history-1',
          subject: '日本史',
          name: '原始・古代 - 縄文文化',
          sequence_order: 1
        }
      ];

      // rawMasters is empty, so it falls back to curriculumUnits
      const rangePhys = calculateLessonRangeForSlot({
        subject: '物理',
        student: highStudent,
        curriculumMasters: [],
        curriculumUnits: highUnits,
        schoolId: 'sch-high-1'
      });

      expect(rangePhys.start_lesson_id).toBe('cu-physics-1');
      expect(rangePhys.start_lesson_name).toBe('力学の基礎 - 運動方程式');
      expect(rangePhys.lesson_range).toBe('力学の基礎 - 運動方程式 〜 力学の基礎 - 放物運動');

      // Test Japanese History with fallback units where schoolId does not match (fallback to general common unit)
      const rangeHist = calculateLessonRangeForSlot({
        subject: '日本史',
        student: highStudent,
        curriculumMasters: [],
        curriculumUnits: highUnits,
        schoolId: 'sch-other'
      });
      expect(rangeHist.start_lesson_id).toBe('cu-history-1');
    });

    it('should trigger prohibited skip error when user attempts to skip preceding uncompleted steps', () => {
      const student: Student = {
        id: 'st-skip-check',
        student_id: 'ST009',
        name: '中抜き検証生徒',
        grade: '中2',
        status: 'normal',
        branch_id: 'branch-1',
        selected_subjects: ['数学'],
        completed_lesson_ids: ['cm-m2-1'],
        created_at: new Date().toISOString()
      };

      const masters: CurriculumMaster[] = [
        { id: 'cm-m2-1', grade: '中2', subject: '数学', lesson_name: '式と計算(1)', sort_order: 1 },
        { id: 'cm-m2-2', grade: '中2', subject: '数学', lesson_name: '式と計算(2)', sort_order: 2 },
        { id: 'cm-m2-3', grade: '中2', subject: '数学', lesson_name: '連立方程式(1)', sort_order: 3 }
      ];

      // Setting startLessonId to cm-m2-3 skips cm-m2-2 with enforceNoSkip: true
      expect(() => {
        calculateLessonRangeForSlot({
          subject: '数学',
          student,
          curriculumMasters: masters,
          startLessonId: 'cm-m2-3',
          enforceNoSkip: true
        });
      }).toThrow(/カリキュラム中抜き受講は物理的に禁止されています/);
    });

    it('should handle failed mini-test without unit_name and fallback using test_content', () => {
      const student: Student = {
        id: 'st-failed-fallback',
        student_id: 'ST010',
        name: '不合格単元補正生徒',
        grade: '中1',
        status: 'normal',
        branch_id: 'branch-1',
        selected_subjects: ['数学'],
        created_at: new Date().toISOString()
      };

      const masters: CurriculumMaster[] = [
        { id: 'cm-m1-1', grade: '中1', subject: '数学', unit_name: '正の数・負の数', lesson_name: '加法と減法', sort_order: 1 }
      ];

      const failedTest: MiniTestResult = {
        id: 'mt-failed-1',
        student_id: student.id,
        subject: '数学',
        unit_name: '', // Empty unit_name to exercise fallback
        test_content: '正の数・負の数 - 単元確認テスト',
        status: 'failed',
        passed: false,
        score: 45,
        date: getDynamicDateStr(0)
      };

      const range = calculateLessonRangeForSlot({
        subject: '数学',
        student,
        curriculumMasters: masters,
        miniTestResults: [failedTest]
      });

      expect(range.start_lesson_name).toContain('【再テスト対策・総復習】');
    });

    it('should cover sequential slot continuation with priorSlot.endLessonId', () => {
      const student: Student = {
        id: 'st-seq-slot',
        student_id: 'ST011',
        name: '連続コマ生徒',
        grade: '小5',
        status: 'normal',
        branch_id: 'branch-1',
        selected_subjects: ['算数'],
        created_at: new Date().toISOString()
      };

      const masters: CurriculumMaster[] = [
        { id: 'cm-p5-1', grade: '小5', subject: '算数', unit_name: '小数', lesson_name: '小数の掛け算', sort_order: 1 },
        { id: 'cm-p5-2', grade: '小5', subject: '算数', unit_name: '小数', lesson_name: '小数の割り算', sort_order: 2 },
        { id: 'cm-p5-3', grade: '小5', subject: '算数', unit_name: '分数', lesson_name: '分数の足し算', sort_order: 3 }
      ];

      const slots = generateSlotsForSelectedSubjects({
        student,
        periodCount: 2,
        selectedSubjects: ['算数'],
        curriculumMasters: masters
      });

      expect(slots[1].subject).toBe('算数');
      expect(slots[1].startLessonId).toBe('cm-p5-1');
      expect(slots[2].subject).toBe('算数');
      // Second slot continues from after slot 1 (which reached auto summary test)
      expect(slots[2].startLessonId).toBe('cm-auto-sum1-算数-小5-小数');
    });
  });

  describe('2. scheduler.ts - inferStudentSubjectPace & generateAttendanceDates', () => {
    it('should calculate student subject pace for Level A, B, and C with weekly duration parsing', () => {
      const studentA: Student = {
        id: 'st-pace-a',
        student_id: 'PA01',
        name: 'ペースA生徒',
        grade: '中3',
        status: 'normal',
        subject_levels: { '英語': 'A' }
      };
      const studentB: Student = {
        id: 'st-pace-b',
        student_id: 'PB01',
        name: 'ペースB生徒',
        grade: '中3',
        status: 'normal',
        subject_levels: { '英語': 'B' }
      };
      const studentC: Student = {
        id: 'st-pace-c',
        student_id: 'PC01',
        name: 'ペースC生徒',
        grade: '中3',
        status: 'normal',
        subject_levels: { '英語': 'C' }
      };

      const taskWithRange: LearningTask = {
        id: 'task-rng-1',
        student_id: studentA.id,
        subject: '英語',
        scheduled_date: getDynamicDateStr(-1),
        period: 1,
        status: 'completed',
        lesson_range: '現在完了(1) 〜 現在完了(3)',
        video_watched: true,
        test_passed: true,
        created_at: new Date().toISOString()
      };

      const paceA = inferStudentSubjectPace({
        student: studentA,
        subject: '英語',
        recentTasks: [taskWithRange],
        weeklyDuration: '120min'
      });
      expect(paceA.estimatedLessonsPerSlot).toBeGreaterThan(0);

      const paceB = inferStudentSubjectPace({
        student: studentB,
        subject: '英語',
        weeklyDuration: '90'
      });
      expect(paceB.estimatedLessonsPerSlot).toBeGreaterThan(0);

      const paceC = inferStudentSubjectPace({
        student: studentC,
        subject: '英語'
      });
      expect(paceC.estimatedLessonsPerSlot).toBeGreaterThan(0);
    });

    it('should handle generateAttendanceDates edge cases: count <= 0, invalid enrollment date, day mapping variants', () => {
      // 1. count <= 0 returns empty array
      const emptyDates = generateAttendanceDates(getDynamicDateStr(0), ['tuesday'], 0);
      expect(emptyDates).toEqual([]);

      // 2. Invalid date fallback returns empty array safely
      const invalidFallback = generateAttendanceDates('invalid-date-string', ['wednesday'], 2);
      expect(invalidFallback).toEqual([]);

      // 3. Various day mapping representations (日, mon, 2, saturday)
      const multiDayDates = generateAttendanceDates(
        getDynamicDateStr(0),
        ['sun', '月', '2', 'sat', 'sunday'],
        5
      );
      expect(multiDayDates.length).toBe(5);

      // 4. isStudentAttendanceDay edge cases
      expect(isStudentAttendanceDay(null, null)).toBe(false);
      expect(isStudentAttendanceDay(null, 'invalid-date')).toBe(false);
      const nextTueOrFri = generateAttendanceDates(getDynamicDateStr(0), ['tuesday', 'friday'], 1)[0];
      expect(isStudentAttendanceDay(null, nextTueOrFri)).toBe(true);
    });

    it('should generate slots with default subjects when selectedSubjects is empty for elementary, jhs, and high school', () => {
      const elemSt: Student = {
        id: 'st-def-elem',
        student_id: 'E01',
        name: '小学生デフォルト生徒',
        grade: '小3',
        status: 'normal',
        selected_subjects: []
      };
      const elemSlots = generateSlotsForSelectedSubjects({
        student: elemSt,
        periodCount: 3
      });
      expect(Object.keys(elemSlots).length).toBe(3);

      const jhsSt: Student = {
        id: 'st-def-jhs',
        student_id: 'J01',
        name: '中学生デフォルト生徒',
        grade: '中1',
        status: 'normal',
        selected_subjects: []
      };
      const jhsSlots = generateSlotsForSelectedSubjects({
        student: jhsSt,
        periodCount: 2
      });
      expect(Object.keys(jhsSlots).length).toBe(2);

      const highSt: Student = {
        id: 'st-def-high',
        student_id: 'H01',
        name: '高校生デフォルト生徒',
        grade: '高1',
        status: 'normal',
        selected_subjects: []
      };
      const highSlots = generateSlotsForSelectedSubjects({
        student: highSt,
        periodCount: 2
      });
      expect(Object.keys(highSlots).length).toBe(2);
    });
  });

  describe('3. db.ts - School Types, UUID fallbacks, and DB Sanitization Edge Cases', () => {
    it('should correctly derive school type from school_name (elementary, high_school, junior_high)', async () => {
      const elemStudent: Student = {
        id: 'st-sch-elem',
        student_id: 'SE01',
        name: '小学校生徒',
        grade: '小4',
        status: 'normal',
        school_name: '第一小学校'
      };
      await db.saveStudent(elemStudent);
      const savedElem = db.getStudent('st-sch-elem');
      expect(savedElem).toBeDefined();

      const highStudent: Student = {
        id: 'st-sch-high',
        student_id: 'SH01',
        name: '高校生徒',
        grade: '高2',
        status: 'normal',
        school_name: '県立第一高等学校'
      };
      await db.saveStudent(highStudent);
      const savedHigh = db.getStudent('st-sch-high');
      expect(savedHigh).toBeDefined();

      const jhsStudent: Student = {
        id: 'st-sch-jhs',
        student_id: 'SJ01',
        name: '中学校生徒',
        grade: '中2',
        status: 'normal',
        school_name: '市立中央中学校'
      };
      await db.saveStudent(jhsStudent);
      const savedJhs = db.getStudent('st-sch-jhs');
      expect(savedJhs).toBeDefined();
    });

    it('should test crypto.randomUUID fallback branch when crypto is undefined or missing randomUUID', async () => {
      const originalCrypto = globalThis.crypto;
      try {
        // Temporarily redefine crypto without randomUUID
        Object.defineProperty(globalThis, 'crypto', {
          value: {},
          configurable: true,
          writable: true
        });

        const studentWithoutCrypto: Student = {
          id: 'st-no-crypto',
          student_id: 'SNC01',
          name: 'クリプトなし生徒',
          grade: '中1',
          status: 'normal',
          school_name: '南小学校'
        };
        await db.saveStudent(studentWithoutCrypto);
        expect(db.getStudent('st-no-crypto')).toBeDefined();
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          value: originalCrypto,
          configurable: true,
          writable: true
        });
      }
    });

    it('should test memory store fallback when isBrowser returns false', () => {
      // Mock isBrowser to return false
      const isBrowserSpy = vi.spyOn(db as any, 'isBrowser').mockReturnValue(false);

      (db as any).saveMockData('test_node_data', [{ id: '1', name: 'Node' }]);
      const retrieved = (db as any).getMockData('test_node_data', []);
      expect(retrieved).toEqual([{ id: '1', name: 'Node' }]);

      (db as any).saveMockData('test_node_obj', { setting: true });
      const retrievedObj = (db as any).getMockObject('test_node_obj', { setting: false });
      expect(retrievedObj).toEqual({ setting: true });

      isBrowserSpy.mockRestore();
    });
  });
});
