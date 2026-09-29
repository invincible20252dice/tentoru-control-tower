import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import {
  Student,
  SchoolMaster,
  CurriculumMaster,
  Branch
} from '../types';

describe('Elementary Timeline Grade Filter Button Group Suite', () => {
  const mockBranches: Branch[] = [
    { id: 'branch-elem-1', name: '小学校舎', code: 'B_ELEM_1', email: 'elem@tentoru.jp', status: 'active', created_at: new Date().toISOString() }
  ];

  const mockSchools: SchoolMaster[] = [
    { id: 'sch-elem-1', name: '花咲小学校', type: 'elementary' }
  ];

  const studentElem1: Student = {
    id: 'std-elem-g1',
    student_id: 'S_ELEM_G1',
    name: '中尾 謙信',
    grade: '小1',
    status: 'normal',
    level: 'B',
    branch_id: 'branch-elem-1',
    classroom: '小学校舎',
    school_id: 'sch-elem-1',
    school_name: '花咲小学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '小1',
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['算数', '国語'],
    period_count: 2,
    default_slots: 2
  };

  const studentElem6: Student = {
    id: 'std-elem-g6',
    student_id: 'S_ELEM_G6',
    name: '鈴木 結衣',
    grade: '小6',
    status: 'normal',
    level: 'A',
    branch_id: 'branch-elem-1',
    classroom: '小学校舎',
    school_id: 'sch-elem-1',
    school_name: '花咲小学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '小6',
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['算数', '英語'],
    period_count: 2,
    default_slots: 2
  };

  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-g1-1', grade: '小1', subject: '算数', unit_name: '1章 10までのかず', lesson_name: 'STEP 1 いくつかな', sort_order: 1, item_type: 'lesson' },
    { id: 'cm-g1-2', grade: '小1', subject: '算数', unit_name: '1章 10までのかず', lesson_name: 'STEP 2 かずのならび', sort_order: 2, item_type: 'lesson' },
    { id: 'cm-g1-3', grade: '小1', subject: '算数', unit_name: '1章 10までのかず', lesson_name: '10までのかず 単元確認テスト', sort_order: 3, item_type: 'unit_test', passing_line: '80%以上' },
    { id: 'cm-g2-1', grade: '小2', subject: '算数', unit_name: '1章 たし算のひっ算', lesson_name: 'STEP 1 2けたのたし算', sort_order: 4, item_type: 'lesson' },
    { id: 'cm-g6-1', grade: '小6', subject: '算数', unit_name: '1章 分数の計算', lesson_name: 'STEP 1 分数のかけ算', sort_order: 5, item_type: 'lesson' },
    { id: 'cm-g6-2', grade: '小6', subject: '算数', unit_name: '1章 分数の計算', lesson_name: '1章 分数の計算 単元確認テスト', sort_order: 6, item_type: 'unit_test', passing_line: '80%以上' }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await db.saveStudent(studentElem1);
    await db.saveStudent(studentElem6);
    await db.saveCurriculumMasters(sampleMasters);
  });

  it('1. Renders all elementary grade filter buttons (1年生〜6年生 & 全学年表示) in milestone tab', async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem1, studentElem6]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={studentElem1.id}
          initialTab="milestones"
        />
      );
    });

    expect(screen.getByTestId('elementary-timeline-grade-button-group')).toBeInTheDocument();
    expect(screen.getByTestId('elementary-timeline-grade-btn-1年生')).toBeInTheDocument();
    expect(screen.getByTestId('elementary-timeline-grade-btn-2年生')).toBeInTheDocument();
    expect(screen.getByTestId('elementary-timeline-grade-btn-3年生')).toBeInTheDocument();
    expect(screen.getByTestId('elementary-timeline-grade-btn-4年生')).toBeInTheDocument();
    expect(screen.getByTestId('elementary-timeline-grade-btn-5年生')).toBeInTheDocument();
    expect(screen.getByTestId('elementary-timeline-grade-btn-6年生')).toBeInTheDocument();
    expect(screen.getByTestId('elementary-timeline-grade-btn-全学年表示')).toBeInTheDocument();

    wrapper.unmount();
  });

  it('2. Automatically sets default selected grade button according to student grade (小1 -> 1年生, 小6 -> 6年生)', async () => {
    // 2.1 小1生徒 (中尾 謙信) の初期表示 ➔ 1年生がアクティブで、小1の単元のみ表示される
    let wrapper1: any;
    await act(async () => {
      wrapper1 = render(
        <TeacherDashboard
          students={[studentElem1, studentElem6]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={studentElem1.id}
          initialTab="milestones"
        />
      );
    });

    expect(screen.getByText(/1章 10までのかず - STEP 1 いくつかな/)).toBeInTheDocument();
    expect(screen.queryByText(/1章 たし算のひっ算 - STEP 1 2けたのたし算/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1章 分数の計算 - STEP 1 分数のかけ算/)).not.toBeInTheDocument();
    wrapper1.unmount();

    // 2.2 小6生徒 (鈴木 結衣) の初期表示 ➔ 6年生がアクティブで、小6の単元のみ表示される
    let wrapper2: any;
    await act(async () => {
      wrapper2 = render(
        <TeacherDashboard
          students={[studentElem1, studentElem6]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={studentElem6.id}
          initialTab="milestones"
        />
      );
    });

    expect(screen.getByText(/1章 分数の計算 - STEP 1 分数のかけ算/)).toBeInTheDocument();
    expect(screen.queryByText(/1章 10までのかず - STEP 1 いくつかな/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1章 たし算のひっ算 - STEP 1 2けたのたし算/)).not.toBeInTheDocument();
    wrapper2.unmount();
  });

  it('3. Dynamically filters timeline steps on clicking different grade buttons (2年生, 1年生, 全学年表示)', async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem1]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={studentElem1.id}
          initialTab="milestones"
        />
      );
    });

    // 初期は1年生
    expect(screen.getByText(/1章 10までのかず - STEP 1 いくつかな/)).toBeInTheDocument();
    expect(screen.queryByText(/1章 たし算のひっ算 - STEP 1 2けたのたし算/)).not.toBeInTheDocument();

    // 2年生ボタンをクリック
    const btnG2 = screen.getByTestId('elementary-timeline-grade-btn-2年生');
    await act(async () => {
      fireEvent.click(btnG2);
    });

    expect(screen.getByText(/1章 たし算のひっ算 - STEP 1 2けたのたし算/)).toBeInTheDocument();
    expect(screen.queryByText(/1章 10までのかず - STEP 1 いくつかな/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1章 分数の計算 - STEP 1 分数のかけ算/)).not.toBeInTheDocument();

    // 全学年表示ボタンをクリック
    const btnAll = screen.getByTestId('elementary-timeline-grade-btn-全学年表示');
    await act(async () => {
      fireEvent.click(btnAll);
    });

    expect(screen.getByText(/1章 10までのかず - STEP 1 いくつかな/)).toBeInTheDocument();
    expect(screen.getByText(/1章 たし算のひっ算 - STEP 1 2けたのたし算/)).toBeInTheDocument();
    expect(screen.getByText(/1章 分数の計算 - STEP 1 分数のかけ算/)).toBeInTheDocument();

    // 3年生（データなし）をクリックした時の空表示案内
    const btnG3 = screen.getByTestId('elementary-timeline-grade-btn-3年生');
    await act(async () => {
      fireEvent.click(btnG3);
    });

    const emptyMsg = screen.getByTestId('elementary-timeline-empty-message');
    expect(emptyMsg).toBeInTheDocument();
    expect(emptyMsg.textContent).toContain('3年生');
    expect(emptyMsg.textContent).toContain('カリキュラムデータがありません');

    wrapper.unmount();
  });
});
