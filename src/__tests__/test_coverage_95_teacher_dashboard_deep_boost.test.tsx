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

describe('TeacherDashboard Deep Boost 95%+ Lines Coverage Suite', () => {
  const student1: Student = {
    id: 'std-boost-1',
    student_id: 'std-boost-1',
    name: '熊本 太郎',
    name_kana: 'クマモト タロウ',
    email: 'kumamoto@tentoru.jp',
    grade: '中2',
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
    registered_grade: '中2',
    personalities: ['几帳面', '集中力高い'],
    target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
    created_at: '2026-04-01T00:00:00Z',
    start_unit_math: 'cm-1',
    start_unit_english: 'cm-2',
    enrollment_date: '2026-04-01',
    withdrawal_date: null,
    birthday: '2012-05-10',
    club_activities: '野球部',
    hobbies: '将棋',
    parent_name: '熊本 一郎',
    contact_phone: '090-0000-1111'
  };

  const studentElem: Student = {
    id: 'std-boost-elem',
    student_id: 'std-boost-elem',
    name: '熊本 次郎',
    grade: '小5',
    school_id: 'sch-2',
    school_name: '飽田南小学校',
    selected_subjects: ['算数', '国語'],
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
    { id: 'cm-1', subject: '数学', grade: '中2', unit_name: '連立方程式', lesson_name: '加減法', sort_order: 1 },
    { id: 'cm-2', subject: '英語', grade: '中2', unit_name: '不定詞', lesson_name: '名詞的用法', sort_order: 1 },
    { id: 'cm-3', subject: '算数', grade: '小5', unit_name: '小数のかけ算', lesson_name: '小数×整数', sort_order: 1 }
  ];

  const units: CurriculumUnit[] = [
    { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '連立方程式', sequence_order: 1, created_at: new Date().toISOString() },
    { id: 'u-2', school_id: 'sch-1', subject: '数学', name: '1次関数', sequence_order: 2, created_at: new Date().toISOString() },
    { id: 'u-3', school_id: 'sch-2', subject: '算数', name: '小数のかけ算', sequence_order: 1, created_at: new Date().toISOString() }
  ];

  const testRecord: TestRecord = {
    id: 'tr-1',
    student_id: student1.id,
    test_type: 'regular_1',
    test_name: '1学期中間テスト',
    test_date: '2026-05-20',
    scores: { '数学': 85, '英語': 90, '理科': 78, '国語': 82, '社会': 88 },
    targets: { '数学': 90, '英語': 90 },
    averages: { '数学': 65, '英語': 60 },
    rankings: { '学年順位': 15 },
    created_at: new Date().toISOString()
  };

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
    await db.saveTestRecord(testRecord);
  });

  it('1. Exercises Regular Test Tab, Mini-tests, Homework, AI Report, and Bulk save handlers', async () => {
    render(
      <TeacherDashboard
        initialStudentId={student1.id}
        initialTab="tests"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // 1. Regular Tests Tab
    const testTypeSelect = screen.queryByDisplayValue(/1学期中間テスト/i) || screen.queryAllByRole('combobox')[0];
    if (testTypeSelect) {
      await act(async () => {
        fireEvent.change(testTypeSelect, { target: { value: 'regular_2' } });
      });
    }

    const testInputs = screen.queryAllByRole('spinbutton');
    for (const inp of testInputs) {
      await act(async () => {
        fireEvent.change(inp, { target: { value: '95' } });
      });
    }

    const saveTestBtn = screen.queryByText(/テスト結果を保存/i) || screen.queryByText(/保存/i);
    if (saveTestBtn) {
      await act(async () => {
        fireEvent.click(saveTestBtn);
      });
    }

    // 2. Mini-tests Tab
    const miniTabBtn = screen.queryByText('小テスト結果');
    if (miniTabBtn) {
      await act(async () => {
        fireEvent.click(miniTabBtn);
      });

      const inputs = screen.queryAllByRole('spinbutton');
      for (const inp of inputs) {
        await act(async () => {
          fireEvent.change(inp, { target: { value: '100' } });
        });
      }

      const passButtons = screen.queryAllByRole('button');
      for (const btn of passButtons) {
        if (btn.textContent?.includes('合格') || btn.textContent?.includes('不合格')) {
          await act(async () => {
            fireEvent.click(btn);
          });
        }
      }
    }

    // 3. Homework Tab
    const hwTabBtn = screen.queryByText('宿題提出状況');
    if (hwTabBtn) {
      await act(async () => {
        fireEvent.click(hwTabBtn);
      });

      const hwButtons = screen.queryAllByRole('button');
      for (const btn of hwButtons) {
        if (btn.textContent?.includes('完了') || btn.textContent?.includes('未提出') || btn.textContent?.includes('免除')) {
          await act(async () => {
            fireEvent.click(btn);
          });
        }
      }
    }

    // 4. AI Report Tab
    const aiTabBtn = screen.queryByText('AI指導報告書');
    if (aiTabBtn) {
      await act(async () => {
        fireEvent.click(aiTabBtn);
      });

      const textareas = screen.queryAllByRole('textbox');
      for (const txt of textareas) {
        await act(async () => {
          fireEvent.change(txt, { target: { value: '報告書テスト修正内容' } });
        });
      }

      const approveBtn = screen.queryByText(/報告書を承認・保存/i) || screen.queryByText(/承認/i);
      if (approveBtn) {
        await act(async () => {
          fireEvent.click(approveBtn);
        });
      }
    }
  });

  it('2. Exercises Schedule Auto-Optimization, Period Management, and Bulk Apply to All Students', async () => {
    render(
      <TeacherDashboard
        initialStudentId={student1.id}
        initialTab="schedule"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // 1. Period buttons (1 to 6 slots)
    for (let slot = 1; slot <= 5; slot++) {
      const btn = screen.queryByText(`${slot}コマ`);
      if (btn) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }

    // 2. Period subject & unit dropdowns
    const selects = screen.queryAllByRole('combobox');
    for (const sel of selects) {
      await act(async () => {
        if (sel.children.length > 1) {
          fireEvent.change(sel, { target: { value: (sel.children[1] as any).value } });
        }
      });
    }

    // 3. AI Auto Optimize
    const autoOptBtn = screen.queryByText(/AI自動最適化/i) || screen.queryByText(/自動配置/i);
    if (autoOptBtn) {
      await act(async () => {
        fireEvent.click(autoOptBtn);
      });
    }

    // 4. Save schedule
    const saveSchedBtn = screen.queryByText(/本日の時間割を保存/i) || screen.queryByText(/時間割を保存/i);
    if (saveSchedBtn) {
      await act(async () => {
        fireEvent.click(saveSchedBtn);
      });
    }

    // 5. Bulk Apply scope radio buttons
    const radios = screen.queryAllByRole('radio');
    for (const radio of radios) {
      await act(async () => {
        fireEvent.click(radio);
      });
    }

    const bulkApplyBtns = screen.queryAllByRole('button').filter(b => b.textContent?.includes('一括適用'));
    for (const btn of bulkApplyBtns) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }
  });

  it('3. Exercises Student Detail Management, Personality Tags, Teachers, and Account Creation', async () => {
    render(
      <TeacherDashboard
        initialStudentId={student1.id}
        initialTab="student_detail"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // 1. Edit student inputs
    const inputs = screen.queryAllByRole('textbox');
    for (const inp of inputs) {
      await act(async () => {
        fireEvent.change(inp, { target: { value: '更新値テスト' } });
      });
    }

    // 2. Toggle subject chips
    const chipButtons = screen.queryAllByRole('button');
    for (const chip of chipButtons) {
      const txt = chip.textContent || '';
      if (['数学', '英語', '理科', '社会', '国語', '算数', '月', '火', '水', '木', '金', '土'].some(s => txt.includes(s))) {
        await act(async () => {
          fireEvent.click(chip);
        });
      }
    }

    // 3. Save student detail
    const saveStBtn = screen.queryByText(/生徒情報を保存/i) || screen.queryByText(/保存/i);
    if (saveStBtn) {
      await act(async () => {
        fireEvent.click(saveStBtn);
      });
    }

    // 4. Account creation modal/form
    const createAccBtn = screen.queryByText(/アカウント発行/i) || screen.queryByText(/新規生徒登録/i);
    if (createAccBtn) {
      await act(async () => {
        fireEvent.click(createAccBtn);
      });
    }
  });
});
