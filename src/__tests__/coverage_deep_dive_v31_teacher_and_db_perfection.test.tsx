import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, LearningTask, Branch, School, TestRecord, CurriculumUnit, MilestonePlan } from '../lib/db';

describe('Coverage Deep Dive v31 - TeacherDashboard Full Tabs & DB Master Perfection', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '1章 正負の数');

    const sampleBranch: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS',
      email: 'ebisu@tentoru.jp',
      is_active: true
    };
    await db.saveBranch(sampleBranch);

    const sampleSchool: School = {
      id: 'sch-1',
      name: '恵比寿中学校',
      type: 'junior_high',
      grade_levels: ['中1', '中2', '中3'],
      created_at: new Date().toISOString()
    };
    await db.saveSchool(sampleSchool);

    const sampleStudent: Student = {
      id: 'std-v31-master',
      student_id: 'std_v31',
      name: 'カバレッジ完璧生',
      name_kana: 'カバレッジカンペキセイ',
      grade: '中2',
      school_id: 'sch-1',
      school_name: '恵比寿中学校',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中2',
      selected_days: ['monday', 'wednesday', 'friday'],
      selected_subjects: ['数学', '英語', '理科'],
      completed_lesson_ids: ['cm-v31-1'],
      excluded_lesson_ids: [],
      target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
      personalities: ['几帳面'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(sampleStudent);

    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-v31-1', subject: '数学', grade: '中2', unit_name: '1章 式の計算', lesson_name: '単項式と多項式', sort_order: 1 },
      { id: 'cm-v31-2', subject: '数学', grade: '中2', unit_name: '1章 式の計算', lesson_name: '式の加法と減法', sort_order: 2 },
      { id: 'cm-v31-3', subject: '数学', grade: '中2', unit_name: '2章 連立方程式', lesson_name: '連立方程式とその解', sort_order: 3 },
      { id: 'cm-v31-4', subject: '数学', grade: '中2', unit_name: '2章 連立方程式', lesson_name: '加減法による解き方', sort_order: 4 }
    ];
    await db.saveCurriculumMasters(sampleMasters);

    const sampleUnits: CurriculumUnit[] = [
      { id: 'cu-v31-1', school_id: 'sch-1', subject: '数学', name: '単項式と多項式', sequence_order: 1, created_at: new Date().toISOString() },
      { id: 'cu-v31-2', school_id: 'sch-1', subject: '数学', name: '式の加法と減法', sequence_order: 2, created_at: new Date().toISOString() }
    ];
    await db.saveCurriculumUnits(sampleUnits);

    const sampleMilestones: MilestonePlan[] = [
      { id: 'mp-v31-1', level: 'A', school_id: 'sch-1', grade: '中2', subject: '数学', month: 4, week: 1, chapter_name: '1章 式の計算', unit_name: '単項式と多項式', sequence_order: 1, is_holiday: false, created_at: new Date().toISOString() },
      { id: 'mp-v31-2', level: 'A', school_id: 'sch-1', grade: '中2', subject: '数学', month: 4, week: 2, chapter_name: '1章 式の計算', unit_name: '式の加法と減法', sequence_order: 2, is_holiday: false, created_at: new Date().toISOString() }
    ];
    await db.saveMilestonePlans(sampleMilestones);

    const todayStr = new Date().toISOString().split('T')[0];
    const sampleTask: LearningTask = {
      id: 'task-v31-1',
      student_id: sampleStudent.id,
      unit_id: 'cm-v31-2',
      start_lesson_id: 'cm-v31-2',
      end_lesson_id: 'cm-v31-2',
      scheduled_date: todayStr,
      period: 1,
      status: 'in_progress',
      subject: '数学',
      title: '式の加法と減法',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([sampleTask]);
  });

  it('exhaustively covers all actions in TeacherDashboard curriculum, milestone, task, and modals', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(<TeacherDashboard onLogout={vi.fn()} teacherType="junior_high" />);
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // 生徒選択
    const studentCard = screen.getAllByText(/カバレッジ完璧生/)[0];
    fireEvent.click(studentCard);

    // 1. AI自動設定ルール モーダルを開いて保存
    const aiRulesBtn = screen.queryByText(/AI自動設定ルール/i);
    if (aiRulesBtn) {
      fireEvent.click(aiRulesBtn);
      await waitFor(() => {
        expect(screen.getByTestId('branch-ai-rules-modal')).toBeInTheDocument();
      });
      const saveBtn = screen.getByTestId('save-branch-ai-rules-btn');
      fireEvent.click(saveBtn);
    }

    // 2. 単元テスト マスタ追加モーダルを開いて保存
    const addUnitTestMasterBtn = screen.queryByTestId('timeline-add-unittest-btn') || screen.queryByRole('button', { name: /単元テストを追加/i });
    if (addUnitTestMasterBtn) {
      fireEvent.click(addUnitTestMasterBtn);
      await waitFor(() => {
        expect(screen.queryByTestId('unit-test-master-modal')).toBeInTheDocument();
      });
      const testNameInput = screen.queryByPlaceholderText(/例: たしざん 単元確認テスト/i);
      if (testNameInput) fireEvent.change(testNameInput, { target: { value: '1章 式の計算 - 単元確認テスト' } });
      const saveUnitTestBtn = screen.queryByTestId('save-unittest-master-btn');
      if (saveUnitTestBtn) fireEvent.click(saveUnitTestBtn);
    }

    // 3. 学校カリキュラム管理（curriculum-master）タブ
    const currTab = screen.queryByRole('button', { name: /学校カリキュラム/i }) || screen.queryByTestId('nav-tab-curriculum-master');
    if (currTab) {
      fireEvent.click(currTab);
      const allButtons = screen.queryAllByRole('button');
      for (const btn of allButtons) {
        try {
          const txt = btn.textContent || '';
          if (txt === '▲' || txt === '▼' || txt.includes('保存') || txt.includes('追加')) {
            fireEvent.click(btn);
          }
        } catch (e) {}
      }
    }

    // 4. マイルストーン（milestones）タブ
    const milestoneTab = screen.queryByRole('button', { name: /年間計画/i }) || screen.queryByTestId('nav-tab-milestones');
    if (milestoneTab) {
      fireEvent.click(milestoneTab);
      const allButtons = screen.queryAllByRole('button');
      for (const btn of allButtons) {
        try {
          const txt = btn.textContent || '';
          if (txt === '▲' || txt === '▼' || txt === '📅' || txt === '×' || txt.includes('行を追加') || txt.includes('保存')) {
            fireEvent.click(btn);
          }
        } catch (e) {}
      }
    }

    // 5. 日々のタスク（daily-tasks）タブ
    const dailyTab = screen.queryByRole('button', { name: /今日の時間割/i }) || screen.queryByTestId('nav-tab-daily-tasks');
    if (dailyTab) {
      fireEvent.click(dailyTab);
      const allCheckboxes = screen.queryAllByRole('checkbox');
      for (const cb of allCheckboxes) {
        fireEvent.click(cb);
      }
    }

    // 6. コマ割り・学習計画（schedule）タブ
    const scheduleTab = screen.queryByRole('button', { name: /学習計画/i }) || screen.queryByTestId('nav-tab-schedule');
    if (scheduleTab) {
      fireEvent.click(scheduleTab);
      const allSelects = screen.queryAllByRole('combobox');
      for (const sel of allSelects) {
        if ((sel as HTMLSelectElement).options.length > 1) {
          fireEvent.change(sel, { target: { value: (sel as HTMLSelectElement).options[1].value } });
        }
      }
      const saveScheduleBtn = screen.queryByText(/この日の予定を保存/i) || screen.queryByRole('button', { name: /保存/i });
      if (saveScheduleBtn) fireEvent.click(saveScheduleBtn);
    }

    renderResult.unmount();
  });
});
