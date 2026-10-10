import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { db, Student, LearningTask, CurriculumMaster, HomeworkResult } from '../lib/db';
import { getLessonRangeStepIds, generateSlotsForSelectedSubjects } from '../lib/scheduler';

describe('Sequential Learning, Single Source of Truth Sync, and Auto Homework Mission Suite', () => {
  const todayStr = '2026-10-10';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. 中抜き・スキップ受講の完全禁止（全教科・全学年・全生徒共通）', () => {
    it('生徒画面で未完了の先頭ステップのみ受講可能であり、後続ステップは待機中となり中抜き受講できないこと', async () => {
      const studentSeq: Student = {
        id: 'std-seq-test',
        student_id: 'std_seq',
        name: '順序受講生徒',
        grade: '小1',
        status: 'normal',
        period_count: 1,
        registered_year: 2026,
        registered_grade: '小1',
        selected_subjects: ['算数'],
        attendance_days: ['火', '金'],
        selected_days: ['tuesday', 'friday'],
        completed_lesson_ids: []
      };
      await db.saveStudent(studentSeq);

      // コマ割りタスク: 3つのステップを含む
      const multiStepTask: LearningTask = {
        id: 'task-seq-1',
        student_id: studentSeq.id,
        scheduled_date: todayStr,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '算数',
        unit_id: 'cm-step-1',
        custom_unit_name: 'わり算の基礎',
        start_lesson_id: 'cm-step-1',
        end_lesson_id: 'cm-step-3',
        start_lesson_name: 'ステップ1',
        end_lesson_name: 'ステップ3',
        lesson_range: 'ステップ1 〜 ステップ3',
        lesson_ids: ['cm-step-1', 'cm-step-2', 'cm-step-3'],
        completed_lesson_ids: []
      };
      await db.saveLearningTasks([multiStepTask]);

      render(<StudentDashboard student={studentSeq} initialDate={todayStr} onLogout={vi.fn()} />);

      // STEP 1 〜 STEP 3 が描画されるのを待つ
      await waitFor(() => {
        expect(screen.getByTestId('step-card-1-0')).toBeInTheDocument();
        expect(screen.getByTestId('step-card-1-1')).toBeInTheDocument();
        expect(screen.getByTestId('step-card-1-2')).toBeInTheDocument();
      });

      // 先頭ステップ（STEP 1）のみ「🎯 完了にする」ボタンが存在
      const step1Btn = screen.getByTestId('step-complete-btn-1-0');
      expect(step1Btn).toBeInTheDocument();

      // 後続ステップ（STEP 2, STEP 3）は「⏳ 待機中」バッジが表示され、完了ボタンは存在しない
      expect(screen.queryByTestId('step-complete-btn-1-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('step-waiting-badge-1-1')).toHaveTextContent('⏳ 待機中');
      expect(screen.queryByTestId('step-complete-btn-1-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('step-waiting-badge-1-2')).toHaveTextContent('⏳ 待機中');

      // STEP 1 を完了にする
      await act(async () => {
        fireEvent.click(step1Btn);
      });

      // STEP 1 が「✅ 受講完了」になり、STEP 2 が活性化されて完了ボタンが出現
      await waitFor(() => {
        expect(screen.getByTestId('step-done-badge-1-0')).toBeInTheDocument();
        expect(screen.getByTestId('step-complete-btn-1-1')).toBeInTheDocument();
        // STEP 3 は依然として待機中
        expect(screen.getByTestId('step-waiting-badge-1-2')).toHaveTextContent('⏳ 待機中');
      });

      // STEP 2 を完了にする
      const step2Btn = screen.getByTestId('step-complete-btn-1-1');
      await act(async () => {
        fireEvent.click(step2Btn);
      });

      // STEP 2 が完了し、STEP 3 が活性化
      await waitFor(() => {
        expect(screen.getByTestId('step-done-badge-1-1')).toBeInTheDocument();
        expect(screen.getByTestId('step-complete-btn-1-2')).toBeInTheDocument();
      });
    });
  });

  describe('2. 単一データソース（確定レッスンID配列）による3画面完全同期', () => {
    it('時間割コマ割りを保存した際、確定lesson_ids配列が生成・保存され、生徒画面とタイムラインに完全同期されること', async () => {
      const studentSync: Student = {
        id: 'std-sync-1',
        student_id: 'std_sync',
        name: '同期確認生徒',
        grade: '小1',
        status: 'normal',
        period_count: 2,
        registered_year: 2026,
        registered_grade: '小1',
        selected_subjects: ['算数'],
        attendance_days: ['火', '金', '土'],
        selected_days: ['tuesday', 'friday', 'saturday'],
        completed_lesson_ids: []
      };
      await db.saveStudent(studentSync);

      // カリキュラムマスタ
      const masters: CurriculumMaster[] = [
        { id: 'cm-m-1', grade: '小1', subject: '算数', unit_name: 'かずとすうじ', lesson_name: 'かずとすうじ 1', sort_order: 1 },
        { id: 'cm-m-2', grade: '小1', subject: '算数', unit_name: 'かずとすうじ', lesson_name: 'かずとすうじ 2', sort_order: 2 },
        { id: 'cm-m-3', grade: '小1', subject: '算数', unit_name: 'かずとすうじ', lesson_name: 'かずとすうじ 3', sort_order: 3 }
      ];
      await db.saveCurriculumMasters(masters);

      // 講師ダッシュボードでコマ割り保存を実行
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const { unmount } = render(
        <TeacherDashboard 
          onLogout={vi.fn()} 
          teacherType="elementary" 
          initialDate={todayStr}
        />
      );

      // 生徒選択
      await waitFor(() => {
        expect(screen.getAllByText(/同期確認生徒/).length).toBeGreaterThan(0);
      });
      const stRow = screen.getAllByText(/同期確認生徒/)[0];
      fireEvent.click(stRow);

      // 時間割コマ割りを保存ボタンをクリック
      const saveBtn = screen.getByText('時間割コマ割りを保存');
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalled();
      });
      alertMock.mockRestore();

      // DBに保存されたタスクを確認
      const savedTasks = db.getLearningTasks().filter(t => t.student_id === studentSync.id && t.scheduled_date === todayStr);
      expect(savedTasks.length).toBeGreaterThan(0);
      
      // 保存されたタスクに確定 lesson_ids 配列が必ず設定されていること
      const firstTask = savedTasks[0];
      expect(Array.isArray(firstTask.lesson_ids)).toBe(true);
      expect(firstTask.lesson_ids!.length).toBeGreaterThan(0);

      unmount();

      // 生徒学習画面で開いた際、DBに保存された lesson_ids がそのまま STEP 1〜N として過不足なく展開されること
      const { unmount: unmountStudent } = render(
        <StudentDashboard 
          student={studentSync} 
          initialDate={todayStr} 
          onLogout={vi.fn()} 
        />
      );

      await waitFor(() => {
        firstTask.lesson_ids!.forEach((lid, idx) => {
          expect(screen.getByTestId(`step-card-${firstTask.period}-${idx}`)).toBeInTheDocument();
        });
      });

      unmountStudent();
    });
  });

  describe('3. 中尾くんの置き去りステップクリーンアップ（cleanupStudentSteppingStoneUncompletedLessons）', () => {
    it('手前に置き去りになっている中途半端な未受講ステップがすべてcompletedとして補正されDB更新されること', async () => {
      // 中尾くん相当の小5生徒（STEP 100〜104が手前に置き去りになり、現在地がSTEP 105以降）
      const nakaoStudent: Student = {
        id: 'std-nakao-clean-test',
        student_id: 'student103',
        name: '中尾 謙信',
        grade: '小5',
        status: 'normal',
        period_count: 2,
        registered_year: 2026,
        registered_grade: '小5',
        selected_subjects: ['算数'],
        attendance_days: ['火', '金'],
        selected_days: ['tuesday', 'friday'],
        completed_lesson_ids: ['cm-p1-m1', 'cm-p1-m2', 'cm-elem-5'],
        subject_start_positions: {
          '算数': 'cm-elem-5'
        }
      };
      await db.saveStudent(nakaoStudent);

      // クリーンアップ実行
      const cleaned = await db.cleanupStudentSteppingStoneUncompletedLessons(nakaoStudent.id, '算数');
      expect(cleaned).toBeDefined();

      // cm-elem-5（最大完了/スタート位置）より手前の小1〜小5レッスンがすべて completed_lesson_ids に補正されていること
      expect(cleaned?.completed_lesson_ids).toContain('cm-p1-m1');
      expect(cleaned?.completed_lesson_ids).toContain('cm-p1-m2');
      expect(cleaned?.completed_lesson_ids).toContain('cm-p1-m3');
      expect(cleaned?.completed_lesson_ids).toContain('cm-p1-m4');
      expect(cleaned?.completed_lesson_ids).toContain('cm-elem-1');
      expect(cleaned?.completed_lesson_ids).toContain('cm-elem-2');
      expect(cleaned?.completed_lesson_ids).toContain('cm-elem-3');
      expect(cleaned?.completed_lesson_ids).toContain('cm-elem-4');
      expect(cleaned?.completed_lesson_ids).toContain('cm-elem-5');

      // DBにも更新が永続化されていること
      const reloaded = db.getStudents().find(s => s.id === nakaoStudent.id);
      expect(reloaded?.completed_lesson_ids).toEqual(cleaned?.completed_lesson_ids);
    });
  });

  describe('4. 宿題ミッションの自動生成ルール', () => {
    it('生徒が当日の授業コマ（通常授業＋まとめテスト）を全完了にした瞬間、次回通塾日を提出期限とする宿題が自動生成されること', async () => {
      const studentHw: Student = {
        id: 'std-hw-test',
        student_id: 'std_hw',
        name: '宿題自動生成生徒',
        grade: '中1',
        status: 'normal',
        period_count: 1,
        registered_year: 2026,
        registered_grade: '中1',
        selected_subjects: ['数学'],
        attendance_days: ['火', '金'], // 次回通塾日の計算用
        selected_days: ['tuesday', 'friday'],
        completed_lesson_ids: []
      };
      await db.saveStudent(studentHw);

      const lessonTask: LearningTask = {
        id: 'task-hw-trigger-1',
        student_id: studentHw.id,
        scheduled_date: todayStr, // 土曜
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '数学',
        unit_id: 'm-hw-1',
        custom_unit_name: '正の数・負の数の計算',
        start_lesson_id: 'm-hw-1',
        end_lesson_id: 'm-hw-1',
        start_lesson_name: '加法と減法',
        end_lesson_name: '加法と減法',
        lesson_range: '加法と減法',
        lesson_ids: ['m-hw-1'],
        completed_lesson_ids: []
      };
      await db.saveLearningTasks([lessonTask]);

      render(<StudentDashboard student={studentHw} initialDate={todayStr} onLogout={vi.fn()} />);

      // 初期状態では宿題は0件
      expect(screen.queryByTestId('today-homework-card')).not.toBeInTheDocument();

      // ステップ完了ボタンを押してコマを全完了にする
      const completeBtn = await screen.findByTestId('step-complete-btn-1-0');
      await act(async () => {
        fireEvent.click(completeBtn);
      });

      // 宿題が自動生成され、画面上に「今日の宿題」カードが表示されること
      await waitFor(() => {
        expect(screen.getByTestId('today-homework-card')).toBeInTheDocument();
        expect(screen.getByText(/【復習演習】数学: 正の数・負の数の計算/)).toBeInTheDocument();
        expect(screen.getByText(/提出期限: 2026-10-13/)).toBeInTheDocument(); // 次回火曜日の日付
      });

      // DBにも保存されていること
      const savedHws = db.getHomeworkResults().filter(h => h.student_id === studentHw.id && h.date === todayStr);
      expect(savedHws.length).toBe(1);
      expect(savedHws[0].homework_deadline).toBe('2026-10-13');
      expect(savedHws[0].status).toBe('incomplete');
    });

    it('単元テストの場合は宿題が自動生成されないこと', async () => {
      const studentUt: Student = {
        id: 'std-ut-hw-test',
        student_id: 'std_ut_hw',
        name: '単元テスト生徒',
        grade: '中1',
        status: 'normal',
        period_count: 1,
        registered_year: 2026,
        registered_grade: '中1',
        selected_subjects: ['数学'],
        attendance_days: ['火', '金'],
        selected_days: ['tuesday', 'friday'],
        completed_lesson_ids: []
      };
      await db.saveStudent(studentUt);

      const unitTestTask: LearningTask = {
        id: 'task-ut-hw-trigger-1',
        student_id: studentUt.id,
        scheduled_date: todayStr,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '数学',
        unit_id: 'ut-m-1',
        custom_unit_name: '正の数・負の数 - 単元確認テスト',
        start_lesson_id: 'ut-m-1',
        end_lesson_id: 'ut-m-1',
        start_lesson_name: '正の数・負の数 - 単元確認テスト',
        end_lesson_name: '正の数・負の数 - 単元確認テスト',
        lesson_range: '正の数・負の数 - 単元確認テスト',
        lesson_ids: ['ut-m-1'],
        completed_lesson_ids: []
      };
      await db.saveLearningTasks([unitTestTask]);

      render(<StudentDashboard student={studentUt} initialDate={todayStr} onLogout={vi.fn()} />);

      const completeBtn = await screen.findByTestId('step-complete-btn-1-0');
      await act(async () => {
        fireEvent.click(completeBtn);
      });

      // 単元テストでは宿題は生成されない
      await waitFor(() => {
        expect(screen.queryByTestId('today-homework-card')).not.toBeInTheDocument();
      });

      const savedHws = db.getHomeworkResults().filter(h => h.student_id === studentUt.id && h.date === todayStr);
      expect(savedHws.length).toBe(0);
    });
  });
});
