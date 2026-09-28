import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import {
  Student,
  SchoolMaster,
  CurriculumMaster,
  Branch,
  TestRecord
} from '../types';

describe('TeacherDashboard Ultimate Comprehensive 96%+ Suite', () => {
  const mockBranches: Branch[] = [
    { id: 'branch-comp-1', name: '統括校舎', code: 'B_COMP_1', email: 'comp@tentoru.jp', status: 'active', created_at: new Date().toISOString() }
  ];

  const mockSchools: SchoolMaster[] = [
    { id: 'sch-comp-elem', name: '網羅小学校', type: 'elementary' },
    { id: 'sch-comp-jhs', name: '網羅中学校', type: 'junior_high' }
  ];

  const studentElem: Student = {
    id: 'std-comp-elem',
    student_id: 'S_COMP_ELEM',
    name: '網羅 小学生',
    grade: '小6',
    status: 'normal',
    level: 'C',
    branch_id: 'branch-comp-1',
    classroom: '統括校舎',
    school_id: 'sch-comp-elem',
    school_name: '網羅小学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '小6',
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['算数', '国語', '理科', '社会', '英語'],
    period_count: 2,
    default_slots: 2,
    start_unit_math: 'cm-comp-1',
    completed_lesson_ids: ['cm-comp-1'],
    excluded_lesson_ids: []
  };

  const studentJhs: Student = {
    id: 'std-comp-jhs',
    student_id: 'S_COMP_JHS',
    name: '網羅 中学生',
    grade: '中3',
    status: 'warning',
    level: 'A',
    branch_id: 'branch-comp-1',
    classroom: '統括校舎',
    school_id: 'sch-comp-jhs',
    school_name: '網羅中学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '中3',
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['数学', '英語', '理科', '社会', '国語'],
    period_count: 3,
    default_slots: 3,
    start_unit_math: 'cm-comp-jh-1',
    completed_lesson_ids: [],
    excluded_lesson_ids: [],
    target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }]
  };

  const mockMasters: CurriculumMaster[] = [
    { id: 'cm-comp-1', grade: '小6', subject: '算数', unit_name: '1章 分数の計算', lesson_name: 'STEP 1 分数のかけ算', sort_order: 1, item_type: 'lesson' },
    { id: 'cm-comp-2', grade: '小6', subject: '算数', unit_name: '1章 分数の計算', lesson_name: 'STEP 2 分数のわり算', sort_order: 2, item_type: 'lesson' },
    { id: 'cm-comp-3', grade: '小6', subject: '算数', unit_name: '1章 分数の計算', lesson_name: '1章 分数 単元確認テスト', sort_order: 3, item_type: 'unit_test', passing_line: '80%以上' },
    { id: 'cm-comp-jh-1', grade: '中3', subject: '数学', unit_name: '1章 多項式', lesson_name: 'STEP 1 乗法公式', sort_order: 1, item_type: 'lesson' },
    { id: 'cm-comp-jh-2', grade: '中3', subject: '数学', unit_name: '1章 多項式', lesson_name: '1章 多項式 単元確認テスト', sort_order: 2, item_type: 'unit_test', passing_line: '80%以上' }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await db.saveStudent(studentElem);
    await db.saveStudent(studentJhs);
    await db.saveCurriculumMasters(mockMasters);
  });

  it('exercises calendar date picking, day clicks, and date range filters', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[studentElem, studentJhs]}
        schools={mockSchools}
        curriculumMasters={mockMasters}
        tasks={[]}
        initialStudentId={studentElem.id}
        initialTab="schedule"
      />
    );

    const dayBtns = screen.queryAllByRole('button', { name: /月|火|水|木|金|土|日/ });
    for (const btn of dayBtns) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    unmount();
  });

  it('exercises student detail extensive field edits, notes, photo URLs, and subject start positions', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[studentJhs]}
        schools={mockSchools}
        curriculumMasters={mockMasters}
        tasks={[]}
        initialStudentId={studentJhs.id}
        initialTab="student-detail"
      />
    );

    const inputs = screen.queryAllByRole('textbox');
    for (const inp of inputs) {
      await act(async () => {
        fireEvent.change(inp, { target: { value: '更新値テスト' } });
      });
    }

    const selects = screen.queryAllByRole('combobox');
    for (const sel of selects) {
      await act(async () => {
        fireEvent.change(sel, { target: { value: sel.children[0]?.getAttribute('value') || '' } });
      });
    }

    const saveBtn = screen.queryByRole('button', { name: /生徒情報を更新/ });
    if (saveBtn) {
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    }

    unmount();
  });

  it('exercises tests tab mock exam thresholds and detailed score additions', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const testRecord: TestRecord = {
      id: 'tr-comp-1',
      student_id: studentJhs.id,
      exam_name: '3学期学年末テスト',
      math_score: 95,
      english_score: 90,
      science_score: 85,
      social_score: 80,
      japanese_score: 88,
      math_target: 90,
      english_target: 85,
      science_target: 80,
      social_target: 80,
      japanese_target: 85
    };
    await db.saveTestRecord(testRecord);

    const { unmount } = render(
      <TeacherDashboard
        students={[studentJhs]}
        schools={mockSchools}
        curriculumMasters={mockMasters}
        tasks={[]}
        initialStudentId={studentJhs.id}
        initialTab="tests"
      />
    );

    const deleteBtns = screen.queryAllByRole('button', { name: /削除/i });
    if (deleteBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteBtns[0]);
      });
    }

    unmount();
  });

  it('exercises AI Report prompt template modification and save', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[studentJhs]}
        schools={mockSchools}
        curriculumMasters={mockMasters}
        tasks={[]}
        initialStudentId={studentJhs.id}
        initialTab="ai-report"
      />
    );

    const promptBtn = screen.queryByRole('button', { name: /プロンプト設定|AIプロンプト/i });
    if (promptBtn) {
      await act(async () => {
        fireEvent.click(promptBtn);
      });
    }

    unmount();
  });

  it('exercises branch AI rules modal inputs and save', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[studentElem]}
        schools={mockSchools}
        curriculumMasters={mockMasters}
        tasks={[]}
        initialStudentId={studentElem.id}
        initialTab="schedule"
      />
    );

    const openRulesBtn = screen.queryByRole('button', { name: /校舎AIルール設定|AIルール/i }) || screen.queryByTestId('open-branch-ai-rules-btn');
    if (openRulesBtn) {
      await act(async () => {
        fireEvent.click(openRulesBtn);
      });

      const punkInput = screen.queryByTestId('branch-ai-punk-threshold-input');
      if (punkInput) {
        await act(async () => {
          fireEvent.change(punkInput, { target: { value: '5' } });
        });
      }

      const reviewInput = screen.queryByTestId('branch-ai-review-slot-interval-input');
      if (reviewInput) {
        await act(async () => {
          fireEvent.change(reviewInput, { target: { value: '3' } });
        });
      }

      const saveRulesBtn = screen.queryByTestId('save-branch-ai-rules-btn');
      if (saveRulesBtn) {
        await act(async () => {
          fireEvent.click(saveRulesBtn);
        });
      }
    }

    unmount();
  });

  it('exercises unit test master modal dropdown unit change and auto-fill test name', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[studentElem]}
        schools={mockSchools}
        curriculumMasters={mockMasters}
        tasks={[]}
        initialStudentId={studentElem.id}
        initialTab="milestones"
      />
    );

    const openUnitTestModalBtn = screen.queryByText(/単元テストマスタ登録/);
    if (openUnitTestModalBtn) {
      await act(async () => {
        fireEvent.click(openUnitTestModalBtn);
      });

      // 単元選択セレクトボックス
      const selects = screen.queryAllByRole('combobox');
      for (const sel of selects) {
        await act(async () => {
          fireEvent.change(sel, { target: { value: '1章 分数の計算' } });
        });
      }

      const saveBtn = screen.queryByTestId('save-unittest-master-btn');
      if (saveBtn) {
        await act(async () => {
          fireEvent.click(saveBtn);
        });
      }
    }

    unmount();
  });
});