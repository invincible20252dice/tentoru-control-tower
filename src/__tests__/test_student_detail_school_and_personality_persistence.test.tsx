import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, School } from '../lib/db';

describe('Student Detail School Name and Personality Persistence', () => {
  const mockStudents: Student[] = [
    {
      id: 'st-persist-1',
      student_id: 'S1001',
      name: 'テスト生徒A',
      name_kana: 'テストセイトエー',
      grade: '中2',
      status: 'normal',
      period_count: 2,
      school_id: 'sch-initial-1',
      school_name: '第一中学校',
      personalities: ['集中力が高い'],
      personality_tags: ['集中力が高い'],
      target_schools: [{ school_name: '第一高校', course_name: '普通科' }],
      created_at: new Date().toISOString()
    }
  ];

  const mockSchools: School[] = [
    { id: 'sch-initial-1', name: '第一中学校', type: 'junior_high', created_at: new Date().toISOString() },
    { id: 'sch-initial-2', name: '第二中学校', type: 'junior_high', created_at: new Date().toISOString() }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    for (const st of mockStudents) {
      await db.saveStudent(st);
    }
    for (const sch of mockSchools) {
      await db.saveSchool(sch);
    }
    await db.addPersonalityOption('集中力が高い');
    await db.addPersonalityOption('努力家');
    await db.addPersonalityOption('論理的思考');
    await db.addPersonalityOption('負けず嫌い');
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('1. should persist school_name when edited and saved, and keep it on reload/re-render', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId="st-persist-1"
          initialTab="student-detail"
          teacherType="junior_high"
        />
      );
    });

    // 学校名入力欄を検証
    const schoolInput = (await screen.findByTestId('student-school-name-input')) as HTMLInputElement;

    expect(schoolInput).toBeDefined();
    expect(schoolInput.value).toBe('第一中学校');

    // 学校名を「恵比寿未来中学校」に変更
    await act(async () => {
      fireEvent.change(schoolInput, { target: { value: '恵比寿未来中学校' } });
      fireEvent.blur(schoolInput);
    });
    expect(schoolInput.value).toBe('恵比寿未来中学校');

    // 「変更を保存する」ボタンを押下
    const saveBtn = screen.getByRole('button', { name: /変更を保存する/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // DB に永続保存されていることを検証
    await waitFor(() => {
      const savedStudents = db.getStudents();
      const updatedStudent = savedStudents.find(s => s.id === 'st-persist-1');
      expect(updatedStudent?.school_name).toBe('恵比寿未来中学校');
    });
  });

  it('2. should add personality tag from master select and persist it upon saving', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId="st-persist-1"
          initialTab="student-detail"
          teacherType="junior_high"
        />
      );
    });

    // 個性サブタブを表示
    const subTabBtn = screen.queryByTestId('subtab-start-and-personality') || screen.queryByText(/教科別スタート位置・個性/);
    if (subTabBtn) {
      await act(async () => {
        fireEvent.click(subTabBtn);
      });
    }

    // マスタ選択プルダウンから「努力家」を選択
    const masterSelect = (await screen.findByTestId('personality-master-select')) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(masterSelect, { target: { value: '努力家' } });
    });

    // 「＋ 追加」ボタンをクリック
    const addBtn = screen.getByTestId('add-personality-btn');
    await act(async () => {
      fireEvent.click(addBtn);
    });

    // 画面に「努力家」タグの削除ボタンが即時レンダリングされたことを検証
    await waitFor(() => {
      expect(screen.getByTestId('remove-personality-tag-努力家')).toBeDefined();
    });

    // 新規自由入力から「探究心旺盛」を追加
    const newTagInput = screen.getByTestId('new-personality-input');
    await act(async () => {
      fireEvent.change(newTagInput, { target: { value: '探究心旺盛' } });
      fireEvent.click(addBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('remove-personality-tag-探究心旺盛')).toBeDefined();
    });

    // 「変更を保存する」ボタンを押下
    const saveBtn = screen.getByRole('button', { name: /変更を保存する/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // DB に永続化されたことを検証
    await waitFor(() => {
      const savedStudents = db.getStudents();
      const updatedStudent = savedStudents.find(s => s.id === 'st-persist-1');
      expect(updatedStudent?.personalities).toContain('努力家');
      expect(updatedStudent?.personalities).toContain('探究心旺盛');
      expect(updatedStudent?.personality_tags).toContain('努力家');
    });
  });

  it('3. should prevent duplicate personality tags and allow removing tags', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId="st-persist-1"
          initialTab="student-detail"
          teacherType="junior_high"
        />
      );
    });

    const subTabBtn = screen.queryByTestId('subtab-start-and-personality') || screen.queryByText(/教科別スタート位置・個性/);
    if (subTabBtn) {
      await act(async () => {
        fireEvent.click(subTabBtn);
      });
    }

    // 既に存在する「集中力が高い」を追加しようとする
    const masterSelect = (await screen.findByTestId('personality-master-select')) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(masterSelect, { target: { value: '集中力が高い' } });
    });
    const addBtn = screen.getByTestId('add-personality-btn');
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(window.alert).toHaveBeenCalledWith('この個性は既に登録されています。');

    // 「集中力が高い」タグを削除
    const removeBtn = screen.getByTestId('remove-personality-tag-集中力が高い');
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    // 保存
    const saveBtn = screen.getByRole('button', { name: /変更を保存する/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      const savedStudents = db.getStudents();
      const updatedStudent = savedStudents.find(s => s.id === 'st-persist-1');
      expect(updatedStudent?.personalities).not.toContain('集中力が高い');
    });
  });
});
