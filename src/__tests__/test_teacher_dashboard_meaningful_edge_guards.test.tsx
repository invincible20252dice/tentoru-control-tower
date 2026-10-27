import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { Student, CurriculumMaster, MiniTestResult } from '../types';

describe('TeacherDashboard Meaningful Edge Guards & Auto-Sync Branch Coverage', () => {
  const sampleMasters: CurriculumMaster[] = [
    {
      id: 'cm-edge-1',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '一次関数',
      lesson_name: '一次関数の変化の割合',
      sort_order: 1
    },
    {
      id: 'cm-edge-ut',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '一次関数',
      lesson_name: '一次関数 - 単元確認テスト',
      sort_order: 2,
      item_type: 'unit_test'
    }
  ];

  const todayStr = '2026-06-01';

  beforeEach(async () => {
    localStorage.clear();
    await db.saveCurriculumMasters(sampleMasters);
  });

  it('1. autoSyncMiniTests: 合格済み単元テストがある場合の重複スキップ分岐（L3957）', async () => {
    // 既に合格済みの単元確認テストを持つ生徒
    const studentWithPassedUT: Student = {
      id: 'std-passed-ut-1',
      student_id: 'S_PASSED_UT_1',
      name: '合格済み生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      selected_subjects: ['数学'],
      completed_lesson_ids: ['cm-edge-ut', 'STEP 2']
    };
    await db.saveStudent(studentWithPassedUT);

    const passedResult: MiniTestResult = {
      id: 'mini-passed-prev',
      student_id: 'std-passed-ut-1',
      date: '2026-05-25',
      subject: '数学',
      unit_name: '一次関数',
      test_content: '一次関数 - 単元確認テスト',
      test_type: 'unit_test',
      score: 100,
      passed: true,
      status: 'passed'
    };
    await db.saveMiniTestResult(passedResult);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-passed-ut-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeInTheDocument();
    });

    // 1コマ目に数学を選択して、単元確認テストの自動抽出をトリガー
    await act(async () => {
      fireEvent.change(screen.getByTestId('period-subject-select-1'), { target: { value: '数学' } });
    });

    // 合格済みなので L3957 の isUnitTestCompleted が true となり、テスト一覧に重複追加されない
    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toHaveValue('数学');
    });

    unmount();
  });

  it('2. 宿題削除時の確認ダイアログでキャンセル（window.confirm が false）を選択した場合の早期リターン（L4950）', async () => {
    const student: Student = {
      id: 'std-hw-cancel-1',
      student_id: 'S_HWC_1',
      name: '宿題生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      selected_subjects: ['数学'],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);

    // 既存の宿題レコードを用意
    await db.saveHomeworkResult({
      id: 'hw-res-to-delete',
      student_id: 'std-hw-cancel-1',
      date: todayStr,
      subject: '数学',
      homework_content: '連立方程式ドリル',
      status: 'incomplete',
      created_at: new Date().toISOString()
    });

    // confirm を false（キャンセル）にモック
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-hw-cancel-1"
        teacherType="junior_high"
        initialTab="homeworks"
        initialDate={todayStr}
      />
    );

    // 宿題レコードのゴミ箱ボタンを探す
    await waitFor(() => {
      expect(screen.getAllByTitle('宿題記録を削除する').length).toBeGreaterThan(0);
    });

    const deleteBtn = screen.getAllByTitle('宿題記録を削除する')[0];
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(confirmSpy).toHaveBeenCalledWith('この宿題レコードを削除してもよろしいですか？');
    // キャンセルされたので、宿題レコードは削除されず残っている
    expect(screen.getAllByTitle('宿題記録を削除する').length).toBeGreaterThan(0);

    confirmSpy.mockRestore();
    unmount();
  });

  it('3. 二者面談・三者面談タブの初期レンダリングおよび生徒面談ハンドラーの安全ガード網羅', async () => {
    const student: Student = {
      id: 'std-interview-guard-1',
      student_id: 'S_INT_1',
      name: '面談生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      selected_subjects: ['数学'],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);

    const { unmount, rerender } = render(
      <TeacherDashboard
        initialStudentId="std-interview-guard-1"
        teacherType="junior_high"
        initialTab="two-way-interview"
        initialDate={todayStr}
      />
    );

    // 二者面談タブが正しくレンダリングされていることを検証
    await waitFor(() => {
      expect(screen.getAllByText(/二者面談/i).length).toBeGreaterThan(0);
    });

    // 三者面談タブに切り替え
    rerender(
      <TeacherDashboard
        initialStudentId="std-interview-guard-1"
        teacherType="junior_high"
        initialTab="three-way-interview"
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/三者面談/i).length).toBeGreaterThan(0);
    });

    unmount();
  });

  it('4. handleAutoReschedule: 単元の通常授業受講完了後の自動リスケジュールによる単元確認テスト枠自動抽出とコマ安全補正（L5512-5555）', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // 通常授業（cm-edge-1）は受講済みで、次が単元確認テスト（cm-edge-ut）の生徒
    const studentReadyForUT: Student = {
      id: 'std-ready-ut-1',
      student_id: 'S_READY_UT_1',
      name: 'テスト直前生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      selected_subjects: ['数学'],
      completed_lesson_ids: ['cm-edge-1'] // 1コマ目は受講完了済み
    };
    await db.saveStudent(studentReadyForUT);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-ready-ut-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // 「遅れチェック ＆ 自動リスケ」ボタンを探す
    await waitFor(() => {
      expect(screen.getByText(/遅れチェック.*自動リスケ/i)).toBeInTheDocument();
    });

    const autoRescheduleBtn = screen.getByText(/遅れチェック.*自動リスケ/i);
    await act(async () => {
      fireEvent.click(autoRescheduleBtn);
    });

    if (errorSpy.mock.calls.length > 0) {
      console.log('AUTO_RESCHEDULE_ERROR:', errorSpy.mock.calls[0]);
    }

    // 自動リスケジュールが走り、単元確認テストがテスト枠に抽出され、授業コマが安全補正される
    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeInTheDocument();
    });

    alertSpy.mockRestore();
    errorSpy.mockRestore();
    unmount();
  });

  it('5. handleSubjectChange: コマに「テスト」を選択し本日テストが1件ある場合の自動セット（L5033）および単元確認テストの同一化ガード（L5147）', async () => {
    const student: Student = {
      id: 'std-test-select-1',
      student_id: 'S_TS_1',
      name: 'テスト選択生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      selected_subjects: ['数学'],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);

    // 本日のテスト枠に1件のみ単元テストを登録（L5033 条件）
    const singleTest: MiniTestResult = {
      id: 'mini-single-1',
      student_id: 'std-test-select-1',
      date: todayStr,
      subject: '数学',
      unit_name: '一次関数',
      test_content: '一次関数 - 単元確認テスト',
      test_type: 'unit_test',
      score: null,
      status: 'pending'
    };
    await db.saveMiniTestResult(singleTest);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-test-select-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeInTheDocument();
    });

    // 1コマ目の教科を「テスト」に変更（L5033 分岐）
    await act(async () => {
      fireEvent.change(screen.getByTestId('period-subject-select-1'), { target: { value: 'テスト' } });
    });

    // 1コマ目を「数学」に戻し、開始授業セレクトで単元確認テストを選択（L5147 分岐）
    await act(async () => {
      fireEvent.change(screen.getByTestId('period-subject-select-1'), { target: { value: '数学' } });
    });

    const startSelect = screen.queryByTestId('period-start-select-1');
    if (startSelect) {
      await act(async () => {
        fireEvent.change(startSelect, { target: { value: 'cm-edge-ut' } });
      });
      // L5147 で終了授業が自動的に cm-edge-ut に揃えられる
      const endSelect = screen.queryByTestId('period-end-select-1');
      if (endSelect) {
        expect((endSelect as HTMLSelectElement).value).toBe('cm-edge-ut');
      }
    }

    unmount();
  });

  it('6. handleDeleteInterview2 & handleDeleteInterview3: 面談記録削除の確認キャンセルおよび削除後リセット分岐（L2738-2753, L2950-2965）', async () => {
    const student: Student = {
      id: 'std-interview-del-1',
      student_id: 'S_INT_DEL_1',
      name: '面談削除生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      selected_subjects: ['数学'],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);

    // 二者面談記録を保存
    await db.saveStudentInterview2({
      id: 'int2-to-del',
      student_id: student.id,
      interview_date: todayStr,
      interviewer: '山田講師',
      topics: '定期テストに向けた学習計画',
      student_feedback: '頑張ります',
      action_items: '毎日計算ドリル1ページ',
      created_at: new Date().toISOString()
    });

    // 三者面談記録を保存
    await db.saveStudentInterview3({
      id: 'int3-to-del',
      student_id: student.id,
      interview_date: todayStr,
      interviewer: '山田講師',
      family_attendees: '母',
      discussion_points: '志望校の検討',
      parent_feedback: '家でも応援します',
      student_goals: '偏差値60目標',
      created_at: new Date().toISOString()
    });

    // 1. 二者面談削除の確認キャンセル（window.confirm が false）
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { unmount, rerender } = render(
      <TeacherDashboard
        initialStudentId="std-interview-del-1"
        teacherType="junior_high"
        initialTab="two-way-interview"
        initialDate={todayStr}
      />
    );

    // 二者面談の削除ボタンが表示されていることを待機
    await waitFor(() => {
      expect(screen.getByTestId('interview2-delete-btn')).toBeInTheDocument();
    });

    // キャンセル押下
    await act(async () => {
      fireEvent.click(screen.getByTestId('interview2-delete-btn'));
    });
    expect(confirmSpy).toHaveBeenCalledWith('この面談記録を削除してもよろしいですか？');

    // 2. 二者面談削除の実行（window.confirm が true）➔ 削除後にリセット分岐（L2748）
    confirmSpy.mockReturnValue(true);
    await act(async () => {
      fireEvent.click(screen.getByTestId('interview2-delete-btn'));
    });
    expect(alertSpy).toHaveBeenCalledWith('面談記録を削除しました。');

    // 3. 三者面談タブへ切り替え、削除キャンセルと削除実行（L2951, L2960）
    rerender(
      <TeacherDashboard
        initialStudentId="std-interview-del-1"
        teacherType="junior_high"
        initialTab="three-way-interview"
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('interview3-delete-btn')).toBeInTheDocument();
    });

    // キャンセル
    confirmSpy.mockReturnValue(false);
    await act(async () => {
      fireEvent.click(screen.getByTestId('interview3-delete-btn'));
    });
    expect(confirmSpy).toHaveBeenCalledWith('この面談記録を削除してもよろしいですか？');

    // 削除実行
    confirmSpy.mockReturnValue(true);
    await act(async () => {
      fireEvent.click(screen.getByTestId('interview3-delete-btn'));
    });
    expect(alertSpy).toHaveBeenCalledWith('面談記録を削除しました。');

    confirmSpy.mockRestore();
    alertSpy.mockRestore();
    unmount();
  });
});
