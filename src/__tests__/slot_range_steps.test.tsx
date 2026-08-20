import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import StudentDashboard from '../components/StudentDashboard';
import SugorokuMap from '../components/SugorokuMap';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';

describe('Slot Range (From-To) Dynamic Step Expansion & Sugoroku Highlight Integration', () => {
  const mockStudent: Student = {
    id: 'std-test-slot',
    name: 'テスト生徒',
    grade: '小1',
    login_id: 'test_student_slot',
    password: 'pass',
    status: 'normal',
    completed_lesson_ids: [],
    selected_subjects: ['算数', '国語', '英語'],
    created_at: new Date().toISOString()
  };

  const mockCurriculumMasters: CurriculumMaster[] = [
    { id: 'cm-p1-m1', grade: '小1', subject: '算数', unit_name: 'たしざん(1)', lesson_name: 'あわせていくつ', sort_order: 10 },
    { id: 'cm-p1-m2', grade: '小1', subject: '算数', unit_name: 'ひきざん(1)', lesson_name: 'のこりはいくつ', sort_order: 11 },
    { id: 'cm-p1-m3', grade: '小1', subject: '算数', unit_name: 'ひきざん(2)', lesson_name: 'ちがいはいくつ', sort_order: 12 },
    { id: 'cm-p1-m4', grade: '小1', subject: '算数', unit_name: 'ひきざん(3)', lesson_name: 'ひきざんのけいさん', sort_order: 13 },
    { id: 'cm-p1-e1', grade: '小1', subject: '英語', unit_name: 'アルファベット', lesson_name: 'A〜Gの発音', sort_order: 1 },
    { id: 'cm-p1-e2', grade: '小1', subject: '英語', unit_name: '単語', lesson_name: '身の回りのもの', sort_order: 2 },
  ];

  beforeEach(() => {
    localStorage.clear();
    db.saveCurriculumMasters(mockCurriculumMasters);
  });

  test('生徒画面で From(sort_order: 11) 〜 To(sort_order: 12) の算数2授業分が 0/2 完了として全ステップ展開される', async () => {
    const taskMath: LearningTask = {
      id: 'task-math-range',
      student_id: mockStudent.id,
      unit_id: 'cm-p1-m2',
      scheduled_date: '2026-08-20',
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: '算数',
      start_lesson_id: 'cm-p1-m2',
      start_lesson_name: 'ひきざん(1)',
      end_lesson_id: 'cm-p1-m3',
      end_lesson_name: 'ひきざん(2)',
      lesson_range: 'ひきざん(1) 〜 ひきざん(2)',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };

    await db.saveStudent(mockStudent);
    await db.saveLearningTasks([taskMath]);

    render(
      <StudentDashboard
        student={mockStudent}
        initialDate="2026-08-20"
        onBackToPortal={() => {}}
      />
    );

    // 0 / 2 完了と表示されること (単一0/1完了フォールバックではないこと)
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('0 / 2 完了');
    });

    // STEP 1 と STEP 2 の両方が描画されること
    expect(screen.getByTestId('step-card-1-0')).toBeInTheDocument();
    expect(screen.getByTestId('step-card-1-1')).toBeInTheDocument();
  });

  test('すごろくマップで From 〜 To 範囲の全マスが 🟠 オレンジ(stepToday)としてハイライトされる', async () => {
    const taskMath: LearningTask = {
      id: 'task-math-range',
      student_id: mockStudent.id,
      unit_id: 'cm-p1-m2',
      scheduled_date: '2026-08-20',
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: '算数',
      start_lesson_id: 'cm-p1-m2',
      start_lesson_name: 'ひきざん(1)',
      end_lesson_id: 'cm-p1-m3',
      end_lesson_name: 'ひきざん(2)',
      lesson_range: 'ひきざん(1) 〜 ひきざん(2)',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };

    render(
      <SugorokuMap
        subject="算数"
        student={mockStudent}
        tasks={[taskMath]}
        todayTasks={[taskMath]}
      />
    );

    // cm-p1-m2 (ひきざん1) と cm-p1-m3 (ひきざん2) のテスト・動画ノードが本日の目標(stepToday)クラスを持つこと
    const videoNodeM2 = screen.getByTestId('sugoroku-video-cm-p1-m2');
    const videoNodeM3 = screen.getByTestId('sugoroku-video-cm-p1-m3');

    expect(videoNodeM2.className).toContain('stepToday');
    expect(videoNodeM3.className).toContain('stepToday');
  });

  test('他教科（英語）のコマに算数の単元やレッスンが紛れ込まないこと', async () => {
    const taskEnglish: LearningTask = {
      id: 'task-eng-range',
      student_id: mockStudent.id,
      unit_id: 'cm-p1-e1',
      scheduled_date: '2026-08-20',
      period: 2,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: '英語',
      start_lesson_id: 'cm-p1-e1',
      start_lesson_name: 'A〜Gの発音',
      end_lesson_id: 'cm-p1-e2',
      end_lesson_name: '身の回りのもの',
      lesson_range: 'A〜Gの発音 〜 身の回りのもの',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };

    await db.saveStudent(mockStudent);
    await db.saveLearningTasks([taskEnglish]);

    render(
      <StudentDashboard
        student={mockStudent}
        initialDate="2026-08-20"
        onBackToPortal={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-2')).toHaveTextContent('0 / 2 完了');
    });

    // 英語のコマ枠内(period-row-2)に英語のステップのみが表示され、算数の単元(「ひきざん」など)は一切表示されないこと
    const period2Row = screen.getByTestId('period-row-2');
    expect(within(period2Row).getByTestId('step-card-2-0')).toBeInTheDocument();
    expect(within(period2Row).getByTestId('step-card-2-1')).toBeInTheDocument();
    expect(within(period2Row).getAllByText(/A〜Gの発音/)[0]).toBeInTheDocument();
    expect(within(period2Row).getAllByText(/身の回りのもの/)[0]).toBeInTheDocument();
    expect(within(period2Row).queryByText(/ひきざん/)).not.toBeInTheDocument();
  });
});
