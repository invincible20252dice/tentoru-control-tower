import { describe, it, expect, beforeEach } from 'vitest';
import {
  isMatchingUnitOrTest,
  formatLessonRange,
  getLatestUnitTestStatusForSubject,
  ensureMathEnglishUnitTests,
  normalizeUnitName,
  normalizeGrade,
  buildSchedule,
  calcEstimatedEndDate,
  generatePeriodicSchedule,
  getFutureLessonsForSubject
} from '../lib/scheduler';
import { db, type MiniTestResult, type CurriculumMaster, type Student } from '../lib/db';

describe('Scheduler Extreme Branches Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('exhaustively covers formatLessonRange branches', () => {
    expect(formatLessonRange('', '')).toBe('');
    expect(formatLessonRange(null, undefined)).toBe('');
    expect(formatLessonRange('第1講 計算', '第2講 方程式')).toBe('第1講 計算 〜 第2講 方程式');
    expect(formatLessonRange('第1講 計算', '第1講 計算')).toBe('第1講 計算');
    expect(formatLessonRange('第1講 計算', '')).toBe('第1講 計算');
    expect(formatLessonRange('', '第2講 方程式')).toBe('第2講 方程式');
  });

  it('exhaustively covers isMatchingUnitOrTest edge cases and branches', () => {
    // Empty / whitespace inputs
    expect(isMatchingUnitOrTest('', '')).toBe(false);
    expect(isMatchingUnitOrTest('  ', 'abc')).toBe(false);
    expect(isMatchingUnitOrTest('abc', '  ')).toBe(false);

    // Summary test with empty normalized unit name
    // Line 95: if (!sUnit || !tUnit) return true;
    expect(isMatchingUnitOrTest('まとめテスト 1', 'まとめテスト 1')).toBe(true);
    expect(isMatchingUnitOrTest('まとめテスト（１）', 'まとめテスト（１）')).toBe(true);
    // Number mismatch
    expect(isMatchingUnitOrTest('まとめテスト 1', 'まとめテスト 2')).toBe(false);
    // One is summary, the other is not
    expect(isMatchingUnitOrTest('まとめテスト 1', '第1講 計算')).toBe(false);
    expect(isMatchingUnitOrTest('第1講 計算', 'まとめテスト 1')).toBe(false);

    // Check Test with empty normalized unit name
    // Line 108: if (!sUnit || !tUnit) return true;
    expect(isMatchingUnitOrTest('Check Test', 'Check Test')).toBe(true);
    expect(isMatchingUnitOrTest('cm-auto-check', 'cm-auto-check')).toBe(true);
    // One is check test, other is not
    expect(isMatchingUnitOrTest('Check Test', '第1講 英文法')).toBe(false);
    expect(isMatchingUnitOrTest('第1講 英文法', 'Check Test')).toBe(false);

    // Unit test vs lesson name (prevent false match)
    expect(isMatchingUnitOrTest('単元確認テスト', 'STEP 1 たしざん')).toBe(false);
    expect(isMatchingUnitOrTest('STEP 1 ひきざん', '単元確認テスト')).toBe(false);
    expect(isMatchingUnitOrTest('単元確認テスト', 'かずのべんきょう')).toBe(false);

    // Raw inclusion match
    expect(isMatchingUnitOrTest('方程式の解き方', '方程式')).toBe(true);
    expect(isMatchingUnitOrTest('方程式', '方程式の解き方')).toBe(true);

    // Line 128: if (!sNorm || !tNorm) return false;
    expect(isMatchingUnitOrTest('---', '===')).toBe(false);
    expect(isMatchingUnitOrTest('abc', '---')).toBe(false);
  });

  it('exhaustively covers getLatestUnitTestStatusForSubject sorting and fallback branches', () => {
    const studentId = 'st-sched-extreme-1';
    const dynamicDate = getDynamicDate(-2);

    // Results with missing date, using created_at, or missing both
    const results: MiniTestResult[] = [
      {
        id: 'mini-1',
        student_id: studentId,
        subject: '算数',
        test_type: 'unit_test',
        test_content: '第1章 単元テスト',
        unit_name: '第1章 かけ算',
        date: '',
        created_at: `${dynamicDate}T10:00:00.000Z`,
        score: 90,
        passing_line: '80点',
        status: 'passed'
      },
      {
        id: 'mini-2',
        student_id: studentId,
        subject: '算数',
        test_type: 'unit_test',
        test_content: '第2章 単元確認テスト',
        unit_name: '第2章 わり算',
        // both date and created_at empty
        date: '',
        created_at: '',
        score: 50,
        passing_line: '80点',
        status: 'failed'
      },
      {
        id: 'mini-3',
        student_id: studentId,
        subject: '', // empty subject fallback to 算数/数学
        test_type: 'unit_test',
        test_content: '第3章 単元テスト',
        unit_name: '', // empty unit_name fallback
        date: dynamicDate,
        score: null as any,
        passed: true,
        status: 'passed'
      },
      {
        id: 'mini-4',
        student_id: studentId,
        subject: '国語', // non-target subject
        test_type: 'unit_test',
        test_content: '漢字テスト',
        date: dynamicDate,
        score: 100,
        status: 'passed'
      }
    ];

    const status = getLatestUnitTestStatusForSubject({
      studentId,
      subject: '算数',
      miniTestResults: results
    });

    expect(status.completedUnitTestKeys.has('第1章 かけ算')).toBe(true);
    expect(status.hasFailedUnitTest).toBe(true);
    expect(status.failedUnitTest?.id).toBe('mini-2');

    // Test with undefined miniTestResults (loads from db)
    db.saveMiniTestResult(results[0]);
    const statusFromDb = getLatestUnitTestStatusForSubject({
      studentId,
      subject: '算数'
    });
    expect(statusFromDb.completedUnitTestKeys.size).toBeGreaterThan(0);
  });

  it('exhaustively covers ensureMathEnglishUnitTests branches for elementary Japanese and English and missing lessons', () => {
    // Group with no lessons at all (only test items or empty), grade empty, testing sort_order fallback
    const rawMasters: CurriculumMaster[] = [
      {
        id: 'cm-kokugo-1',
        grade: '小4',
        subject: '国語',
        unit_name: '説明文の読解',
        lesson_name: '単元確認テスト',
        item_type: 'unit_test',
        sort_order: 10
      },
      {
        id: 'cm-eigo-1',
        grade: '小5',
        subject: '英語',
        unit_name: 'Daily Routine',
        lesson_name: 'Lesson 1 My Day',
        item_type: 'lesson',
        sort_order: 1
      },
      {
        id: 'cm-sansu-1',
        grade: '小3',
        subject: '算数',
        unit_name: 'わり算の基礎',
        lesson_name: '第1講 わり算とは',
        item_type: 'lesson',
        sort_order: 2
      }
    ];

    const complemented = ensureMathEnglishUnitTests(rawMasters);

    // 国語: まとめテスト（１）（２）（３）が自動生成されること
    const kokugoSummary1 = complemented.find(m => m.subject === '国語' && m.lesson_name === 'まとめテスト（１）');
    expect(kokugoSummary1).toBeDefined();
    expect(kokugoSummary1?.grade).toBe('小4');

    // 英語: Check Test が自動補完されること
    const eigoCheck = complemented.find(m => m.subject === '英語' && m.lesson_name === 'Check Test');
    expect(eigoCheck).toBeDefined();

    // 算数: まとめテスト（１）（２）（３）が自動補完されること
    const sansuSummary1 = complemented.find(m => m.subject === '算数' && m.lesson_name === 'まとめテスト（１）');
    expect(sansuSummary1).toBeDefined();
  });

  it('covers junior high school and other branches in ensureMathEnglishUnitTests and scheduler', () => {
    const rawMasters: CurriculumMaster[] = [
      {
        id: 'cm-jhs-math-1',
        grade: '中1',
        subject: '数学',
        unit_name: '正の数・負の数',
        lesson_name: '加法と減法',
        item_type: 'lesson',
        sort_order: 1
      },
      {
        id: 'cm-jhs-eng-1',
        grade: '中2',
        subject: '英語',
        unit_name: 'Past Tense',
        lesson_name: 'Past simple',
        item_type: 'lesson',
        sort_order: 1
      }
    ];

    const complemented = ensureMathEnglishUnitTests(rawMasters);
    expect(complemented.length).toBeGreaterThanOrEqual(2);
  });
});
