import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TimelineSubjectView from '../components/TimelineSubjectView';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, LearningTask, CurriculumMaster, MiniTestResult } from '../lib/db';

describe('Dynamic Timeline Date Sync and Mini-Test Deduplication Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '入力');
  });

  describe('1. TimelineSubjectView Dynamic Date Sync & Highlighting', () => {
    it('should dynamically synchronize schedule date and highlight active tasks for any selected date', async () => {
      // 動的日付の生成（特定日付のハードコード禁止ルール遵守）
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const student: Student = {
        id: 'student-dynamic-timeline-1',
        name: '動的タイムライン検証生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: 'てんとる小',
        period_count: 2,
        day_of_week: ['mon', 'thu'],
        selected_subjects: ['算数'],
        completed_lesson_ids: ['step-math-1', 'step-math-2'],
        created_at: today.toISOString()
      };

      const timelineUnits = [
        { id: 'step-math-1', name: 'かずと すうじ(1)', sort_order: 1, subject: '算数', grade: '小1' },
        { id: 'step-math-2', name: 'かずと すうじ(2)', sort_order: 2, subject: '算数', grade: '小1' },
        { id: 'step-math-3', name: 'いくつと いくつ(1)', sort_order: 3, subject: '算数', grade: '小1' },
        { id: 'step-math-4', name: 'いくつと いくつ(2)', sort_order: 4, subject: '算数', grade: '小1' },
        { id: 'step-math-5', name: 'たしざん(1)', sort_order: 5, subject: '算数', grade: '小1' },
        { id: 'step-math-ut', name: 'かずとすうじ 単元確認テスト', sort_order: 6, subject: '算数', grade: '小1', item_type: 'unit_test' as const }
      ];

      // 明日のコマ割りタスク: STEP 3 & 4
      // 将来日（7日後）のタスク: STEP 5
      const studentTasks: LearningTask[] = [
        {
          id: 'task-tomorrow-1',
          student_id: student.id,
          subject: '算数',
          scheduled_date: tomorrowStr,
          period: 1,
          unit_id: 'step-math-3',
          start_lesson_id: 'step-math-3',
          end_lesson_id: 'step-math-4',
          lesson_ids: ['step-math-3', 'step-math-4'],
          status: 'unstarted',
          test_passed: false,
          created_at: today.toISOString()
        },
        {
          id: 'task-future-1',
          student_id: student.id,
          subject: '算数',
          scheduled_date: futureDateStr,
          period: 1,
          unit_id: 'step-math-5',
          start_lesson_id: 'step-math-5',
          end_lesson_id: 'step-math-5',
          lesson_ids: ['step-math-5'],
          status: 'unstarted',
          test_passed: false,
          created_at: today.toISOString()
        }
      ];

      const onDateChangeMock = vi.fn();

      const { rerender } = render(
        <TimelineSubjectView
          student={student}
          subject="算数"
          targetDate={tomorrowStr}
          onDateChange={onDateChangeMock}
          timelineUnits={timelineUnits as any}
          studentTasks={studentTasks}
          miniTestResults={[]}
        />
      );

      // 1. 初期描画で targetDate (tomorrowStr) が反映されていることを検証
      const dateText = screen.getByTestId('timeline-current-date-text');
      expect(dateText.textContent).toBe(tomorrowStr);

      const datePicker = screen.getByTestId('timeline-schedule-date-picker') as HTMLInputElement;
      expect(datePicker.value).toBe(tomorrowStr);

      // STEP 1, 2 は完了
      const step1 = screen.getByTestId('timeline-step-1');
      expect(step1.getAttribute('data-step-status')).toBe('completed');
      const step2 = screen.getByTestId('timeline-step-2');
      expect(step2.getAttribute('data-step-status')).toBe('completed');

      // 明日のタスクである STEP 3, 4 が「現在地」としてハイライト
      const step3 = screen.getByTestId('timeline-step-3');
      expect(step3.getAttribute('data-step-status')).toBe('current');
      const step4 = screen.getByTestId('timeline-step-4');
      expect(step4.getAttribute('data-step-status')).toBe('current');

      // STEP 5 は「予定」
      const step5 = screen.getByTestId('timeline-step-5');
      expect(step5.getAttribute('data-step-status')).toBe('planned');

      // 2. 日付ピッカーで将来日 (futureDateStr) に変更
      fireEvent.change(datePicker, { target: { value: futureDateStr } });
      expect(onDateChangeMock).toHaveBeenCalledWith(futureDateStr);

      // STEP 5 が「現在地」に変化し、STEP 3, 4 は「予定」に戻る
      await waitFor(() => {
        expect(screen.getByTestId('timeline-current-date-text').textContent).toBe(futureDateStr);
        expect(screen.getByTestId('timeline-step-3').getAttribute('data-step-status')).toBe('planned');
        expect(screen.getByTestId('timeline-step-4').getAttribute('data-step-status')).toBe('planned');
        expect(screen.getByTestId('timeline-step-5').getAttribute('data-step-status')).toBe('current');
      });

      // 3. 「今日」ボタンを押すと当日に動的復帰
      const todayBtn = screen.getByTestId('timeline-today-btn');
      fireEvent.click(todayBtn);
      expect(onDateChangeMock).toHaveBeenCalledWith(todayStr);

      await waitFor(() => {
        expect(screen.getByTestId('timeline-current-date-text').textContent).toBe(todayStr);
        expect(datePicker.value).toBe(todayStr);
      });
    });

    it('should highlight unit test when scheduled on target date', async () => {
      const today = new Date();
      const testDateStr = new Date(today.getTime() + 86400000 * 2).toISOString().split('T')[0];

      const student: Student = {
        id: 'student-unit-test-sync',
        name: '単元テスト検証生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: 'てんとる小',
        period_count: 2,
        day_of_week: ['tue'],
        selected_subjects: ['算数'],
        completed_lesson_ids: ['step-math-1'],
        created_at: today.toISOString()
      };

      const timelineUnits = [
        { id: 'step-math-1', name: 'かずと すうじ', sort_order: 1, subject: '算数' },
        { id: 'step-math-ut', name: 'かずとすうじ 単元確認テスト', sort_order: 2, subject: '算数', item_type: 'unit_test' as const }
      ];

      const miniTestResults: MiniTestResult[] = [
        {
          id: 'mini-ut-1',
          student_id: student.id,
          date: testDateStr,
          subject: '算数',
          test_type: 'unit_test',
          unit_name: 'かずとすうじ 単元確認テスト',
          test_content: 'かずとすうじ 単元確認テスト',
          score: null,
          passed: false,
          created_at: today.toISOString()
        }
      ];

      render(
        <TimelineSubjectView
          student={student}
          subject="算数"
          targetDate={testDateStr}
          timelineUnits={timelineUnits as any}
          studentTasks={[]}
          miniTestResults={miniTestResults}
        />
      );

      // 単元テストが現在地としてハイライトされることを検証
      const utStep = screen.getByTestId('timeline-step-2');
      expect(utStep.getAttribute('data-step-status')).toBe('current');
    });

    it('should support unit test edit, delete, exclude callbacks and empty state', () => {
      const student: Student = {
        id: 'student-callbacks-test',
        name: 'コールバック検証生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: 'てんとる小',
        period_count: 2,
        day_of_week: ['wed'],
        selected_subjects: ['算数'],
        completed_lesson_ids: [],
        created_at: new Date().toISOString()
      };

      const timelineUnits = [
        { id: 'unit-test-master-1', name: 'かずとすうじ 単元確認テスト', sort_order: 1, subject: '算数', item_type: 'unit_test' as const }
      ];

      const onEditMock = vi.fn();
      const onDeleteMock = vi.fn();
      const onExcludeMock = vi.fn();

      const { rerender } = render(
        <TimelineSubjectView
          student={student}
          subject="算数"
          timelineUnits={timelineUnits as any}
          onOpenEditUnitTestModal={onEditMock}
          onDeleteUnitTestMaster={onDeleteMock}
          onExcludeLesson={onExcludeMock}
        />
      );

      // 編集ボタンクリック
      fireEvent.click(screen.getByTestId('timeline-edit-unittest-btn'));
      expect(onEditMock).toHaveBeenCalledWith(timelineUnits[0]);

      // 削除ボタンクリック
      fireEvent.click(screen.getByTestId('timeline-delete-unittest-btn'));
      expect(onDeleteMock).toHaveBeenCalledWith('unit-test-master-1');

      // 除外ボタンクリック
      fireEvent.click(screen.getByTestId('timeline-exclude-btn'));
      expect(onExcludeMock).toHaveBeenCalledWith('unit-test-master-1', 'かずとすうじ 単元確認テスト');

      // 空配列時の表示検証
      rerender(
        <TimelineSubjectView
          student={student}
          subject="算数"
          timelineUnits={[]}
        />
      );
      expect(screen.getByText('カリキュラムデータがありません。')).toBeTruthy();
    });

    it('should extract lesson ids from unit_id / start_lesson_id / end_lesson_id and match mini test by test_content', () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const student: Student = {
        id: 'student-task-ids-test',
        name: 'タスクID抽出テスト生徒',
        grade: '小1',
        grade_category: 'elementary',
        school_name: 'てんとる小',
        period_count: 1,
        day_of_week: ['mon'],
        selected_subjects: ['算数'],
        completed_lesson_ids: [],
        created_at: today.toISOString()
      };

      const timelineUnits = [
        { id: 'unit-1', name: '授業1', sort_order: 1, subject: '算数' },
        { id: 'unit-2', name: '授業2', sort_order: 2, subject: '算数' },
        { id: 'unit-test-3', name: '単元確認テスト3', sort_order: 3, subject: '算数', item_type: 'unit_test' as const }
      ];

      // lesson_ids 配列を持たず、unit_id / start_lesson_id / end_lesson_id を持つタスク
      const tasks: LearningTask[] = [
        {
          id: 'task-no-lesson-ids',
          student_id: student.id,
          subject: '算数',
          scheduled_date: todayStr,
          period: 1,
          unit_id: 'unit-1',
          start_lesson_id: 'unit-1',
          end_lesson_id: 'unit-2',
          status: 'unstarted',
          test_passed: false,
          created_at: today.toISOString()
        }
      ];

      // test_content でマッチする単元テスト
      const miniTests: MiniTestResult[] = [
        {
          id: 'mini-content-match',
          student_id: student.id,
          date: todayStr,
          subject: '算数',
          test_type: 'unit_test',
          test_content: '単元確認テスト3',
          score: null,
          passed: false,
          created_at: today.toISOString()
        }
      ];

      render(
        <TimelineSubjectView
          student={student}
          subject="算数"
          timelineUnits={timelineUnits as any}
          studentTasks={tasks}
          miniTestResults={miniTests}
        />
      );

      // STEP 1, STEP 2, STEP 3 すべてが当日アクティブ（現在地）
      expect(screen.getByTestId('timeline-step-1').getAttribute('data-step-status')).toBe('current');
      expect(screen.getByTestId('timeline-step-2').getAttribute('data-step-status')).toBe('current');
      expect(screen.getByTestId('timeline-step-3').getAttribute('data-step-status')).toBe('current');
    });
  });

  describe('2. Mini-Test Deduplication (db.ts & TeacherDashboard)', () => {
    it('should deduplicate and reuse ID when saving same student, date, and test', async () => {
      const today = new Date();
      const testDate = new Date(today.getTime() + 86400000 * 3).toISOString().split('T')[0];
      const studentId = 'student-dedupe-test-1';

      // 1回目の単元テスト保存
      const firstResult: MiniTestResult = {
        id: `mini-${studentId}-${testDate}-1`,
        student_id: studentId,
        date: testDate,
        subject: '算数',
        test_type: 'unit_test',
        unit_name: 'かずとすうじ 単元確認テスト',
        test_content: 'かずとすうじ 単元確認テスト',
        score: null,
        passed: false,
        created_at: today.toISOString()
      };
      await db.saveMiniTestResult(firstResult);

      const listAfterFirst = db.getMiniTestResults().filter(r => r.student_id === studentId && r.date === testDate);
      expect(listAfterFirst.length).toBe(1);
      expect(listAfterFirst[0].id).toBe(firstResult.id);

      // 2回目の保存（別IDが生成されても、同一生徒・同一日・同一内容なのでIDを再利用・重複防止）
      const duplicateAttempt: MiniTestResult = {
        id: `mini-${studentId}-${testDate}-different-id-generated`,
        student_id: studentId,
        date: testDate,
        subject: '算数',
        test_type: 'unit_test',
        unit_name: 'かずとすうじ 単元確認テスト',
        test_content: 'かずとすうじ　単元確認テスト', // 全角スペースの表記揺れ
        score: 85,
        passed: true,
        created_at: new Date().toISOString()
      };
      const savedResult = await db.saveMiniTestResult(duplicateAttempt);

      // 保存された結果のIDは1回目の既存レコードと同一
      expect(savedResult.id).toBe(firstResult.id);

      // DB内の件数は1件のまま維持（二重登録が根絶されている）
      const listAfterSecond = db.getMiniTestResults().filter(r => r.student_id === studentId && r.date === testDate);
      expect(listAfterSecond.length).toBe(1);
      expect(listAfterSecond[0].id).toBe(firstResult.id);
      expect(listAfterSecond[0].score).toBe(85);
      expect(listAfterSecond[0].passed).toBe(true);
    });
  });

  describe('3. Nakao-kun Math Clean Slate & Skip Prevention', () => {
    it('should not mark future addition (たしざん) steps as completed when earlier steps are incomplete', () => {
      // 中尾くんのケース：STEP 1〜4（かずと すうじ）が完了、STEP 5〜18が未完了
      const student: Student = {
        id: 'student24295',
        name: '中尾 友哉',
        grade: '小1',
        grade_category: 'elementary',
        school_name: '日野校',
        period_count: 2,
        day_of_week: ['tue'],
        selected_subjects: ['算数'],
        // 過去の汚染で誤って入っていた STEP 19（たしざん）のIDを含む汚染データ
        completed_lesson_ids: ['step-m-1', 'step-m-2', 'step-m-3', 'step-m-4', 'step-m-19'],
        created_at: new Date().toISOString()
      };

      const timelineUnits = [
        { id: 'step-m-1', name: 'かずと すうじ(1)', sort_order: 1, subject: '算数' },
        { id: 'step-m-2', name: 'かずと すうじ(2)', sort_order: 2, subject: '算数' },
        { id: 'step-m-3', name: 'かずと すうじ(3)', sort_order: 3, subject: '算数' },
        { id: 'step-m-4', name: 'かずと すうじ(4)', sort_order: 4, subject: '算数' },
        { id: 'step-m-5', name: 'いくつと いくつ(1)', sort_order: 5, subject: '算数' }, // 未完了
        { id: 'step-m-6', name: 'いくつと いくつ(2)', sort_order: 6, subject: '算数' }, // 未完了
        { id: 'step-m-19', name: 'たしざん(1)', sort_order: 19, subject: '算数' } // 飛び石データ
      ];

      render(
        <TimelineSubjectView
          student={student}
          subject="算数"
          timelineUnits={timelineUnits as any}
          studentTasks={[]}
          miniTestResults={[]}
        />
      );

      // STEP 1〜4 は「✓ 完了」
      expect(screen.getByTestId('timeline-step-1').getAttribute('data-step-status')).toBe('completed');
      expect(screen.getByTestId('timeline-step-2').getAttribute('data-step-status')).toBe('completed');
      expect(screen.getByTestId('timeline-step-3').getAttribute('data-step-status')).toBe('completed');
      expect(screen.getByTestId('timeline-step-4').getAttribute('data-step-status')).toBe('completed');

      // STEP 5 は「○ 予定」
      expect(screen.getByTestId('timeline-step-5').getAttribute('data-step-status')).toBe('planned');

      // 飛び石の STEP 19（たしざん）は「✓ 完了」にならず、「○ 予定」として中抜き受講が遮断されていること
      const step19 = screen.getByTestId('timeline-step-7'); // timelineUnitsの7番目要素
      expect(step19.getAttribute('data-step-status')).toBe('planned');
      expect(step19.textContent).not.toContain('✓ 完了');
    });
  });
});
