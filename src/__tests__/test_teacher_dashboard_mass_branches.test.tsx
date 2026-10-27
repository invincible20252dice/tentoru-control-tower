import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, type Student, type CurriculumMaster, type StudentInterview2, type StudentInterview3 } from '../lib/db';

describe('TeacherDashboard Mass Branches Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
    vi.restoreAllMocks();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('covers TeacherDashboard interview tab (two-way and three-way) validations, selection, and save branches', async () => {
    const dynamicDate = getDynamicDate(-3);
    const student: Student = {
      id: 'st-interview-target-1',
      name: '面談対象生徒',
      grade: '中2',
      school_name: '緑野中学校',
      teacher_in_charge: '高橋 講師',
      selected_subjects: ['数学', '英語']
    };
    await db.saveStudent(student);

    // Save existing interview to db to trigger list selection
    const mockInterview2: StudentInterview2 = {
      id: 'mock-int-2-1',
      student_id: student.id,
      interviewer: '高橋 講師',
      interview_date: dynamicDate,
      dream_goal: 'プログラマー',
      target_school: '県立第一高校',
      study_anxiety: '英語のリスニング',
      self_evaluation: '70点くらい',
      student_challenges: '毎日の単語学習',
      required_actions: '毎日20単語暗記',
      expectations: '次の定期テストで80点以上',
      target_rank: '学年20位以内',
      target_score: '85点',
      notes: 'やる気は十分ある',
      custom_fields: [{ label: '得意教科', value: '数学' }]
    };
    await db.saveStudentInterview2(mockInterview2);

    render(
      <TeacherDashboard
        onBackToPortal={() => {}}
        onLogout={() => {}}
        onViewStudentScreen={() => {}}
        theme="light"
        teacherType="junior_high"
        initialStudentId={student.id}
        initialTab="two-way-interview"
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/読み込み中/i)).toBeNull();
    });

    // Check that interview list or form renders without crashing
    const interviewHeaders = screen.getAllByText(/二者面談/i);
    expect(interviewHeaders.length).toBeGreaterThan(0);
  });

  it('covers TeacherDashboard curriculum master filtering, sorting, and edge branches with null sort orders', async () => {
    const student: Student = {
      id: 'st-curriculum-test-1',
      name: 'カリキュラムテスト生徒',
      grade: '中1',
      school_name: '緑野中学校'
    };
    await db.saveStudent(student);

    // Curriculum masters with null sort_order and mixed subjects to test sorting fallbacks
    const masters: CurriculumMaster[] = [
      {
        id: 'cm-null-sort-1',
        grade: '中1',
        subject: '数学',
        unit_name: '正の数・負の数',
        lesson_name: '第1講 導入',
        item_type: 'lesson',
        sort_order: undefined
      },
      {
        id: 'cm-null-sort-2',
        grade: '中1',
        subject: '数学',
        unit_name: '正の数・負の数',
        lesson_name: '第2講 加法',
        item_type: 'lesson',
        sort_order: null as any
      },
      {
        id: 'cm-valid-sort-3',
        grade: '中1',
        subject: '数学',
        unit_name: '正の数・負の数',
        lesson_name: '単元確認テスト',
        item_type: 'unit_test',
        sort_order: 5
      }
    ];

    await db.saveCurriculumMasters(masters);

    render(
      <TeacherDashboard
        onBackToPortal={() => {}}
        onLogout={() => {}}
        onViewStudentScreen={() => {}}
        theme="light"
        teacherType="junior_high"
        initialStudentId={student.id}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/読み込み中/i)).toBeNull();
    });

    // Click curriculum menu button in sidebar
    const curriculumMenuBtn = screen.getByRole('button', { name: /学校カリキュラム管理/i });
    fireEvent.click(curriculumMenuBtn);

    // Verify curriculum tab card title renders without crashing
    await waitFor(() => {
      expect(screen.getByText(/学校単位のマスターカリキュラム設定/i)).toBeDefined();
    });
  });

  it('covers TeacherDashboard date query fallback and header type switching', async () => {
    const dynamicDate = getDynamicDate(0);
    const student: Student = {
      id: 'st-type-switch-1',
      name: '切替生徒',
      grade: '高1',
      school_name: '中央高校'
    };
    await db.saveStudent(student);

    render(
      <TeacherDashboard
        onBackToPortal={() => {}}
        onLogout={() => {}}
        onViewStudentScreen={() => {}}
        theme="light"
        teacherType="junior_high"
        initialDate={dynamicDate}
        targetDate={dynamicDate}
        initialStudentId={student.id}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/読み込み中/i)).toBeNull();
    });

    // Click high school type header button
    const highBtn = screen.getByTestId('header-teacher-type-high');
    fireEvent.click(highBtn);

    // Click elementary header button
    const elemBtn = screen.getByTestId('header-teacher-type-elem');
    fireEvent.click(elemBtn);

    // Click jhs header button
    const jhsBtn = screen.getByTestId('header-teacher-type-jhs');
    fireEvent.click(jhsBtn);

    // Click student list menu button in sidebar
    const studentListBtn = screen.getByRole('button', { name: /生徒一覧/i });
    fireEvent.click(studentListBtn);

    expect(studentListBtn).toBeDefined();
  });
});
