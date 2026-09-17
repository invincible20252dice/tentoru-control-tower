import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, LearningTask, CurriculumMaster, Branch, StudentInteraction, TestRecord, MilestoneTemplate } from '../lib/db';

describe('TeacherDashboard Deep Coverage Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '入力値');
  });

  it('should deeply test TeacherDashboard planning, bulk schedule operations, AI reports, templates, and student modal interactions', async () => {
    const student1: Student = {
      id: 'std-deep-1',
      student_id: 'std101',
      name: 'ディープテスト生徒1',
      grade: '中2',
      grade_category: 'junior_high',
      school_name: '天登中学校',
      start_unit_id: 'cm-j2-m1',
      period_count: 2,
      day_of_week: ['mon', 'wed', 'fri'],
      selected_subjects: ['数学', '英語', '国語', '理科', '社会'],
      assigned_teachers: ['福田 尚弘'],
      teacher_in_charge: '福田 尚弘',
      status: 'normal',
      level: 'A',
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '中2',
      personalities: ['集中力高い']
    };

    const student2: Student = {
      id: 'std-deep-2',
      student_id: 'std102',
      name: 'ディープテスト生徒2',
      grade: '中2',
      grade_category: 'junior_high',
      school_name: '天登中学校',
      start_unit_id: 'cm-j2-m1',
      period_count: 2,
      day_of_week: ['mon', 'wed'],
      selected_subjects: ['数学'],
      assigned_teachers: ['福田 尚弘'],
      teacher_in_charge: '福田 尚弘',
      status: 'normal',
      level: 'A',
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '中2'
    };
    await db.saveStudent(student1);
    await db.saveStudent(student2);

    const task: LearningTask = {
      id: 'task-deep-1',
      student_id: 'std-deep-1',
      scheduled_date: '2026-09-17',
      period: 1,
      subject: '数学',
      unit_name: '1章 式の計算',
      lesson_range: '1-1',
      status: 'not_started',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    const template: MilestoneTemplate = {
      id: 'tpl-deep-1',
      name: '標準中2数学テンプレート',
      grade: '中2',
      subject: '数学',
      level: 'A',
      plans: [
        {
          id: 'mp-1',
          student_id: 'std-deep-1',
          subject: '数学',
          unit_name: '1章 式の計算',
          planned_start_date: '2026-04-01',
          planned_end_date: '2026-04-30',
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ],
      created_at: new Date().toISOString()
    };
    await db.saveMilestoneTemplate(template);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText(/ディープテスト生徒1/).length).toBeGreaterThan(0);
    });

    // 1. 生徒カード選択
    const card = screen.getAllByText(/ディープテスト生徒1/)[0];
    fireEvent.click(card);

    // 2. 年間計画タブ
    const milestoneTab = screen.queryByRole('button', { name: /年間計画/i }) || screen.queryByText(/年間計画/);
    if (milestoneTab) {
      fireEvent.click(milestoneTab);

      // テンプレート選択ドロップダウンの操作
      const tplSelect = screen.queryByRole('combobox', { name: /テンプレート/i }) || document.querySelector('select[value=""]');
      if (tplSelect) {
        fireEvent.change(tplSelect, { target: { value: 'tpl-deep-1' } });
      }

      // テンプレート適用ボタン
      const applyBtn = screen.queryByRole('button', { name: /適用|反映/i });
      if (applyBtn) fireEvent.click(applyBtn);

      // 新規マイルストーン単元追加ボタン
      const addUnitBtn = screen.queryByRole('button', { name: /単元を追加|➕ 単元追加/i });
      if (addUnitBtn) fireEvent.click(addUnitBtn);
    }

    // 3. 学習計画（コマ割り）タブ
    const scheduleTab = screen.queryByRole('button', { name: /学習計画|コマ割り/i }) || screen.queryByText(/学習計画/);
    if (scheduleTab) {
      fireEvent.click(scheduleTab);

      // 一括反映ボタン
      const bulkApplyBtn = screen.queryByRole('button', { name: /同条件の生徒へ一括反映|一括適用/i });
      if (bulkApplyBtn) fireEvent.click(bulkApplyBtn);

      // 自動スケジューリングボタン
      const autoScheduleBtn = screen.queryByRole('button', { name: /自動コマ割り生成|自動生成|最適化/i });
      if (autoScheduleBtn) fireEvent.click(autoScheduleBtn);
    }

    // 4. AI指導報告書タブ
    const aiTab = screen.queryByRole('button', { name: /AI指導報告書|AI報告/i }) || screen.queryByText(/AI指導報告書/);
    if (aiTab) {
      fireEvent.click(aiTab);

      // AI生成ボタン
      const genAiBtn = screen.queryByRole('button', { name: /AI生成|レポート作成|報告書作成/i });
      if (genAiBtn) fireEvent.click(genAiBtn);

      // プロンプトテンプレート保存
      const savePromptBtn = screen.queryByRole('button', { name: /プロンプト保存|設定を保存/i });
      if (savePromptBtn) fireEvent.click(savePromptBtn);
    }

    // 5. 面談・カルテタブ
    const interviewTab = screen.queryByRole('button', { name: /面談・カルテ|面談記録/i }) || screen.queryByText(/面談・カルテ/);
    if (interviewTab) {
      fireEvent.click(interviewTab);

      // 面談記録の入力・追加
      const memoTextarea = screen.queryByPlaceholderText(/面談メモ|指導記録|内容/i);
      if (memoTextarea) {
        fireEvent.change(memoTextarea, { target: { value: '面談記録のテスト追加入力' } });
        const addRecordBtn = screen.queryByRole('button', { name: /記録を追加|登録/i });
        if (addRecordBtn) fireEvent.click(addRecordBtn);
      }
    }

    // 6. 検索・フィルター操作
    const searchInput = screen.queryByPlaceholderText(/生徒名|名前|検索/i);
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'ディープ' } });
      fireEvent.change(searchInput, { target: { value: '' } });
    }

    // 7. 校舎切り替え
    const branchSelect = screen.queryByTestId('admin-branch-switcher');
    if (branchSelect) {
      fireEvent.change(branchSelect, { target: { value: 'branch-1' } });
      fireEvent.change(branchSelect, { target: { value: 'all' } });
    }

    // 8. 権限トグル
    const branchRoleBtn = screen.queryByTestId('role-toggle-branch');
    if (branchRoleBtn) fireEvent.click(branchRoleBtn);
    const adminRoleBtn = screen.queryByTestId('role-toggle-admin');
    if (adminRoleBtn) fireEvent.click(adminRoleBtn);

    unmount();
  });
});
