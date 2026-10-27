import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isMatchingUnitOrTest,
  getLatestUnitTestStatusForSubject,
  calculateLessonRangeForSlot,
  ensureMathEnglishUnitTests
} from '../lib/scheduler';
import {
  db,
  Student,
  CurriculumMaster,
  CurriculumUnit,
  MiniTestResult,
  LearningTask,
  enforceUnitTestPassingGate
} from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const getDynamicISO = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

describe('Scheduler and DB Crypto Gate and Range Calculation Deep Perfection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should deeply exercise calculateLessonRangeForSlot with multi-lesson spans and unit test boundaries', () => {
    const student: Student = {
      id: 'st-slot-deep',
      name: 'スロット深層生徒',
      grade: '中1',
      grade_category: 'junior_high',
      school_name: '中学',
      period_count: 2,
      day_of_week: ['mon'],
      selected_subjects: ['数学'],
      completed_lesson_ids: ['m-step-1'],
      created_at: getDynamicISO(0)
    };

    const masters: CurriculumMaster[] = [
      { id: 'm-step-1', grade: '中1', subject: '数学', unit_name: '正の数・負の数', lesson_name: '正負の数の加法', sort_order: 1 },
      { id: 'm-step-2', grade: '中1', subject: '数学', unit_name: '正の数・負の数', lesson_name: '正負の数の減法', sort_order: 2 },
      { id: 'm-step-3', grade: '中1', subject: '数学', unit_name: '正の数・負の数', lesson_name: '正負の数の乗法', sort_order: 3 },
      { id: 'm-step-ut', grade: '中1', subject: '数学', unit_name: '正の数・負の数', lesson_name: '正の数・負の数 単元確認テスト', item_type: 'unit_test', sort_order: 4 }
    ];

    const tasks: LearningTask[] = [
      {
        id: 't-slot-1',
        student_id: student.id,
        subject: '数学',
        scheduled_date: getDynamicDateStr(0),
        period: 1,
        status: 'unstarted',
        created_at: getDynamicISO(0)
      }
    ];

    const range = calculateLessonRangeForSlot({
      subject: '数学',
      student,
      tasks,
      curriculumMasters: masters,
      curriculumUnits: [],
      lessonProgressList: [],
      miniTestResults: []
    });

    expect(range).toBeDefined();
    expect(range.start_lesson_id).toBe('m-step-2');
  });

  it('should exercise getLatestUnitTestStatusForSubject and enforceUnitTestPassingGate with subject prefixes and spacing', () => {
    const studentId = 'st-prefix-gate';

    // Results with subject prefixes and Japanese fullwidth spaces
    const results: MiniTestResult[] = [
      {
        id: 'mt-pref-pass',
        student_id: studentId,
        subject: '英語',
        date: getDynamicDateStr(-5),
        test_content: '英語: 一般動詞の過去形 単元確認テスト',
        unit_name: '英語: 一般動詞の過去形',
        score: 95,
        passed: true,
        status: 'passed',
        created_at: getDynamicISO(-5)
      },
      {
        id: 'mt-pref-fail',
        student_id: studentId,
        subject: '英語',
        date: getDynamicDateStr(-1),
        test_content: '英語: 助動詞can 単元確認テスト',
        unit_name: '英語: 助動詞can',
        score: 60,
        passed: false,
        status: 'failed',
        created_at: getDynamicISO(-1)
      }
    ];

    const status = getLatestUnitTestStatusForSubject({
      studentId,
      subject: '英語',
      miniTestResults: results
    });

    expect(status.hasFailedUnitTest).toBe(true);
    expect(status.failedUnitTest?.unit_name).toContain('助動詞can');

    const masters: CurriculumMaster[] = [
      { id: 'm-eng-pass', grade: '中1', subject: '英語', unit_name: '一般動詞の過去形', lesson_name: '一般動詞の過去形 単元確認テスト', item_type: 'unit_test', sort_order: 10 },
      { id: 'm-eng-fail', grade: '中1', subject: '英語', unit_name: '助動詞can', lesson_name: '助動詞can 単元確認テスト', item_type: 'unit_test', sort_order: 15 }
    ];

    const gated = enforceUnitTestPassingGate(
      studentId,
      ['m-eng-pass', 'm-eng-fail', 'STEP 10', 'STEP 15'],
      results,
      masters
    );

    expect(gated).toContain('m-eng-pass');
    expect(gated).toContain('STEP 10');
    expect(gated).not.toContain('m-eng-fail');
    expect(gated).not.toContain('STEP 15');
  });
});
