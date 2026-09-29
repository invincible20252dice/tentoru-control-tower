import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, LearningTask, StudentLessonProgress, CurriculumMaster } from '../lib/db';

describe('Elementary Timeline Slot Synchronization and Individual Student Progress Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '入力');
  });

  it('should accurately reflect active schedule slot as current position and never mark future lessons as completed prematurely', async () => {
    // 1. カリキュラムマスタの準備（1年生 国語）
    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-kokugo-1', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'あいうえお', sort_order: 1 },
      { id: 'cm-kokugo-2', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'かきくけこ', sort_order: 2 },
      { id: 'cm-kokugo-3', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'さしすせそ', sort_order: 3 },
      { id: 'cm-kokugo-4', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'たちつてと', sort_order: 4 }
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    // 2. 生徒A（個別進捗: STEP1のみ完了、STEP2がコマ割りで割り当て中）
    const studentA: Student = {
      id: 'student-elem-sync-a',
      name: '生徒A (国語学習中)',
      grade: '小1',
      grade_category: 'elementary',
      school_name: '天登小学校',
      period_count: 2,
      day_of_week: ['mon', 'wed'],
      selected_subjects: ['国語'],
      completed_lesson_ids: ['cm-kokugo-1'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(studentA);

    // 生徒Aの個別進捗レコード (STEP1: completed)
    const progressA1: StudentLessonProgress = {
      id: 'prog-a-1',
      student_id: 'student-elem-sync-a',
      lesson_id: 'cm-kokugo-1',
      status: 'completed',
      score: 100,
      completed_at: new Date().toISOString()
    };
    await db.saveStudentLessonProgress(progressA1);

    // 生徒Aのコマ割りタスク (STEP2: in_progress 未完了)
    const todayStr = new Date().toISOString().split('T')[0];
    const taskA2: LearningTask = {
      id: 'task-a-2',
      student_id: 'student-elem-sync-a',
      scheduled_date: todayStr,
      subject: '国語',
      period: 1,
      unit_id: 'cm-kokugo-2',
      start_lesson_id: 'cm-kokugo-2',
      end_lesson_id: 'cm-kokugo-2',
      title: 'かきくけこ',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([taskA2]);

    // 3. TeacherDashboardのレンダリング
    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" />);

    await waitFor(() => {
      expect(screen.getAllByText(/生徒A \(国語学習中\)/).length).toBeGreaterThan(0);
    });

    // 生徒Aを選択
    fireEvent.click(screen.getAllByText(/生徒A \(国語学習中\)/)[0]);

    // 「年間計画（無段階学習タイムライン）」タブに切り替え
    const milestoneTab = screen.getByRole('button', { name: /年間計画/i });
    fireEvent.click(milestoneTab);

    // 4. タイムライン上の各STEPのステータスを検証
    await waitFor(() => {
      const step1Item = screen.getByTestId('timeline-item-cm-kokugo-1');
      const step2Item = screen.getByTestId('timeline-item-cm-kokugo-2');
      const step3Item = screen.getByTestId('timeline-item-cm-kokugo-3');
      const step4Item = screen.getByTestId('timeline-item-cm-kokugo-4');

      // STEP 1: ✓ 完了
      expect(step1Item).toHaveTextContent('✓ 完了');
      expect(step1Item).not.toHaveTextContent('📍 現在地（取り組み中）');

      // STEP 2: コマ割りで取り組み中なので 📍 現在地（取り組み中）
      expect(step2Item).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step2Item).not.toHaveTextContent('✓ 完了');

      // STEP 3以降: 先行して完了になっていないこと（○ 予定）
      expect(step3Item).toHaveTextContent('○ 予定');
      expect(step3Item).not.toHaveTextContent('✓ 完了');
      expect(step3Item).not.toHaveTextContent('📍 現在地（取り組み中）');

      expect(step4Item).toHaveTextContent('○ 予定');
      expect(step4Item).not.toHaveTextContent('✓ 完了');
    });

    unmount();
  });

  it('should maintain independent lesson progress for advanced student', async () => {
    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-kokugo-1', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'あいうえお', sort_order: 1 },
      { id: 'cm-kokugo-2', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'かきくけこ', sort_order: 2 },
      { id: 'cm-kokugo-3', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'さしすせそ', sort_order: 3 },
      { id: 'cm-kokugo-4', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'たちつてと', sort_order: 4 }
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const studentB: Student = {
      id: 'student-elem-isolate-b',
      name: '生徒B (先行進度)',
      grade: '小1',
      grade_category: 'elementary',
      school_name: '天登小学校',
      period_count: 2,
      day_of_week: ['mon'],
      selected_subjects: ['国語'],
      completed_lesson_ids: ['cm-kokugo-1', 'cm-kokugo-2', 'cm-kokugo-3'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(studentB);

    await db.saveStudentLessonProgress({
      id: 'prog-b-1',
      student_id: 'student-elem-isolate-b',
      lesson_id: 'cm-kokugo-1',
      status: 'completed',
      score: 100
    });
    await db.saveStudentLessonProgress({
      id: 'prog-b-2',
      student_id: 'student-elem-isolate-b',
      lesson_id: 'cm-kokugo-2',
      status: 'completed',
      score: 100
    });
    await db.saveStudentLessonProgress({
      id: 'prog-b-3',
      student_id: 'student-elem-isolate-b',
      lesson_id: 'cm-kokugo-3',
      status: 'completed',
      score: 100
    });

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" />);

    await waitFor(() => {
      expect(screen.getAllByText(/生徒B \(先行進度\)/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText(/生徒B \(先行進度\)/)[0]);
    fireEvent.click(screen.getByRole('button', { name: /年間計画/i }));

    await waitFor(() => {
      const step1Item = screen.getByTestId('timeline-item-cm-kokugo-1');
      const step2Item = screen.getByTestId('timeline-item-cm-kokugo-2');
      const step3Item = screen.getByTestId('timeline-item-cm-kokugo-3');
      const step4Item = screen.getByTestId('timeline-item-cm-kokugo-4');

      expect(step1Item).toHaveTextContent('✓ 完了');
      expect(step2Item).toHaveTextContent('✓ 完了');
      expect(step3Item).toHaveTextContent('✓ 完了');
      expect(step4Item).toHaveTextContent('📍 現在地（取り組み中）');
    });

    unmount();
  });

  it('should maintain independent initial progress for a newly registered student', async () => {
    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-kokugo-1', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'あいうえお', sort_order: 1 },
      { id: 'cm-kokugo-2', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'かきくけこ', sort_order: 2 },
      { id: 'cm-kokugo-3', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'さしすせそ', sort_order: 3 },
      { id: 'cm-kokugo-4', grade: '1年生', subject: '国語', unit_name: 'ひらがな', lesson_name: 'たちつてと', sort_order: 4 }
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const studentC: Student = {
      id: 'student-elem-isolate-c',
      name: '生徒C (初期進度)',
      grade: '小1',
      grade_category: 'elementary',
      school_name: '天登小学校',
      period_count: 2,
      level: 'C',
      day_of_week: ['tue'],
      selected_subjects: ['国語'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(studentC);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" />);

    await waitFor(() => {
      expect(screen.getAllByText(/生徒C \(初期進度\)/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText(/生徒C \(初期進度\)/)[0]);
    fireEvent.click(screen.getByRole('button', { name: /年間計画/i }));

    await waitFor(() => {
      const step1Item = screen.getByTestId('timeline-item-cm-kokugo-1');
      const step2Item = screen.getByTestId('timeline-item-cm-kokugo-2');
      const step3Item = screen.getByTestId('timeline-item-cm-kokugo-3');

      expect(step1Item).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step1Item).not.toHaveTextContent('✓ 完了');
      expect(step2Item).toHaveTextContent('○ 予定');
      expect(step3Item).toHaveTextContent('○ 予定');
    });

    unmount();
  });
});
