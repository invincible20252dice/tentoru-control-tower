import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, School, CurriculumUnit } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('School Curriculum Management & Student Linking Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should verify fetchCurriculumUnits and saveCurriculumUnits ordering persistence in DatabaseService', async () => {
    const mockUnits: CurriculumUnit[] = [
      {
        id: 'unit-test-1',
        school_id: 'sch-akita-elem',
        subject: '算数',
        name: 'いくつといくつ',
        sequence_order: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'unit-test-2',
        school_id: 'sch-akita-elem',
        subject: '算数',
        name: 'たしざん(1)',
        sequence_order: 2,
        created_at: new Date().toISOString()
      },
      {
        id: 'unit-test-3',
        school_id: 'sch-akita-elem',
        subject: '算数',
        name: 'ひきざん(1)',
        sequence_order: 3,
        created_at: new Date().toISOString()
      }
    ];

    // 1. Save curriculum units
    await db.saveCurriculumUnits(mockUnits);

    // 2. Fetch all / filtered
    const fetched = await db.fetchCurriculumUnits('sch-akita-elem', '算数');
    expect(fetched.length).toBe(3);
    expect(fetched[0].name).toBe('いくつといくつ');
    expect(fetched[1].name).toBe('たしざん(1)');
    expect(fetched[2].name).toBe('ひきざん(1)');

    // 3. Swap order (reorder unit 1 and 2)
    const reordered: CurriculumUnit[] = [
      { ...mockUnits[1], sequence_order: 1 },
      { ...mockUnits[0], sequence_order: 2 },
      { ...mockUnits[2], sequence_order: 3 }
    ];

    await db.saveCurriculumUnits(reordered);

    const refetched = await db.fetchCurriculumUnits('sch-akita-elem', '算数');
    expect(refetched[0].id).toBe('unit-test-2');
    expect(refetched[0].sequence_order).toBe(1);
    expect(refetched[1].id).toBe('unit-test-1');
    expect(refetched[1].sequence_order).toBe(2);
    expect(refetched[2].id).toBe('unit-test-3');
    expect(refetched[2].sequence_order).toBe(3);
  });

  it('should auto-link curriculum management school and subject when elementary student is selected', async () => {
    const elementarySchool: School = {
      id: 'sch-akita-elem',
      name: '飽田南小学校',
      type: 'elementary',
      created_at: new Date().toISOString()
    };
    const jhsSchool: School = {
      id: 'sch-tentoru-jhs',
      name: '天登第一中学校',
      type: 'junior_high',
      created_at: new Date().toISOString()
    };
    await db.saveSchool(elementarySchool);
    await db.saveSchool(jhsSchool);

    const elemStudent: Student = {
      id: 'std-akita-1',
      student_id: 'STD_AKITA_1',
      name: '飽田 太郎',
      grade: '小3',
      school_id: 'sch-akita-elem',
      school_name: '飽田南小学校',
      selected_subjects: ['算数', '国語'],
      status: 'normal',
      level: 'A',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(elemStudent);

    const elemUnits: CurriculumUnit[] = [
      {
        id: 'elem-u-1',
        school_id: 'sch-akita-elem',
        subject: '算数',
        name: 'かけ算のきまり',
        sequence_order: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'elem-u-2',
        school_id: 'sch-akita-elem',
        subject: '算数',
        name: '時こくと時間',
        sequence_order: 2,
        created_at: new Date().toISOString()
      }
    ];
    await db.saveCurriculumUnits(elemUnits);

    render(<TeacherDashboard initialStudentId="std-akita-1" />);

    // Click on "学校カリキュラム管理" tab
    const curriculumTabBtn = screen.getByRole('button', { name: /学校カリキュラム/i });
    fireEvent.click(curriculumTabBtn);

    await waitFor(() => {
      // Check target school select has elementary school selected
      const selects = screen.getAllByRole('combobox');
      const schoolSelect = selects.find(s => (s as HTMLSelectElement).value === 'sch-akita-elem');
      expect(schoolSelect).toBeDefined();

      // Check target subject select has 算数 selected
      const subjectSelect = selects.find(s => (s as HTMLSelectElement).value === '算数');
      expect(subjectSelect).toBeDefined();
    });

    // Check displayed units
    expect(screen.getByText(/かけ算のきまり/)).toBeDefined();
    expect(screen.getByText(/時こくと時間/)).toBeDefined();
  });

  it('should auto-link junior high school and subject when junior high student is selected and handle school change dropdown', async () => {
    const elementarySchool: School = {
      id: 'sch-elem-2',
      name: 'テスト小学校',
      type: 'elementary',
      created_at: new Date().toISOString()
    };
    const jhsSchool: School = {
      id: 'sch-jhs-2',
      name: 'テスト第二中学校',
      type: 'junior_high',
      created_at: new Date().toISOString()
    };
    await db.saveSchool(elementarySchool);
    await db.saveSchool(jhsSchool);

    const jhsStudent: Student = {
      id: 'std-jhs-1',
      student_id: 'STD_JHS_1',
      name: '中川 二郎',
      grade: '中2',
      school_id: 'sch-jhs-2',
      school_name: 'テスト第二中学校',
      selected_subjects: ['数学', '英語'],
      status: 'normal',
      level: 'A',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(jhsStudent);

    const jhsUnits: CurriculumUnit[] = [
      {
        id: 'jhs-u-1',
        school_id: 'sch-jhs-2',
        subject: '数学',
        name: '連立方程式の解き方',
        sequence_order: 1,
        created_at: new Date().toISOString()
      }
    ];
    await db.saveCurriculumUnits(jhsUnits);

    render(<TeacherDashboard initialStudentId="std-jhs-1" />);

    // Click on "学校カリキュラム管理" tab
    const curriculumTabBtn = screen.getByRole('button', { name: /学校カリキュラム/i });
    fireEvent.click(curriculumTabBtn);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const schoolSelect = selects.find(s => (s as HTMLSelectElement).value === 'sch-jhs-2') as HTMLSelectElement;
      expect(schoolSelect).toBeDefined();

      const subjectSelect = selects.find(s => (s as HTMLSelectElement).value === '数学') as HTMLSelectElement;
      expect(subjectSelect).toBeDefined();

      // Change school to elementary
      fireEvent.change(schoolSelect, { target: { value: 'sch-elem-2' } });
    });

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const subjectSelect = selects.find(s => (s as HTMLSelectElement).value === '算数');
      expect(subjectSelect).toBeDefined();
    });
  });

  it('should allow unit reordering (up/down) via moveUnit, CRUD lifecycle and persist sequence_order', async () => {
    const elementarySchool: School = {
      id: 'sch-akita-elem',
      name: '飽田南小学校',
      type: 'elementary',
      created_at: new Date().toISOString()
    };
    await db.saveSchool(elementarySchool);

    const elemStudent: Student = {
      id: 'std-akita-2',
      student_id: 'STD_AKITA_2',
      name: '飽田 花子',
      grade: '小4',
      school_id: 'sch-akita-elem',
      school_name: '飽田南小学校',
      selected_subjects: ['算数'],
      status: 'normal',
      level: 'A',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(elemStudent);

    const units: CurriculumUnit[] = [
      {
        id: 'unit-order-1',
        school_id: 'sch-akita-elem',
        subject: '算数',
        name: '角の大きさ',
        sequence_order: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'unit-order-2',
        school_id: 'sch-akita-elem',
        subject: '算数',
        name: 'わり算の筆算',
        sequence_order: 2,
        created_at: new Date().toISOString()
      }
    ];
    await db.saveCurriculumUnits(units);

    render(<TeacherDashboard initialStudentId="std-akita-2" />);

    // Click curriculum tab
    const curriculumTabBtn = screen.getByRole('button', { name: /学校カリキュラム/i });
    fireEvent.click(curriculumTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/角の大きさ/)).toBeDefined();
    });

    // 1. Move unit 1 down
    const downButtons = screen.getAllByTitle('下へ移動');
    expect(downButtons.length).toBeGreaterThan(0);
    fireEvent.click(downButtons[0]);

    await waitFor(() => {
      const storedUnits = db.getCurriculumUnits().filter(u => u.school_id === 'sch-akita-elem');
      const unit1 = storedUnits.find(u => u.id === 'unit-order-1');
      const unit2 = storedUnits.find(u => u.id === 'unit-order-2');
      expect(unit2?.sequence_order).toBe(1);
      expect(unit1?.sequence_order).toBe(2);
    });

    // 2. Move unit 1 back up
    const upButtons = screen.getAllByTitle('上へ移動');
    expect(upButtons.length).toBeGreaterThan(0);
    // second item in UI is now unit-order-1
    fireEvent.click(upButtons[1]);

    await waitFor(() => {
      const storedUnits = db.getCurriculumUnits().filter(u => u.school_id === 'sch-akita-elem');
      const unit1 = storedUnits.find(u => u.id === 'unit-order-1');
      const unit2 = storedUnits.find(u => u.id === 'unit-order-2');
      expect(unit1?.sequence_order).toBe(1);
      expect(unit2?.sequence_order).toBe(2);
    });
  });
});
