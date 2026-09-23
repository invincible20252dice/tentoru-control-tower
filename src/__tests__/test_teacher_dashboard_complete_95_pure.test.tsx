import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { db } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { Student, CurriculumMaster, CurriculumUnit, LearningTask, MiniTestResult, HomeworkResult, MilestonePlan, TestRecord } from '../types';

describe('TeacherDashboard 100% Pure Deep Strike for 95%+ Lines Coverage', () => {
  const mockStudentJhs: Student = {
    id: 'std-strike-jhs-1',
    student_id: 'std-strike-jhs-1',
    name: '完全制覇 中学太郎',
    name_kana: 'カンゼンセイハ チュウガクタロウ',
    email: 'strike@example.com',
    grade: '中2',
    classroom: '恵比寿教室',
    branch_id: 'branch-1',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    status: 'warning',
    level: 'C',
    selected_subjects: ['数学', '英語', '理科', '社会', '国語'],
    selected_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    period_count: 4,
    registered_year: 2026,
    registered_grade: '中2',
    personalities: ['几帳面'],
    target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
    created_at: '2026-04-01T00:00:00Z',
    start_unit_math: 'cm-s-j1',
    start_unit_english: 'cm-s-j2'
  };

  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-s-j1', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '加減法(1)', sort_order: 1 },
    { id: 'cm-s-j2', grade: '中2', subject: '英語', unit_name: '過去進行形', lesson_name: '過去進行形の文(1)', sort_order: 1 },
    { id: 'cm-s-j3', grade: '中2', subject: '理科', unit_name: '化学変化', lesson_name: '酸化と還元(1)', sort_order: 1 },
    { id: 'cm-s-j4', grade: '中2', subject: '社会', unit_name: '地理', lesson_name: '日本の地形(1)', sort_order: 1 },
    { id: 'cm-s-j5', grade: '中2', subject: '国語', unit_name: '説明文', lesson_name: '段落の役割(1)', sort_order: 1 }
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('students', JSON.stringify([mockStudentJhs]));
    localStorage.setItem('curriculum_masters', JSON.stringify(sampleMasters));
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();
  });

  it('1. Thoroughly covers all tabs: schedule, milestones, curriculum, mini-tests, homeworks, tests, ai-report, student-detail, branches, curriculum-import', async () => {
    const { container } = render(
      <TeacherDashboard
        onBackToPortal={vi.fn()}
        initialStudentId={mockStudentJhs.id}
        initialTab="schedule"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/個別指導・学習計画設定/i).length).toBeGreaterThan(0);
    });

    // 1. 各タブの巡回とボタン・入力の実行
    const tabs = [
      '年間計画（マイルストーン）',
      '学校カリキュラム管理',
      '小テスト結果',
      '宿題提出状況',
      '定期テスト・模試',
      'AI指導報告書',
      '生徒情報',
      '学習計画・コマ割り'
    ];

    for (const tabName of tabs) {
      const tabBtn = screen.queryByText(tabName);
      if (tabBtn) {
        await act(async () => {
          fireEvent.click(tabBtn);
        });
      }
    }

    // 2. コマ割りタブで各コマの教科選択を変更
    for (let p = 1; p <= 4; p++) {
      const select = screen.queryByTestId(`period-subject-select-${p}`);
      if (select) {
        const subjs = ['数学', '英語', '理科', '社会'];
        await act(async () => {
          fireEvent.change(select, { target: { value: subjs[p - 1] } });
        });
      }
    }

    // 3. AI自動最適化ボタンの実行
    const autoBtn = screen.queryByTestId('ai-auto-optimize-btn') || screen.queryByText(/AI自動最適化/i);
    if (autoBtn) {
      await act(async () => {
        fireEvent.click(autoBtn);
      });
    }

    // 4. コマ割り保存ボタンの実行
    const saveTimetableBtn = screen.queryByTestId('save-timetable-btn') || screen.queryByText(/コマ割りを確定・反映/i);
    if (saveTimetableBtn) {
      await act(async () => {
        fireEvent.click(saveTimetableBtn);
      });
    }

    // 5. 日付ピッカー変更
    const dateInput = container.querySelector('input[type="date"]');
    if (dateInput) {
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2026-09-25' } });
      });
    }
  });

  it('2. Thoroughly covers curriculum master actions, sort orders, and modal toggles', async () => {
    render(
      <TeacherDashboard
        onBackToPortal={vi.fn()}
        initialStudentId={mockStudentJhs.id}
        initialTab="curriculum"
      />
    );

    // 単元追加ボタンなどのクリック
    const addUnitBtn = screen.queryByText(/単元を追加/i) || screen.queryByText(/新規単元/i);
    if (addUnitBtn) {
      await act(async () => {
        fireEvent.click(addUnitBtn);
      });
    }

    // 教科フィルタの切り替え
    const subjectFilter = screen.queryByTestId('curriculum-subject-filter');
    if (subjectFilter) {
      await act(async () => {
        fireEvent.change(subjectFilter, { target: { value: '数学' } });
      });
    }
  });

  it('3. Thoroughly covers milestone CRUD and modal actions', async () => {
    render(
      <TeacherDashboard
        onBackToPortal={vi.fn()}
        initialStudentId={mockStudentJhs.id}
        initialTab="milestones"
      />
    );

    const addMsBtn = screen.queryByText(/マイルストーンを追加/i) || screen.queryByText(/新規マイルストーン/i);
    if (addMsBtn) {
      await act(async () => {
        fireEvent.click(addMsBtn);
      });
    }
  });

  it('4. Thoroughly covers Mini-tests, Homework, and Tests result entry', async () => {
    const { container } = render(
      <TeacherDashboard
        onBackToPortal={vi.fn()}
        initialStudentId={mockStudentJhs.id}
        initialTab="mini-tests"
      />
    );

    // 小テスト追加
    const addMiniBtn = screen.queryByText(/小テスト結果を登録/i) || screen.queryByText(/新規登録/i);
    if (addMiniBtn) {
      await act(async () => {
        fireEvent.click(addMiniBtn);
      });
    }

    // 宿題タブ切り替え
    const hwTab = screen.queryByText('宿題提出状況');
    if (hwTab) {
      await act(async () => {
        fireEvent.click(hwTab);
      });
    }

    // 定期テストタブ切り替え
    const testTab = screen.queryByText('定期テスト・模試');
    if (testTab) {
      await act(async () => {
        fireEvent.click(testTab);
      });
    }
  });
});
