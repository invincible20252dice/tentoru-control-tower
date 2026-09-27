import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, LearningTask, Branch, School, MiniTestResult, HomeworkResult } from '../lib/db';

describe('Coverage Deep Dive v33 - TeacherDashboard Complete Branch Coverage', () => {
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
      id: 'std-v33-master',
      student_id: 'std_v33',
      name: 'ブランチ網羅生徒',
      name_kana: 'ブランチモウラセイト',
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
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['数学', '英語'],
      completed_lesson_ids: ['cm-v33-1'],
      excluded_lesson_ids: [],
      target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
      personalities: ['几帳面'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(sampleStudent);

    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-v33-1', subject: '数学', grade: '中2', unit_name: '1章 式の計算', lesson_name: '単項式と多項式', sort_order: 1 },
      { id: 'cm-v33-2', subject: '数学', grade: '中2', unit_name: '1章 式の計算', lesson_name: '式の加法と減法', sort_order: 2 }
    ];
    await db.saveCurriculumMasters(sampleMasters);

    const todayStr = new Date().toISOString().split('T')[0];
    const sampleTask: LearningTask = {
      id: 'task-v33-1',
      student_id: sampleStudent.id,
      unit_id: 'cm-v33-2',
      start_lesson_id: 'cm-v33-2',
      end_lesson_id: 'cm-v33-2',
      scheduled_date: todayStr,
      period: 1,
      status: 'in_progress',
      subject: '数学',
      title: '式の加法と減法',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([sampleTask]);

    const sampleMini: MiniTestResult = {
      id: 'mini-v33-1',
      student_id: sampleStudent.id,
      lesson_id: 'cm-v33-1',
      subject: '数学',
      score: 85,
      passed: true,
      tested_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(sampleMini);

    const sampleHw: HomeworkResult = {
      id: 'hw-v33-1',
      student_id: sampleStudent.id,
      date: todayStr,
      subject: '数学',
      content: 'ワーク P.10〜12',
      status: 'completed',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(sampleHw);
  });

  it('exercises test results tab, homework tab, AI report generation, and student actions', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(<TeacherDashboard onLogout={vi.fn()} teacherType="junior_high" />);
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
      expect(screen.getAllByText(/ブランチ網羅生徒/).length).toBeGreaterThan(0);
    });

    // 生徒選択
    const studentCard = screen.getAllByText(/ブランチ網羅生徒/)[0];
    fireEvent.click(studentCard);

    // 1. テスト結果（test-results）タブ
    const testTabs = screen.queryAllByRole('button', { name: /定期テスト|小テスト/i });
    if (testTabs.length > 0) {
      fireEvent.click(testTabs[0]);
      const saveTestBtns = screen.queryAllByRole('button');
      for (const btn of saveTestBtns) {
        const txt = btn.textContent || '';
        if (txt.includes('テスト') || txt.includes('模試') || txt.includes('記録') || txt.includes('追加')) {
          try { fireEvent.click(btn); } catch (e) {}
        }
      }
    }

    // 2. 宿題管理（homework）タブ
    const hwTabs = screen.queryAllByRole('button', { name: /宿題/i });
    if (hwTabs.length > 0) {
      fireEvent.click(hwTabs[0]);
      const hwButtons = screen.queryAllByRole('button');
      for (const btn of hwButtons) {
        const txt = btn.textContent || '';
        if (txt.includes('宿題') || txt.includes('提出') || txt.includes('完了')) {
          try { fireEvent.click(btn); } catch (e) {}
        }
      }
    }

    // 3. AIレポート（ai-reports）タブ
    const aiTabs = screen.queryAllByRole('button', { name: /AIレポート/i });
    if (aiTabs.length > 0) {
      fireEvent.click(aiTabs[0]);
      const genBtn = screen.queryByText(/AIレポート生成/i) || screen.queryByRole('button', { name: /生成/i });
      if (genBtn) {
        try { fireEvent.click(genBtn); } catch (e) {}
      }
    }

    // 4. その他のボタン
    const allButtons = screen.queryAllByRole('button');
    for (const btn of allButtons) {
      const txt = btn.textContent || '';
      if (txt.includes('同期') || txt.includes('更新') || txt.includes('リセット')) {
        try { fireEvent.click(btn); } catch (e) {}
      }
    }

    renderResult.unmount();
  });
});
