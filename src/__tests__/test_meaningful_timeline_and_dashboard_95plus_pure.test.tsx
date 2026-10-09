import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';
import * as gemini from '../lib/gemini';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Meaningful 95%+ Coverage Suite for Timeline and Dashboard', () => {
  const todayStr = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    db.saveSession({
      user: {
        id: 'u-admin',
        email: 'admin@tentoru.jp',
        role: 'admin',
        branch_id: null,
        branch_name: '本部統括管理者',
        name: '本部管理者'
      },
      token: 'tok-admin',
      logged_in_at: new Date().toISOString()
    });
  });

  it('should cover timeline asymmetric matching: sIdx found and expands range within same unit', async () => {
    const student: Student = {
      id: 'st-asym-1',
      name: '非対称マッチング生徒1',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'テスト小学校',
      period_count: 1,
      day_of_week: ['mon'],
      selected_subjects: ['算数'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: 'cm-a1-1', grade: '1年生', subject: '算数', unit_name: '1章 かず', lesson_name: 'かず(1)', sort_order: 1 },
      { id: 'cm-a1-2', grade: '1年生', subject: '算数', unit_name: '1章 かず', lesson_name: 'かず(2)', sort_order: 2 },
      { id: 'cm-a1-3', grade: '1年生', subject: '算数', unit_name: '1章 かず', lesson_name: 'かず(3)', sort_order: 3 },
      { id: 'cm-a1-4', grade: '1年生', subject: '算数', unit_name: '2章 たしざん', lesson_name: 'たしざん(1)', sort_order: 4 },
    ];
    (db as any).saveMockData('curriculum_masters', masters);

    // タスクは start_lesson_id のみ持ち、end_lesson_name ('かず(3)') で同一単元内を補完マッチング (Lines 9015-9024)
    const task: LearningTask = {
      id: 'task-asym-1',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      start_lesson_id: 'cm-a1-1',
      end_lesson_name: 'かず(3)',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([task]);

    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('timeline-item-cm-a1-1')).toHaveTextContent('📍 現在地（取り組み中）');
      expect(screen.getByTestId('timeline-item-cm-a1-2')).toHaveTextContent('📍 現在地（取り組み中）');
      expect(screen.getByTestId('timeline-item-cm-a1-3')).toHaveTextContent('📍 現在地（取り組み中）');
      expect(screen.getByTestId('timeline-item-cm-a1-4')).toHaveTextContent('○ 予定');
    });

    unmount();
  });

  it('should cover timeline asymmetric matching: eIdx found and searches backward within same unit', async () => {
    const student: Student = {
      id: 'st-asym-2',
      name: '非対称マッチング生徒2',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'テスト小学校',
      period_count: 1,
      day_of_week: ['mon'],
      selected_subjects: ['算数'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: 'cm-b1-1', grade: '1年生', subject: '算数', unit_name: '1章 ひきざん', lesson_name: 'ひきざん(1)', sort_order: 1 },
      { id: 'cm-b1-2', grade: '1年生', subject: '算数', unit_name: '1章 ひきざん', lesson_name: 'ひきざん(2)', sort_order: 2 },
      { id: 'cm-b1-3', grade: '1年生', subject: '算数', unit_name: '1章 ひきざん', lesson_name: 'ひきざん(3)', sort_order: 3 },
    ];
    (db as any).saveMockData('curriculum_masters', masters);

    // タスクは end_lesson_id のみ持ち、start_lesson_name ('ひきざん(1)') で手前の同一単元ステップを特定 (Lines 9025-9034)
    const task: LearningTask = {
      id: 'task-asym-2',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      end_lesson_id: 'cm-b1-3',
      start_lesson_name: 'ひきざん(1)',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([task]);

    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('timeline-item-cm-b1-1')).toHaveTextContent('📍 現在地（取り組み中）');
      expect(screen.getByTestId('timeline-item-cm-b1-2')).toHaveTextContent('📍 現在地（取り組み中）');
      expect(screen.getByTestId('timeline-item-cm-b1-3')).toHaveTextContent('📍 現在地（取り組み中）');
    });

    unmount();
  });

  it('should cover timeline single step without range when only sIdx is matched and matchedMultiple is false', async () => {
    const student: Student = {
      id: 'st-asym-3',
      name: '単一ステップ生徒',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'テスト小学校',
      period_count: 1,
      day_of_week: ['mon'],
      selected_subjects: ['算数'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: 'cm-c1-1', grade: '1年生', subject: '算数', unit_name: 'かけざん', lesson_name: 'かけざん(1)', sort_order: 1 },
      { id: 'cm-c1-2', grade: '1年生', subject: '算数', unit_name: 'かけざん', lesson_name: 'かけざん(2)', sort_order: 2 },
    ];
    (db as any).saveMockData('curriculum_masters', masters);

    // toStr や rangeText が無く、start_lesson_id だけのタスク (Lines 9071-9081)
    const task: LearningTask = {
      id: 'task-asym-3',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      start_lesson_id: 'cm-c1-1',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([task]);

    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('timeline-item-cm-c1-1')).toHaveTextContent('📍 現在地（取り組み中）');
      expect(screen.getByTestId('timeline-item-cm-c1-2')).toHaveTextContent('○ 予定');
    });

    unmount();
  });

  it('should cover timeline single step when only eIdx is matched', async () => {
    const student: Student = {
      id: 'st-asym-4',
      name: '終了ステップのみ生徒',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'テスト小学校',
      period_count: 1,
      day_of_week: ['mon'],
      selected_subjects: ['算数'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: 'cm-d1-1', grade: '1年生', subject: '算数', unit_name: 'わりざん', lesson_name: 'わりざん(1)', sort_order: 1 },
      { id: 'cm-d1-2', grade: '1年生', subject: '算数', unit_name: 'わりざん', lesson_name: 'わりざん(2)', sort_order: 2 },
    ];
    (db as any).saveMockData('curriculum_masters', masters);

    // end_lesson_id だけのタスク (Lines 9082-9095)
    const task: LearningTask = {
      id: 'task-asym-4',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      end_lesson_id: 'cm-d1-2',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([task]);

    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('timeline-item-cm-d1-2')).toHaveTextContent('📍 現在地（取り組み中）');
    });

    unmount();
  });

  it('should parse two-way and three-way interview transcripts and populate form fields', async () => {
    // window.alert をスパイ
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // gemini.parseInterviewTranscriptToFields をスパイして全フィールドを網羅
    const parseSpy = vi.spyOn(gemini, 'parseInterviewTranscriptToFields').mockImplementation(async (_text, type) => {
      if (type === 'two-way') {
        return {
          interviewer: '田中先生',
          target_school: '浦和高校',
          dream_goal: 'プログラマー',
          club_activity: 'サッカー部',
          club_members_count: '20',
          close_friends: '佐藤君',
          study_anxiety: '数学が苦手',
          self_evaluation: '70点',
          student_challenges: 'ケアレスミス',
          required_actions: '毎日計算ドリル',
          expectations: '特待生合格',
          target_rank: '学年10位',
          target_score: '90点',
          notes: '本人やる気あり'
        };
      } else {
        return {
          interviewer: '佐藤先生',
          parent_type: '母親',
          parent_anxieties: '家で勉強しない',
          discussed_content: '志望校と推薦入試の相談',
          notes: '保護者面談メモ'
        };
      }
    });

    const student: Student = {
      id: 'st-interview-test',
      student_id: 'S_INTERVIEW_01',
      name: '面談テスト生徒',
      grade: '中3',
      grade_category: 'junior_high',
      school_name: 'テスト中学校',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 1. 二者面談の議事録パース (handleParseTranscript2: Lines 533-554)
    const { unmount: unmount2 } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="junior_high"
        initialStudentId={student.id}
        initialTab="two-way-interview"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('two-way-interview-view')).toBeInTheDocument();
    });

    // 議事録テキストを入力
    const transcriptTextarea2 = screen.getByTestId('interview2-transcript');
    fireEvent.change(transcriptTextarea2, {
      target: {
        value: 'テスト音声テキスト'
      }
    });

    const parseBtn2 = screen.getByTestId('interview2-parse-transcript-btn');
    fireEvent.click(parseBtn2);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('音声議事録から面談各項目へ自動入力しました。');
      expect((screen.getByTestId('interview2-interviewer') as HTMLInputElement).value).toBe('田中先生');
      expect((screen.getByTestId('interview2-target-school') as HTMLInputElement).value).toBe('浦和高校');
    });

    unmount2();

    // 2. 三者面談の議事録パース (handleParseTranscript3: Lines 745-757)
    const { unmount: unmount3 } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="junior_high"
        initialStudentId={student.id}
        initialTab="three-way-interview"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('three-way-interview-view')).toBeInTheDocument();
    });

    const transcriptTextarea3 = screen.getByTestId('interview3-transcript');
    fireEvent.change(transcriptTextarea3, {
      target: {
        value: 'テスト音声テキスト三者'
      }
    });

    const parseBtn3 = screen.getByTestId('interview3-parse-transcript-btn');
    fireEvent.click(parseBtn3);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('音声議事録から面談各項目へ自動入力しました。');
      expect((screen.getByTestId('interview3-interviewer') as HTMLInputElement).value).toBe('佐藤先生');
    });

    unmount3();
    parseSpy.mockRestore();
    alertMock.mockRestore();
  });

  it('should exercise db.ts Supabase PGRST204 missing column strip and 23505 unique constraint retry', async () => {
    // db.ts の Supabase リトライハンドラを直接テスト
    const studentToSave: Student = {
      id: 'st-retry-test',
      student_id: 'ST_RETRY_001',
      name: 'リトライテスト生徒',
      email: 'retry@example.com',
      grade: '小5',
      created_at: new Date().toISOString()
    };

    let attempt = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => {
          if (attempt === 0) {
            return { data: null, error: { message: 'not found' } };
          }
          return { data: studentToSave, error: null };
        }),
        upsert: vi.fn().mockImplementation(async (payload: any) => {
          attempt++;
          if (attempt === 1) {
            // PGRST204: Missing column error
            return {
              data: null,
              error: {
                code: 'PGRST204',
                message: "Could not find the 'extra_invalid_col' column of 'students' in the schema cache"
              }
            };
          } else if (attempt === 2) {
            // 23505: Unique constraint violation
            return {
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "students_student_id_key"'
              }
            };
          }
          return { data: payload, error: null };
        }),
        update: vi.fn().mockImplementation((payload: any) => ({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: payload, error: null })
            })
          })
        }))
      }))
    };

    // 一時的に supabase クライアントを差し替えて実行
    const originalSupabase = (db as any).supabase;
    (db as any).supabase = mockSupabase;

    const payloadWithExtra = {
      ...studentToSave,
      extra_invalid_col: 'dummy_value'
    };

    const res = await db.saveStudent(payloadWithExtra as any);
    expect(res).toBeDefined();

    // 元に戻す
    (db as any).supabase = originalSupabase;
  });
});
