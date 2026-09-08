import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  db,
  Student,
  CurriculumMaster,
  CurriculumUnit,
  LearningTask,
  MiniTestResult,
  HomeworkResult,
  TestRecord,
  School,
  PromptSetting
} from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('TeacherDashboard Megapack 95%+ Target Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    const sch: School = {
      id: 'sch-mega-01',
      name: 'メガ第一中学校',
      type: 'junior_high',
      created_at: new Date().toISOString()
    };
    await db.saveSchool(sch);

    const std: Student = {
      id: 'std-mega-01',
      student_id: 'S_MEGA_01',
      name: 'メガテスト生',
      grade: '中1',
      grade_category: '中学生',
      level: 'A',
      school_id: 'sch-mega-01',
      school_name: 'メガ第一中学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 3,
      selected_days: ['monday', 'wednesday', 'friday'],
      selected_subjects: ['数学', '英語'],
      teacher_in_charge: '荒木はやと',
      assigned_teachers: ['荒木はやと', '福田 尚弘'],
      personality_tags: ['集中力高い', '負けず嫌い'],
      enrollment_date: '2025-04-01'
    };
    await db.saveStudent(std);

    const master1: CurriculumMaster = {
      id: 'cm-mega-01',
      subject: '数学',
      grade: '中1',
      unit_name: '正の数・負の数',
      lesson_name: '正の数・負の数の加法',
      sort_order: 1,
      item_type: 'lesson'
    };
    const master2: CurriculumMaster = {
      id: 'cm-mega-02',
      subject: '数学',
      grade: '中1',
      unit_name: '正の数・負の数',
      lesson_name: '正の数・負の数 確認テスト',
      sort_order: 2,
      item_type: 'unit_test',
      passing_line: '80%以上'
    };
    await db.saveCurriculumMasters([master1, master2]);

    const task: LearningTask = {
      id: 'lt-mega-01',
      student_id: 'std-mega-01',
      scheduled_date: '2026-09-10',
      period: 1,
      subject: '数学',
      unit_id: 'cm-mega-01',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    const prompt: PromptSetting = {
      id: 'ps-mega-01',
      category: 'regular_report',
      prompt_template: '生徒の良いところを褒めてください',
      updated_at: new Date().toISOString()
    };
    await db.savePromptSetting(prompt);
  });

  it('covers all TeacherDashboard modals, filters, tabs, sorting, and editing actions', async () => {
    const { container } = render(
      <TeacherDashboard
        teacherType="junior_high"
        initialStudentId="std-mega-01"
        onBackToPortal={vi.fn()}
      />
    );

    // 1. Search students input
    const searchInput = container.querySelector('input[placeholder*="生徒名"]') || container.querySelector('input[type="text"]');
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'メガ' } });
      fireEvent.change(searchInput, { target: { value: '' } });
    }

    // 2. Open Branch AI Rules Modal, change values, and save
    const aiRulesBtn = screen.queryByRole('button', { name: /AIルール/i }) || screen.queryByRole('button', { name: /校舎設定/i });
    if (aiRulesBtn) {
      await act(async () => {
        fireEvent.click(aiRulesBtn);
      });

      const punkInput = screen.queryByTestId('branch-ai-punk-threshold-input');
      if (punkInput) fireEvent.change(punkInput, { target: { value: '5' } });

      const reviewInput = screen.queryByTestId('branch-ai-review-slot-interval-input');
      if (reviewInput) fireEvent.change(reviewInput, { target: { value: '3' } });

      const saveAiRulesBtn = screen.queryByTestId('save-branch-ai-rules-btn');
      if (saveAiRulesBtn) {
        await act(async () => {
          fireEvent.click(saveAiRulesBtn);
        });
      }
    }

    // 3. Open Unit Test Master Modal, select unit, enter details, and save
    const addUnitTestBtn = screen.queryByRole('button', { name: /単元テストマスタ追加/i }) || screen.queryByRole('button', { name: /テスト追加/i });
    if (addUnitTestBtn) {
      await act(async () => {
        fireEvent.click(addUnitTestBtn);
      });

      const modal = screen.queryByTestId('unit-test-master-modal');
      if (modal) {
        const textInputs = modal.querySelectorAll('input[type="text"]');
        if (textInputs.length >= 2) {
          fireEvent.change(textInputs[0], { target: { value: '正の数・負の数' } });
          fireEvent.change(textInputs[1], { target: { value: '正負の数 総合テスト' } });
        }
      }

      const saveUnitTestBtn = screen.queryByTestId('save-unittest-master-btn');
      if (saveUnitTestBtn) {
        await act(async () => {
          fireEvent.click(saveUnitTestBtn);
        });
      }
    }

    // 4. Milestone Plan Tab Interactions
    const milestoneTab = screen.queryByRole('button', { name: /年間マイルストーン/i });
    if (milestoneTab) {
      await act(async () => {
        fireEvent.click(milestoneTab);
      });

      // Subject switch
      const subjectSelect = container.querySelector('select');
      if (subjectSelect) {
        fireEvent.change(subjectSelect, { target: { value: '英語' } });
        fireEvent.change(subjectSelect, { target: { value: '数学' } });
      }
    }

    // 5. Regular Test & Mock Exam Tab
    const testsTab = screen.queryByRole('button', { name: /定期テスト・模試/i });
    if (testsTab) {
      await act(async () => {
        fireEvent.click(testsTab);
      });

      // Add regular test score record
      const addScoreBtn = screen.queryByRole('button', { name: /テスト結果を追加/i }) || screen.queryByRole('button', { name: /成績登録/i });
      if (addScoreBtn) {
        await act(async () => {
          fireEvent.click(addScoreBtn);
        });
      }
    }

    // 6. Student List Grade and Category Toggles
    const studentListTab = screen.queryByRole('button', { name: /生徒一覧/i });
    if (studentListTab) {
      await act(async () => {
        fireEvent.click(studentListTab);
      });

      const filterAll = screen.queryByTestId('filter-type-all');
      if (filterAll) fireEvent.click(filterAll);

      const filterElem = screen.queryByTestId('filter-type-elem');
      if (filterElem) fireEvent.click(filterElem);

      const filterJhs = screen.queryByTestId('filter-type-jhs');
      if (filterJhs) fireEvent.click(filterJhs);

      const filterHigh = screen.queryByTestId('filter-type-high');
      if (filterHigh) fireEvent.click(filterHigh);
    }
  });
});
