import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db, Student, LearningTask, CurriculumMaster, MiniTestResult, StudentInteraction } from '../lib/db';
import { getDisplaySteps, getLessonRangeStepIds } from '../lib/scheduler';
import StudentDashboard from '../components/StudentDashboard';

describe('Meaningful Deep Healing & Student Dashboard 95%+ Coverage Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    db.clearLocalMockCache();
  });

  describe('1. 単元テスト合否ゲート・自己修復（cleanupStudentCorruptedCompletedLessonIds）', () => {
    it('中尾くん（student24295）の completed_lesson_ids から未合格の単元確認テストIDを物理除外して修復すること', async () => {
      const nakao: Student = {
        id: 'std-nakao-uuid-1234',
        student_id: 'student24295',
        name: '中尾 謙信',
        grade: '小5',
        level: 'A',
        school_id: 'sch-2',
        status: 'normal',
        completed_lesson_ids: [
          'cm-elem-1',
          'cm-elem-2',
          'cm-ut-1787378063799', // STEP 5 (かずと すうじ - 単元確認テスト)
          'cm-auto-ut-5',
          'cm-elem-3'
        ]
      };
      await db.saveStudent(nakao);

      // 合格していないテストIDの自己修復クリーンアップを実行
      const cleaned = await db.cleanupStudentCorruptedCompletedLessonIds(nakao.id, {
        unpassedTestIds: new Set(['cm-ut-1787378063799', 'cm-auto-ut-5'])
      });

      expect(cleaned).not.toBeNull();
      expect(cleaned?.completed_lesson_ids).toEqual(['cm-elem-1', 'cm-elem-2', 'cm-elem-3']);
      expect(cleaned?.completed_lesson_ids).not.toContain('cm-ut-1787378063799');
      expect(cleaned?.completed_lesson_ids).not.toContain('cm-auto-ut-5');
    });

    it('Supabase モードで student がローカルキャッシュにない場合、リモートから取得してクリーンアップすること', async () => {
      const mockSupabaseStudent = {
        id: '57185cba-972c-42dd-880d-8de7c2174a75',
        student_id: 'student24295',
        name: '中尾 謙信',
        grade: '小1',
        completed_lesson_ids: ['cm-1', 'cm-ut-unpassed', 'cm-2']
      };

      const originalIsMockMode = (db as any).isMockMode;
      const originalSupabase = (db as any).supabase;

      try {
        (db as any).isMockMode = false;
        (db as any).supabase = {
          from: (table: string) => {
            if (table === 'students') {
              return {
                select: () => ({
                  or: () => ({
                    maybeSingle: async () => ({ data: mockSupabaseStudent, error: null })
                  })
                }),
                update: (payload: any) => ({
                  eq: () => ({
                    select: () => ({
                      single: async () => ({ data: { ...mockSupabaseStudent, ...payload }, error: null })
                    })
                  })
                })
              };
            }
            if (table === 'mini_test_results') {
              return {
                select: () => ({
                  or: async () => ({ data: [], error: null })
                })
              };
            }
            return {};
          }
        };

        const res = await db.cleanupStudentCorruptedCompletedLessonIds('student24295', {
          unpassedTestIds: ['cm-ut-unpassed']
        });

        expect(res).not.toBeNull();
        expect(res?.completed_lesson_ids).not.toContain('cm-ut-unpassed');
      } finally {
        (db as any).isMockMode = originalIsMockMode;
        (db as any).supabase = originalSupabase;
      }
    });
  });

  describe('2. db.fetchLearningTasks の UUID 解決 & 日付フォーマット正規化', () => {
    it('非UUIDの student24295 表記から Supabase の UUID を解決し、タスクを取得・キャッシュ同期すること', async () => {
      const originalIsMockMode = (db as any).isMockMode;
      const originalSupabase = (db as any).supabase;

      const remoteTasks: LearningTask[] = [
        {
          id: 'task-rem-1',
          student_id: '57185cba-972c-42dd-880d-8de7c2174a75',
          scheduled_date: '2026-10-16',
          period: 3,
          subject: '国語',
          custom_unit_name: '。と、のつかい方 - 。と、のつかい方 〜 。と、のつかい方 - まとめテスト（２）',
          start_lesson_name: '。と、のつかい方 - 。と、のつかい方',
          end_lesson_name: '。と、のつかい方 - まとめテスト（２）',
          status: 'unstarted'
        }
      ];

      try {
        (db as any).isMockMode = false;
        (db as any).supabase = {
          from: (table: string) => {
            if (table === 'students') {
              return {
                select: () => ({
                  or: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { id: '57185cba-972c-42dd-880d-8de7c2174a75' },
                        error: null
                      })
                    })
                  })
                })
              };
            }
            if (table === 'learning_tasks') {
              return {
                select: () => ({
                  eq: (_col: string, _val: string) => ({
                    eq: async () => ({ data: remoteTasks, error: null })
                  })
                })
              };
            }
            return {};
          }
        };

        // student24295 と ISO形式の日付で呼び出し
        const tasks = await db.fetchLearningTasks('student24295', '2026-10-16T00:00:00.000Z');
        expect(tasks.length).toBe(1);
        expect(tasks[0].id).toBe('task-rem-1');
        expect(tasks[0].subject).toBe('国語');
      } finally {
        (db as any).isMockMode = originalIsMockMode;
        (db as any).supabase = originalSupabase;
      }
    });

    it('モックモードでも日付の正規化（YYYY-MM-DD）が安全に機能すること', async () => {
      const task: LearningTask = {
        id: 'task-mock-date-1',
        student_id: 'std-local-1',
        scheduled_date: '2026-10-16',
        period: 1,
        subject: '算数',
        status: 'unstarted'
      };
      await db.saveLearningTasks([task]);

      // ISO 文字列でクエリ
      const hit = await db.fetchLearningTasks('std-local-1', '2026-10-16T09:30:00Z');
      expect(hit.length).toBe(1);
      expect(hit[0].id).toBe('task-mock-date-1');

      // 通常の日付文字列でクエリ
      const hit2 = await db.fetchLearningTasks('std-local-1', '2026-10-16');
      expect(hit2.length).toBe(1);
    });
  });

  describe('3. 生徒学習画面（StudentDashboard）の国語コマ 3ステップ完全展開 & バナー条件', () => {
    it('国語コマ（コマ3: 。と、のつかい方 〜 まとめテスト(2)）が 3 ステップすべて描画されること', async () => {
      const student: Student = {
        id: 'std-nakao-student24295',
        student_id: 'student24295',
        name: '中尾 謙信',
        grade: '小1',
        level: 'A',
        school_id: 'sch-2',
        status: 'normal',
        completed_lesson_ids: []
      };
      await db.saveStudent(student);

      const task: LearningTask = {
        id: 'task-nakao-jp-period3',
        student_id: student.id,
        scheduled_date: '2026-10-16',
        period: 3,
        subject: '国語',
        start_lesson_name: '。と、のつかい方 - 。と、のつかい方',
        end_lesson_name: '。と、のつかい方 - まとめテスト（２）',
        custom_unit_name: '。と、のつかい方 - 。と、のつかい方 〜 。と、のつかい方 - まとめテスト（２）',
        lesson_range: '。と、のつかい方 - 。と、のつかい方 〜 。と、のつかい方 - まとめテスト（２）',
        status: 'unstarted'
      };
      await db.saveLearningTasks([task]);

      // 10/16 を初期日付として生徒画面をレンダリング
      render(
        <StudentDashboard
          student={student}
          initialDate="2026-10-16"
          onBackToPortal={() => {}}
        />
      );

      // 10/16 を開いたときはコマ割りタスクがあるため、「本日はコマ割りがありません」バナーは表示されないこと
      await waitFor(() => {
        expect(screen.queryByText(/本日はコマ割りがありません/)).not.toBeInTheDocument();
      });

      // コマ3（国語）の3ステップすべてが描画されていることを検証
      await waitFor(() => {
        expect(screen.getByTestId('period-row-3')).toBeInTheDocument();
        expect(screen.getByTestId('step-card-3-0')).toBeInTheDocument();
        expect(screen.getByTestId('step-card-3-1')).toBeInTheDocument();
        expect(screen.getByTestId('step-card-3-2')).toBeInTheDocument();
      });

      expect(screen.getByText('。と、のつかい方')).toBeInTheDocument();
      expect(screen.getByText('まとめテスト (1)')).toBeInTheDocument();
      expect(screen.getByText('まとめテスト (2)')).toBeInTheDocument();
    });

    it('今日（systemTodayStr）にタスクがない場合に自動フォールバックした時のみ案内バナーが表示され、日付変更で非表示になること', async () => {
      const student: Student = {
        id: 'std-test-auto-fallback',
        student_id: 'std-fallback',
        name: '自動フォールバック生徒',
        grade: '小5',
        level: 'A',
        school_id: 'sch-1',
        status: 'normal',
        completed_lesson_ids: []
      };
      await db.saveStudent(student);

      // 今日ではなく未来の日付にのみタスクを登録
      const futureDate = '2099-12-31';
      const futureTask: LearningTask = {
        id: 'task-future-1',
        student_id: student.id,
        scheduled_date: futureDate,
        period: 1,
        subject: '算数',
        start_lesson_name: '分数の乗除',
        status: 'unstarted'
      };
      await db.saveLearningTasks([futureTask]);

      // initialDate を指定せずに開く（自動フォールバックが発生）
      render(
        <StudentDashboard
          student={student}
          onBackToPortal={() => {}}
        />
      );

      // 自動フォールバックの案内バナーが表示されること
      await waitFor(() => {
        expect(screen.getByText(/本日はコマ割りがありません。直近の通塾予定日/)).toBeInTheDocument();
      });

      // ユーザーが手動で日付ピッカーを変更した場合は案内バナーが消えること
      const dateInput = screen.getByTestId('student-date-picker');
      fireEvent.change(dateInput, { target: { value: '2099-12-30' } });

      await waitFor(() => {
        expect(screen.queryByText(/本日はコマ割りがありません。直近の通塾予定日/)).not.toBeInTheDocument();
      });
    });
  });

  describe('4. db.saveStudentInteraction の全ブランチ & エラーフォールバック網羅', () => {
    it('Supabase モードで upsert, insert, update contact_logs の各フォールバックを網羅すること', async () => {
      const originalIsMockMode = (db as any).isMockMode;
      const originalSupabase = (db as any).supabase;

      const interaction: StudentInteraction = {
        id: 'si-1',
        student_id: 'std-1',
        sender: 'teacher',
        content: 'テスト連絡',
        created_at: new Date().toISOString()
      };

      try {
        // Step 1: upsert 成功
        (db as any).isMockMode = false;
        (db as any).supabase = {
          from: () => ({
            upsert: () => ({ select: () => ({ single: async () => ({ data: interaction, error: null }) }) })
          })
        };
        const r1 = await db.saveStudentInteraction(interaction);
        expect(r1.id).toBe('si-1');

        // Step 2: upsert 失敗 -> insert 成功
        (db as any).supabase = {
          from: () => ({
            upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'upsert fail' } }) }) }),
            insert: () => ({ select: () => ({ single: async () => ({ data: interaction, error: null }) }) })
          })
        };
        const r2 = await db.saveStudentInteraction(interaction);
        expect(r2.id).toBe('si-1');

        // Step 3: upsert 失敗 & insert 失敗 -> students.contact_logs update 成功
        (db as any).supabase = {
          from: (tbl: string) => {
            if (tbl === 'students') {
              return {
                select: () => ({ eq: () => ({ single: async () => ({ data: { contact_logs: [] }, error: null }) }) }),
                update: () => ({ eq: async () => ({ error: null }) })
              };
            }
            return {
              upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'upsert fail' } }) }) }),
              insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'insert fail' } }) }) })
            };
          }
        };
        const r3 = await db.saveStudentInteraction(interaction);
        expect(r3.id).toBe('si-1');

        // Step 4: 全て失敗した場合に例外がスローされること
        (db as any).supabase = {
          from: (tbl: string) => {
            if (tbl === 'students') {
              return {
                select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'student fail' } }) }) }),
                update: () => ({ eq: async () => ({ error: { message: 'student update fail' } }) })
              };
            }
            return {
              upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'critical error' } }) }) }),
              insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'critical error' } }) }) })
            };
          }
        };
        await expect(db.saveStudentInteraction(interaction)).rejects.toThrow();
      } finally {
        (db as any).isMockMode = originalIsMockMode;
        (db as any).supabase = originalSupabase;
      }
    });

    it('モックモードで StudentInteraction の CRUD 操作が正常に行えること', async () => {
      const interaction: StudentInteraction = {
        id: 'si-mock-test',
        student_id: 'std-mock',
        sender: 'teacher',
        content: 'モック連絡内容',
        created_at: new Date().toISOString()
      };
      await db.saveStudentInteraction(interaction);
      const list = db.getStudentInteractions('std-mock');
      expect(list.some(i => i.id === 'si-mock-test')).toBe(true);

      const fetched = await db.fetchStudentInteractions('std-mock');
      expect(fetched.some(i => i.id === 'si-mock-test')).toBe(true);

      await db.deleteStudentInteraction('si-mock-test');
      expect(db.getStudentInteractions('std-mock').some(i => i.id === 'si-mock-test')).toBe(false);
    });
  });

  describe('5. scheduler.ts getLessonRangeStepIds の動的展開ユニットテスト', () => {
    it('通常授業 〜 まとめテスト(2) の指定に対し、マスター不在時でも全3ステップが展開されること', () => {
      const slot = {
        subject: '国語',
        start_lesson_name: '。と、のつかい方 - 。と、のつかい方',
        end_lesson_name: '。と、のつかい方 - まとめテスト（２）',
        custom_unit_name: '。と、のつかい方 - 。と、のつかい方 〜 。と、のつかい方 - まとめテスト（２）'
      };

      const steps = getDisplaySteps(slot, { studentGrade: '小1' });
      expect(steps.length).toBe(3);
      expect(steps[0].name).toContain('。と、のつかい方');
      expect(steps[1].name).toContain('まとめテスト (1)');
      expect(steps[2].name).toContain('まとめテスト (2)');
    });

    it('まとめテスト(1) 〜 まとめテスト(2) の指定に対し、2ステップが展開されること', () => {
      const slot = {
        subject: '国語',
        start_lesson_name: '文のきまり - まとめテスト(1)',
        end_lesson_name: '文のきまり - まとめテスト(2)'
      };

      const steps = getDisplaySteps(slot, { studentGrade: '小1' });
      expect(steps.length).toBe(2);
      expect(steps[0].name).toContain('まとめテスト (1)');
      expect(steps[1].name).toContain('まとめテスト (2)');
    });

    it('通常授業 〜 まとめテスト(1) の指定に対し、2ステップが展開されること', () => {
      const slot = {
        subject: '国語',
        start_lesson_name: 'ことばのきまり',
        end_lesson_name: 'ことばのきまり - まとめテスト(1)'
      };

      const steps = getDisplaySteps(slot, { studentGrade: '小1' });
      expect(steps.length).toBe(2);
      expect(steps[0].name).toContain('ことばのきまり');
      expect(steps[1].name).toContain('まとめテスト (1)');
    });
  });
});
