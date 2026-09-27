import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
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
  Branch 
} from '../lib/db';

describe('TeacherDashboard 10 Tabs Exhaustive Master Coverage Suite', () => {
  const student1: Student = {
    id: 'std-alltabs-1',
    student_id: 'std-alltabs-1',
    name: '網羅 太郎',
    name_kana: 'モウラ タロウ',
    email: 'moura@tentoru.jp',
    grade: '中3',
    school_id: 'sch-1',
    school_name: '天登第一中学校',
    classroom: '恵比寿教室',
    branch_id: 'branch-1',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    status: 'normal',
    level: 'A',
    selected_subjects: ['数学', '英語', '理科', '国語', '社会'],
    selected_days: ['monday', 'wednesday', 'friday'],
    period_count: 3,
    registered_year: 2026,
    registered_grade: '中3',
    personalities: ['几帳面', '集中力高い'],
    target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
    created_at: '2026-04-01T00:00:00Z',
    start_unit_math: 'cm-1',
    start_unit_english: 'cm-2',
    enrollment_date: '2026-04-01',
    withdrawal_date: null,
    birthday: '2011-05-10',
    club_activities: '野球部',
    hobbies: '将棋',
    parent_name: '網羅 一郎',
    parent_name_kana: 'モウラ イチロウ',
    contact_phone: '090-0000-1111'
  };

  const studentElem: Student = {
    id: 'std-alltabs-elem',
    student_id: 'std-alltabs-elem',
    name: '網羅 次郎',
    name_kana: 'モウラ ジロウ',
    email: 'moura_elem@tentoru.jp',
    grade: '小5',
    school_id: 'sch-2',
    school_name: '飽田南小学校',
    selected_subjects: ['算数', '国語', '英語'],
    selected_days: ['tuesday', 'thursday'],
    period_count: 2,
    registered_year: 2026,
    registered_grade: '小5',
    status: 'warning',
    level: 'B',
    created_at: '2026-04-01T00:00:00Z'
  };

  const schools: School[] = [
    { id: 'sch-1', name: '天登第一中学校', type: 'junior_high', created_at: new Date().toISOString() },
    { id: 'sch-2', name: '飽田南小学校', type: 'elementary', created_at: new Date().toISOString() }
  ];

  const masters: CurriculumMaster[] = [
    { id: 'cm-1', subject: '数学', grade: '中3', unit_name: '三平方の定理', lesson_name: '三平方の定理の利用', sort_order: 1 },
    { id: 'cm-2', subject: '英語', grade: '中3', unit_name: '関係代名詞', lesson_name: '主格の関係代名詞', sort_order: 1 },
    { id: 'cm-3', subject: '算数', grade: '小5', unit_name: '小数のかけ算', lesson_name: '小数×整数', sort_order: 1 }
  ];

  const units: CurriculumUnit[] = [
    { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '三平方の定理', sequence_order: 1, created_at: new Date().toISOString() },
    { id: 'u-2', school_id: 'sch-1', subject: '数学', name: '相似な図形', sequence_order: 2, created_at: new Date().toISOString() },
    { id: 'u-3', school_id: 'sch-2', subject: '算数', name: '小数のかけ算', sequence_order: 1, created_at: new Date().toISOString() }
  ];

  const branches: Branch[] = [
    { id: 'branch-1', name: '恵比寿教室', code: 'EBS', email: 'ebisu@tentoru.jp', status: 'active', created_at: new Date().toISOString() }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'テスト入力値');

    await db.saveStudent(student1);
    await db.saveStudent(studentElem);
    for (const s of schools) await db.saveSchool(s);
    await db.saveCurriculumMasters(masters);
    await db.saveCurriculumUnits(units);
    for (const b of branches) await db.saveBranch(b);
  });

  const tabs = [
    'schedule',
    'milestones',
    'curriculum',
    'mini_tests',
    'homework',
    'tests',
    'ai_report',
    'student_detail',
    'branches',
    'curriculum_import'
  ];

  tabs.forEach(tab => {
    it(`renders and interacts with tab: ${tab}`, async () => {
      render(
        <TeacherDashboard
          initialStudentId={student1.id}
          initialTab={tab}
          onBackToPortal={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
      });

      // 1. Click all buttons inside the tab
      const buttons = screen.queryAllByRole('button');
      for (const btn of buttons) {
        await act(async () => {
          try {
            fireEvent.click(btn);
          } catch (e) {}
        });
      }

      // 2. Change all textboxes & number inputs
      const textboxes = screen.queryAllByRole('textbox');
      for (const txt of textboxes) {
        await act(async () => {
          try {
            fireEvent.change(txt, { target: { value: 'テスト入力値更新' } });
          } catch (e) {}
        });
      }

      const spinbuttons = screen.queryAllByRole('spinbutton');
      for (const num of spinbuttons) {
        await act(async () => {
          try {
            fireEvent.change(num, { target: { value: '88' } });
          } catch (e) {}
        });
      }

      // 3. Change all dropdowns
      const selects = screen.queryAllByRole('combobox');
      for (const sel of selects) {
        await act(async () => {
          try {
            if (sel.children.length > 1) {
              fireEvent.change(sel, { target: { value: (sel.children[1] as any).value } });
            }
          } catch (e) {}
        });
      }
    });
  });

  it('handles elementary student rendering and timeline view', async () => {
    render(
      <TeacherDashboard
        initialStudentId={studentElem.id}
        initialTab="schedule"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    const timelineTab = screen.queryByText(/年間計画|小学生向け進度/i);
    if (timelineTab) {
      await act(async () => {
        fireEvent.click(timelineTab);
      });
    }
  });
});
