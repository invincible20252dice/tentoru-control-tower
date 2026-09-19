import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster } from '../lib/db';

describe('Curriculum Master, Subject Start Position, and Continuous Timeline Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '入力');
  });

  it('should seamlessly integrate CSV imported masters with subject start position dropdown and elementary continuous timeline', async () => {
    // 1. Prepare CSV imported curriculum masters matching the user screenshot
    const sampleCsvMasters: CurriculumMaster[] = [
      // 1年生 算数
      { id: 'cm-g1-m1', grade: '1年生', subject: '算数', unit_name: 'かずと すうじ', lesson_name: 'かずとすうじ', sort_order: 1 },
      { id: 'cm-g1-m2', grade: '1年生', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(1)', sort_order: 2 },
      { id: 'cm-g1-m3', grade: '1年生', subject: '算数', unit_name: 'いろいろな かたち', lesson_name: 'いろいろな かたち', sort_order: 3 },
      { id: 'cm-g1-m4', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: 'かずをあらわす', sort_order: 4 },
      // 2年生 算数 (from user screenshot)
      { id: 'cm-g2-m1', grade: '2年生', subject: '算数', unit_name: 'ひょう', lesson_name: 'ひょうとグラフ', sort_order: 10 },
      { id: 'cm-g2-m2', grade: '2年生', subject: '算数', unit_name: '時計', lesson_name: '時こくと時間', sort_order: 11 },
      { id: 'cm-g2-m3', grade: '2年生', subject: '算数', unit_name: 'たし算と ひき算', lesson_name: '2けたのたし算', sort_order: 12 },
      { id: 'cm-g2-m4', grade: '2年生', subject: '算数', unit_name: '長さ', lesson_name: '長さのたんい', sort_order: 13 },
      { id: 'cm-g2-m5', grade: '2年生', subject: '算数', unit_name: 'たし算と ひき算の ひっ算 (1)', lesson_name: 'ひっ算のしかた', sort_order: 14 }
    ];
    await db.saveCurriculumMasters(sampleCsvMasters);

    // 2. Prepare elementary student
    const student: Student = {
      id: 'std-elem-sync-test',
      name: '連動確認生徒',
      grade: '小2',
      grade_category: 'elementary',
      school_name: '天登小学校',
      period_count: 2,
      day_of_week: ['mon', 'wed', 'fri'],
      selected_subjects: ['算数', '国語'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 3. Render TeacherDashboard
    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" />);

    await waitFor(() => {
      expect(screen.getAllByText(/連動確認生徒/).length).toBeGreaterThan(0);
    });

    // 生徒選択
    const studentCard = screen.getAllByText(/連動確認生徒/)[0];
    fireEvent.click(studentCard);

    // 4. 生徒情報カルテの「教科別学習スタート位置」確認
    const infoTab = screen.queryByRole('button', { name: /生徒情報|生徒カルテ/i }) || screen.queryByText(/生徒情報/);
    if (infoTab) {
      fireEvent.click(infoTab);
    }

    await waitFor(() => {
      expect(screen.getByText('教科別学習スタート位置')).toBeInTheDocument();
    });

    // 算数の学年プルダウンで「2年生」を選択
    const mathGradeSelect = screen.getByTestId('start-grade-select-start_unit_math') as HTMLSelectElement;
    expect(mathGradeSelect).toBeInTheDocument();
    fireEvent.change(mathGradeSelect, { target: { value: '2年生' } });

    // 算数の単元プルダウンに「たし算と ひき算」などのCSVインポートデータが含まれていることを検証
    const mathUnitSelect = screen.getByTestId('start-unit-select-start_unit_math') as HTMLSelectElement;
    expect(mathUnitSelect).toBeInTheDocument();

    const options = Array.from(mathUnitSelect.options).map(o => o.text);
    expect(options.some(t => t.includes('ひょう'))).toBe(true);
    expect(options.some(t => t.includes('時計'))).toBe(true);
    expect(options.some(t => t.includes('たし算と ひき算'))).toBe(true);

    // 「たし算と ひき算」を選択
    const targetOption = Array.from(mathUnitSelect.options).find(o => o.text.includes('たし算と ひき算'));
    expect(targetOption).toBeDefined();
    fireEvent.change(mathUnitSelect, { target: { value: targetOption!.value } });

    // 「変更を保存する」をクリック
    const saveBtn = screen.getByRole('button', { name: '変更を保存する' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const savedStudent = db.getStudent('std-elem-sync-test');
      expect(savedStudent?.start_unit_math).toBeTruthy();
    });

    // 5. 「年間計画（無段階学習タイムライン）」タブに切り替えて連動を確認
    const milestoneTab = screen.getByRole('button', { name: /年間計画/i });
    fireEvent.click(milestoneTab);

    await waitFor(() => {
      expect(screen.getByTestId('elementary-timeline-container')).toBeInTheDocument();
    });

    // タイムライン上に1年生・2年生のCSVマスタ項目が表示されていることを検証
    expect(screen.getAllByText(/かずと すうじ/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/たしざん/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/たし算と ひき算/).length).toBeGreaterThan(0);

    // スタートラインバッジ（⭐ スタートライン）が表示されていることを検証
    await waitFor(() => {
      const startBadge = screen.queryByTestId('timeline-start-line-badge');
      expect(startBadge).toBeInTheDocument();
    });

    unmount();
  });

  it('should support Junior High start position and master sync for 5 subjects', async () => {
    const jhsMasters: CurriculumMaster[] = [
      { id: 'cm-j1-m1', grade: '中1', subject: '数学', unit_name: '1章 正負の数', lesson_name: '正負の加減', sort_order: 1 },
      { id: 'cm-j1-m2', grade: '中1', subject: '数学', unit_name: '2章 文字と式', lesson_name: '文字式の計算', sort_order: 2 },
      { id: 'cm-j2-m1', grade: '中2', subject: '数学', unit_name: '1章 式の計算', lesson_name: '単項式と多項式', sort_order: 10 }
    ];
    await db.saveCurriculumMasters(jhsMasters);

    const student: Student = {
      id: 'std-jhs-sync-test',
      name: '中学生連動生徒',
      grade: '中2',
      grade_category: 'junior_high',
      school_name: '天登中学校',
      period_count: 2,
      day_of_week: ['tuesday', 'thursday'],
      selected_subjects: ['数学', '英語'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="junior_high" />);

    await waitFor(() => {
      expect(screen.getAllByText(/中学生連動生徒/).length).toBeGreaterThan(0);
    });

    const studentCard = screen.getAllByText(/中学生連動生徒/)[0];
    fireEvent.click(studentCard);

    // カルテタブ
    const infoTab = screen.queryByRole('button', { name: /生徒情報|生徒カルテ/i }) || screen.queryByText(/生徒情報/);
    if (infoTab) fireEvent.click(infoTab);

    await waitFor(() => {
      expect(screen.getByText('教科別学習スタート位置')).toBeInTheDocument();
    });

    // 数学の学年プルダウンで「中2」を選択
    const mathGradeSelect = screen.getByTestId('start-grade-select-start_unit_math') as HTMLSelectElement;
    fireEvent.change(mathGradeSelect, { target: { value: '中2' } });

    const mathUnitSelect = screen.getByTestId('start-unit-select-start_unit_math') as HTMLSelectElement;
    const options = Array.from(mathUnitSelect.options).map(o => o.text);
    expect(options.some(t => t.includes('1章 式の計算'))).toBe(true);

    const targetOpt = Array.from(mathUnitSelect.options).find(o => o.text.includes('1章 式の計算'));
    fireEvent.change(mathUnitSelect, { target: { value: targetOpt!.value } });

    const saveBtn = screen.getByRole('button', { name: '変更を保存する' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const savedStudent = db.getStudent('std-jhs-sync-test');
      expect(savedStudent?.start_unit_math).toBeTruthy();
    });

    unmount();
  });
});
