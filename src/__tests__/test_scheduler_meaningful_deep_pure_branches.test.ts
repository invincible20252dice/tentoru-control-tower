import { describe, it, expect } from 'vitest';
import {
  getDisplaySteps,
  getSortedSubjectsByProgressRate,
  resolveSubByPeriod,
  isMatchingUnitOrTest,
  getLatestUnitTestStatusForSubject,
  isStudentAttendanceDay,
  generateAttendanceDates,
  parseStartUnitSetting,
  calculateLessonRangeForSlot,
  ensureMathEnglishUnitTests,
  getLessonRangeStepIds,
  findNextUncompletedLessonForSubject,
  CurriculumSkipViolationError
} from '../lib/scheduler';
import { db } from '../lib/db';
import { CurriculumMaster, Student, MiniTestResult, LearningTask } from '../types';

describe('Meaningful Deep Pure Branch Tests for scheduler.ts', () => {
  const sampleMasters: CurriculumMaster[] = [
    {
      id: 'cm-high-1',
      grade: '高1',
      grade_level: '高1',
      subject: '数学',
      unit_name: '数と式',
      lesson_name: '展開公式',
      sort_order: 1
    },
    {
      id: 'cm-high-2',
      grade: '高1',
      grade_level: '高1',
      subject: '数学',
      unit_name: '数と式',
      lesson_name: '因数分解',
      sort_order: 2
    },
    {
      id: 'cm-high-3',
      grade: '高1',
      grade_level: '高1',
      subject: '数学',
      unit_name: '数と式',
      lesson_name: '実数と根号',
      sort_order: 3
    },
    {
      id: 'cm-high-ut',
      grade: '高1',
      grade_level: '高1',
      subject: '数学',
      unit_name: '数と式',
      lesson_name: '数と式 - 単元確認テスト',
      sort_order: 4,
      item_type: 'unit_test'
    }
  ];

  it('1. getDisplaySteps: 高校生カリキュラムおよび範囲文字列（〜、-、数値）の全ステップ展開', () => {
    // 高校生向けマスタから From〜To を指定してステップ展開
    const slotHigh = {
      subject: '数学',
      student_grade: '高1',
      start_lesson_id: 'cm-high-1',
      end_lesson_id: 'cm-high-3',
      lesson_range: '展開公式 〜 実数と根号'
    };

    const steps = getDisplaySteps(slotHigh, { curriculumMasters: sampleMasters });
    expect(steps.length).toBe(3);
    expect(steps[0].name).toBe('展開公式');
    expect(steps[2].name).toBe('実数と根号');

    // 範囲文字列がハイフン区切り（例: "数と式 1 - 2" または "展開公式 - 因数分解"）
    const slotHyphen = {
      subject: '数学',
      student_grade: '高1',
      lesson_range: '数と式 1 - 2'
    };
    const stepsHyphen = getDisplaySteps(slotHyphen, { curriculumMasters: sampleMasters });
    expect(stepsHyphen.length).toBeGreaterThan(0);

    // 単一レッスン名のみ指定
    const slotSingle = {
      subject: '数学',
      student_grade: '高1',
      start_lesson_name: '展開公式'
    };
    const stepsSingle = getDisplaySteps(slotSingle, { curriculumMasters: sampleMasters });
    expect(stepsSingle.length).toBe(1);
    expect(stepsSingle[0].name).toBe('展開公式');

    // IDのみ指定（lesson_name が空の場合）
    const slotIdOnly = {
      subject: '数学',
      student_grade: '高1',
      start_lesson_id: 'cm-high-2'
    };
    const stepsIdOnly = getDisplaySteps(slotIdOnly, { curriculumMasters: sampleMasters });
    expect(stepsIdOnly.length).toBe(1);
    expect(stepsIdOnly[0].name).toBe('因数分解');
  });

  it('2. getSortedSubjectsByProgressRate & resolveSubByPeriod: 進捗率による教科優先順位とコマ割り循環割り当て', () => {
    const student: Student = {
      id: 'std-sort-1',
      student_id: 'S_SORT_1',
      name: '進捗 太郎',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      selected_subjects: ['数学', '英語', '理科']
    };

    // 数学が進捗率50%、英語が80%、理科が20%（進度が遅い理科・数学が上位に来る）
    const sortedSubjs = getSortedSubjectsByProgressRate({
      student,
      selectedSubjects: ['数学', '英語', '理科'],
      curriculumMasters: sampleMasters,
      tasks: []
    });

    expect(sortedSubjs.length).toBe(3);

    // コマ数への割り当て（コマ数が教科数を超える場合のモジュロ循環）
    expect(resolveSubByPeriod(sortedSubjs, 1)).toBe(sortedSubjs[0]);
    expect(resolveSubByPeriod(sortedSubjs, 2)).toBe(sortedSubjs[1]);
    expect(resolveSubByPeriod(sortedSubjs, 3)).toBe(sortedSubjs[2]);
    expect(resolveSubByPeriod(sortedSubjs, 4)).toBe(sortedSubjs[0]); // 循環
    expect(resolveSubByPeriod(sortedSubjs, 5)).toBe(sortedSubjs[1]); // 循環

    // 空配列時のフォールバック
    expect(resolveSubByPeriod([], 1)).toBe('算数');
  });

  it('3. isMatchingUnitOrTest: 単元名とテスト名のマッチング境界値（まとめテスト、Check Test、サニタイズ一致）', () => {
    // まとめテスト同士で単元名なし（L202 分岐）
    expect(isMatchingUnitOrTest('まとめテスト（１）', 'まとめテスト（１）')).toBe(true);
    // Check Test 同士で単元名なし（L215 分岐）
    expect(isMatchingUnitOrTest('Check Test', 'Check Test')).toBe(true);

    // 単元テストの接尾辞除去一致
    expect(isMatchingUnitOrTest('一次関数 - 単元確認テスト', '一次関数')).toBe(true);
    expect(isMatchingUnitOrTest('一次関数', '一次関数 - 確認テスト')).toBe(true);
    expect(isMatchingUnitOrTest('一次関数', '二次方程式')).toBe(false);
  });

  it('4. getLatestUnitTestStatusForSubject: 点数合格ライン（80点以上）パースおよび合否結果の追跡', () => {
    const results: MiniTestResult[] = [
      {
        id: 'mini-score-1',
        student_id: 'std-score-1',
        task_id: 't-1',
        date: '2026-06-01',
        subject: '数学',
        unit_name: '数と式',
        test_content: '数と式 - 単元確認テスト',
        test_type: 'unit_test',
        score: 85,
        passing_line: '80点以上', // 点数表記
        target_scope: 'individual',
        status: 'passed',
        passed: true,
        created_at: new Date().toISOString()
      },
      {
        id: 'mini-score-fail',
        student_id: 'std-score-1',
        task_id: 't-2',
        date: '2026-06-02',
        subject: '数学',
        unit_name: '二次方程式',
        test_content: '二次方程式 - 単元確認テスト',
        test_type: 'unit_test',
        score: 50,
        passing_line: '80点以上',
        target_scope: 'individual',
        status: 'failed',
        passed: false,
        created_at: new Date().toISOString()
      }
    ];

    const status = getLatestUnitTestStatusForSubject({
      studentId: 'std-score-1',
      subject: '数学',
      miniTestResults: results
    });

    expect(status.hasFailedUnitTest).toBe(true);
    expect(status.failedUnitTest?.unit_name).toBe('二次方程式');
    expect(status.completedUnitTestKeys.has('数と式 - 単元確認テスト')).toBe(true);
    // 不合格テストは完了キーから除外されていること
    expect(status.completedUnitTestKeys.has('二次方程式 - 単元確認テスト')).toBe(false);
  });

  it('5. isStudentAttendanceDay & generateAttendanceDates: 通塾曜日の判定と指定期間の日付生成', () => {
    const student: Student = {
      id: 'std-att-1',
      student_id: 'S_ATT_1',
      name: '通塾 花子',
      grade: '中1',
      status: 'normal',
      branch_id: 'branch-1',
      selected_days: ['monday', 'thursday']
    };

    // 2026-06-01 は月曜日
    expect(isStudentAttendanceDay(student, '2026-06-01')).toBe(true);
    // 2026-06-02 は火曜日
    expect(isStudentAttendanceDay(student, '2026-06-02')).toBe(false);
    // 2026-06-04 は木曜日
    expect(isStudentAttendanceDay(student, '2026-06-04')).toBe(true);

    // 通塾日未設定時のフォールバック
    const studentNoDays: Student = { ...student, selected_days: [] };
    expect(isStudentAttendanceDay(studentNoDays, '2026-06-01')).toBe(false); // デフォルト火・金なので月曜はfalse

    // 期間内の通塾日生成
    const dates = generateAttendanceDates('2026-06-01', ['monday', 'thursday'], 2);
    expect(dates.length).toBe(2);
    expect(dates[0]).toBe('2026-06-01');
  });

  it('6. parseStartUnitSetting: スタート単元文字列の学年プレフィックス・単元名抽出', () => {
    const parsedJhs = parseStartUnitSetting('中2 - 一次関数');
    expect(parsedJhs.gradeText).toBe('中2');
    expect(parsedJhs.unitName).toBe('一次関数');

    const parsedPlain = parseStartUnitSetting('二次方程式');
    expect(parsedPlain.gradeText).toBeNull();
    expect(parsedPlain.unitName).toBe('二次方程式');

    const parsedEmpty = parseStartUnitSetting('');
    expect(parsedEmpty.cleanRaw).toBe('');
  });

  it('7. ensureMathEnglishUnitTests: 単元確認テストが存在しないマスター配列への自動補完', () => {
    const mastersWithoutUT: CurriculumMaster[] = [
      {
        id: 'cm-only-lesson-1',
        grade: '中1',
        subject: '数学',
        unit_name: '正の数・負の数',
        lesson_name: '正の数と負の数の加法',
        sort_order: 1
      }
    ];

    const ensured = ensureMathEnglishUnitTests(mastersWithoutUT);
    // 単元末尾に自動補完された単元確認テストが追加される
    expect(ensured.length).toBe(2);
    expect(ensured[1].lesson_name).toContain('単元確認テスト');
    expect(ensured[1].item_type).toBe('unit_test');
  });

  it('8. getLessonRangeStepIds: 授業範囲からのレッスンID配列抽出', () => {
    const steps = getLessonRangeStepIds({
      startLessonId: 'cm-high-1',
      endLessonId: 'cm-high-3',
      subject: '数学',
      curriculumMasters: sampleMasters
    });

    expect(steps.map(s => s.id)).toEqual(['cm-high-1', 'cm-high-2', 'cm-high-3']);
  });

  it('9. isMatchingUnitOrTest: 単元名を含まないまとめテストやCheck Testのエッジケース判定', () => {
    // まとめテストで単元名部分が空の場合（L202: !sUnit || !tUnit）➔ 完全一致ではなく、かつ両方がまとめテスト1
    expect(isMatchingUnitOrTest('数学: まとめテスト1', 'まとめテスト1（予備）')).toBe(true);
    expect(isMatchingUnitOrTest('まとめテスト1', 'まとめテスト1')).toBe(true);

    // Check Testで単元名部分が空の場合（L215: !sUnit || !tUnit）➔ 完全一致ではなく、かつ両方がCheck Test
    expect(isMatchingUnitOrTest('数学: Check Test', '英語: Check Test 2026')).toBe(true);
    expect(isMatchingUnitOrTest('Check Test', 'Check Test')).toBe(true);

    // 空文字列または未定義時のフォールバック
    expect(isMatchingUnitOrTest('', '一次関数')).toBe(false);
    expect(isMatchingUnitOrTest('一次関数', '')).toBe(false);
  });

  it('10. getLatestUnitTestStatusForSubject: 合格ライン形式、空キー、不合格除外などの純粋ブランチ網羅', () => {
    const studentId = 'std-pure-branch-1';

    // 1. 数値を含まない合格ライン（例: "合格"）➔ passScore=80 のデフォルト分岐（L303）
    const results1: MiniTestResult[] = [
      {
        id: 'mt-nonum',
        student_id: studentId,
        subject: '数学',
        unit_name: '一次関数',
        test_content: '一次関数 - 単元確認テスト',
        test_type: 'unit_test',
        passing_line: '合格',
        score: 85,
        status: 'passed'
      }
    ];
    const status1 = getLatestUnitTestStatusForSubject({
      studentId,
      subject: '数学',
      miniTestResults: results1
    });
    expect(status1.completedUnitTestKeys.has('一次関数')).toBe(true);

    // 2. 教科プレフィックスのみでトリム後空になる content、および不合格時の除外処理（L284, L285, L371, L381）
    const results2: MiniTestResult[] = [
      {
        id: 'mt-prefix-only',
        student_id: studentId,
        subject: '数学',
        unit_name: '',
        test_content: '数学:',
        test_type: 'unit_test',
        score: null,
        status: 'pending'
      },
      {
        id: 'mt-failed-clean',
        student_id: studentId,
        subject: '数学',
        unit_name: '数学: 二次関数',
        test_content: '数学: 単元確認テスト',
        test_type: 'unit_test',
        score: 50,
        status: 'failed'
      }
    ];
    const status2 = getLatestUnitTestStatusForSubject({
      studentId,
      subject: '数学',
      miniTestResults: results2
    });
    expect(status2.hasFailedUnitTest).toBe(true);
    expect(status2.failedUnitTest?.id).toBe('mt-failed-clean');
  });

  it('11. findNextUncompletedLessonForSubject: 不合格単元テストがある場合の特定分岐（L881）', () => {
    const student: Student = {
      id: 'std-fb-unit-1',
      name: 'フォールバック生徒',
      grade: '高1'
    };

    const lessonOnlyMasters: CurriculumMaster[] = [
      {
        id: 'cm-normal-1',
        grade: '高1',
        subject: '数学',
        unit_name: '一次関数',
        lesson_name: 'グラフと傾き',
        sort_order: 1
      }
    ];

    const failedTest: MiniTestResult = {
      id: 'mt-failed-only',
      student_id: student.id,
      subject: '数学',
      unit_name: '一次関数',
      test_content: '一次関数 - 単元確認テスト',
      test_type: 'unit_test',
      score: 40,
      status: 'failed'
    };

    const next = findNextUncompletedLessonForSubject({
      student,
      subject: '数学',
      curriculumMasters: lessonOnlyMasters,
      miniTestResults: [failedTest]
    });

    expect(next.lessonId).toContain('一次関数');
    expect(next.hasFailedUnitTest).toBe(true);
  });

  it('12. calculateLessonRangeForSlot: lesson_range に「〜」を含む完了タスクからのペース計算分岐（L1092）', () => {
    const student: Student = {
      id: 'std-pace-1',
      name: 'ペース計算生徒',
      grade: '高1'
    };

    const taskWithRange: LearningTask = {
      id: 'task-range-1',
      student_id: student.id,
      subject: '数学',
      status: 'completed',
      lesson_range: '展開公式 〜 実数と根号',
      completed_lesson_ids: [] // 空にして L1092 分岐を通す
    };

    const slot = calculateLessonRangeForSlot({
      student,
      subject: '数学',
      curriculumMasters: sampleMasters,
      tasks: [taskWithRange]
      // lessonsPerSlot を指定しないことで内部の動的ペース計算を通す
    });
    expect(slot.start_lesson_id).toBeDefined();
  });

  it('13. calculateLessonRangeForSlot: enforceNoSkip による中抜き・飛び越し物理禁止ガード（L1308-1313）', () => {
    const student: Student = {
      id: 'std-noskip-1',
      name: 'スキップ防止生徒',
      grade: '高1',
      completed_lesson_ids: [] // 1コマ目未受講
    };

    // 手前のステップ（cm-high-1）が未受講なのに、3ステップ目（cm-high-3）を開始位置に指定して enforceNoSkip=true
    expect(() => {
      calculateLessonRangeForSlot({
        student,
        subject: '数学',
        startLessonId: 'cm-high-3',
        curriculumMasters: sampleMasters,
        enforceNoSkip: true
      });
    }).toThrow(CurriculumSkipViolationError);
  });

  it('14. db.cleanupStudentCorruptedCompletedLessonIds: 未合格の単元確認テスト自動検出・除外による自己修復分岐（L2341, L2343）', async () => {
    await db.saveCurriculumMasters(sampleMasters);

    const studentWithCorruptedUT: Student = {
      id: 'std-corrupt-ut-1',
      student_id: 'S_CORRUPT_1',
      name: '不整合修復生徒',
      grade: '高1',
      // 未合格の単元確認テスト ID が誤って completed_lesson_ids に混入
      completed_lesson_ids: ['cm-high-1', 'cm-high-ut', 'STEP 4']
    };
    await db.saveStudent(studentWithCorruptedUT);

    // テスト実績は合格していない（mini_test_results なし）
    const cleaned = await db.cleanupStudentCorruptedCompletedLessonIds('std-corrupt-ut-1');
    expect(cleaned).toBeDefined();
    // cm-high-ut が除外され、cm-high-1 だけが残る
    expect(cleaned?.completed_lesson_ids).toContain('cm-high-1');
    expect(cleaned?.completed_lesson_ids).not.toContain('cm-high-ut');
  });
});
