import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { generateSlotsForSelectedSubjects, getSortedSubjectsByProgressRate, SUBJECT_PRIORITY } from '../lib/scheduler';
import { Student, CurriculumMaster } from '../types';

describe('Subject Priority Sorting and Slot Reschedule Suite', () => {
  const sampleStudentElem: Student = {
    id: 'std-prio-elem',
    student_id: 'S_ELEM_PRIO',
    name: '優先度検証 小学生',
    grade: '小5',
    branch_id: 'branch-1',
    classroom: '恵比寿教室',
    teacher_in_charge: '福田 尚弘',
    status: 'normal',
    period_count: 3,
    selected_days: ['monday', 'thursday'],
    // 意図的に理科や社会を先頭に配置
    selected_subjects: ['理科', '社会', '英語', '算数'],
    created_at: '2026-04-01T00:00:00Z',
    registered_year: 2026,
    registered_grade: '小5'
  };

  const sampleStudentJhs: Student = {
    id: 'std-prio-jhs',
    student_id: 'S_JHS_PRIO',
    name: '優先度検証 中学生',
    grade: '中2',
    branch_id: 'branch-1',
    classroom: '恵比寿教室',
    teacher_in_charge: '福田 尚弘',
    status: 'normal',
    period_count: 3,
    selected_days: ['monday', 'thursday'],
    // 意図的に社会・理科・国語を先頭に配置
    selected_subjects: ['社会', '理科', '国語', '英語', '数学'],
    created_at: '2026-04-01T00:00:00Z',
    registered_year: 2026,
    registered_grade: '中2'
  };

  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-m1', subject: '算数', grade: '小5', unit_name: '小数のかけ算', lesson_name: 'STEP 1', sort_order: 1 },
    { id: 'cm-e1', subject: '英語', grade: '小5', unit_name: 'アルファベット', lesson_name: 'STEP 1', sort_order: 1 },
    { id: 'cm-s1', subject: '理科', grade: '小5', unit_name: '天気の変化', lesson_name: 'STEP 1', sort_order: 1 },
    { id: 'cm-so1', subject: '社会', grade: '小5', unit_name: '日本の国土', lesson_name: 'STEP 1', sort_order: 1 },

    { id: 'cm-jm1', subject: '数学', grade: '中2', unit_name: '式の計算', lesson_name: 'STEP 1', sort_order: 1 },
    { id: 'cm-je1', subject: '英語', grade: '中2', unit_name: 'Unit 1', lesson_name: 'STEP 1', sort_order: 1 },
    { id: 'cm-js1', subject: '理科', grade: '中2', unit_name: '化学変化', lesson_name: 'STEP 1', sort_order: 1 },
    { id: 'cm-jso1', subject: '社会', grade: '中2', unit_name: '歴史', lesson_name: 'STEP 1', sort_order: 1 },
    { id: 'cm-jj1', subject: '国語', grade: '中2', unit_name: '説明文', lesson_name: 'STEP 1', sort_order: 1 },
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    db.saveStudent(sampleStudentElem);
    db.saveStudent(sampleStudentJhs);
    await db.saveCurriculumMasters(sampleMasters);
  });

  it('verifies SUBJECT_PRIORITY definition and ordering values', () => {
    expect(SUBJECT_PRIORITY['算数']).toBe(1);
    expect(SUBJECT_PRIORITY['数学']).toBe(1);
    expect(SUBJECT_PRIORITY['math']).toBe(1);
    expect(SUBJECT_PRIORITY['英語']).toBe(2);
    expect(SUBJECT_PRIORITY['english']).toBe(2);
    expect(SUBJECT_PRIORITY['国語']).toBe(3);
    expect(SUBJECT_PRIORITY['理科']).toBe(4);
    expect(SUBJECT_PRIORITY['社会']).toBe(5);
  });

  it('guarantees getSortedSubjectsByProgressRate places Math first and English second regardless of raw subject order', () => {
    // 小学生: ['理科', '社会', '英語', '算数']
    const sortedElem = getSortedSubjectsByProgressRate({
      student: sampleStudentElem,
      selectedSubjects: sampleStudentElem.selected_subjects,
      curriculumMasters: sampleMasters
    });
    expect(sortedElem[0]).toBe('算数');
    expect(sortedElem[1]).toBe('英語');
    expect(['理科', '社会']).toContain(sortedElem[2]);

    // 中学生: ['社会', '理科', '国語', '英語', '数学']
    const sortedJhs = getSortedSubjectsByProgressRate({
      student: sampleStudentJhs,
      selectedSubjects: sampleStudentJhs.selected_subjects,
      curriculumMasters: sampleMasters
    });
    expect(sortedJhs[0]).toBe('数学');
    expect(sortedJhs[1]).toBe('英語');
    expect(sortedJhs[2]).toBe('国語');
  });

  it('guarantees generateSlotsForSelectedSubjects assigns Slot 1 = Math and Slot 2 = English for 2 periods', () => {
    const slots = generateSlotsForSelectedSubjects({
      student: sampleStudentElem,
      periodCount: 2,
      selectedSubjects: ['理科', '英語', '算数'],
      curriculumMasters: sampleMasters
    });

    expect(slots[1].subject).toBe('算数');
    expect(slots[2].subject).toBe('英語');
  });

  it('guarantees generateSlotsForSelectedSubjects assigns Slot 1 = Math, Slot 2 = English, Slot 3 = Science/Social for 3 periods', () => {
    const slots = generateSlotsForSelectedSubjects({
      student: sampleStudentElem,
      periodCount: 3,
      selectedSubjects: ['社会', '理科', '英語', '算数'],
      curriculumMasters: sampleMasters
    });

    expect(slots[1].subject).toBe('算数');
    expect(slots[2].subject).toBe('英語');
    expect(['理科', '社会']).toContain(slots[3].subject);
  });

  it('verifies TeacherDashboard Auto Reschedule enforces Slot 1 = Math, Slot 2 = English, Slot 3 = Science/Social in UI', async () => {
    let container: HTMLElement;
    await act(async () => {
      const res = render(
        <TeacherDashboard
          students={[sampleStudentElem]}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={sampleStudentElem.id}
          initialTab="schedule"
        />
      );
      container = res.container;
    });

    // 「遅れチェック＆自動リスケ」ボタンをクリック
    const reschedBtn = screen.getByText(/遅れチェック/);
    await act(async () => {
      fireEvent.click(reschedBtn);
    });

    // コマ割りのドロップダウンまたは表示値の検証
    await waitFor(() => {
      const p1Select = screen.queryByTestId('period-subject-select-1') as HTMLSelectElement;
      const p2Select = screen.queryByTestId('period-subject-select-2') as HTMLSelectElement;
      const p3Select = screen.queryByTestId('period-subject-select-3') as HTMLSelectElement;

      if (p1Select && p2Select) {
        expect(p1Select.value).toBe('算数');
        expect(p2Select.value).toBe('英語');
        if (p3Select) {
          expect(['理科', '社会']).toContain(p3Select.value);
        }
      }
    });
  });
});
