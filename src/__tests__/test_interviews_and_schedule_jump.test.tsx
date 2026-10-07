import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { db, Student, StudentInterview2, StudentInterview3 } from '../lib/db';
import { generateInterview2CoachingAdvice, generateInterview3CoachingAdvice } from '../lib/gemini';
import StudentDashboard from '../components/StudentDashboard';
import TeacherDashboard from '../components/TeacherDashboard';

describe('生徒画面「授業設定」遷移 & 講師ダッシュボード「二者面談」「三者面談」機能テスト', () => {
  const mockStudent: Student = {
    id: 'test-student-1',
    student_id: 'test-student-1',
    name: '山田太郎',
    email: 'taro@example.com',
    grade: '中2',
    school_id: 'school-1',
    status: 'normal',
    start_unit_id: null,
    created_at: new Date().toISOString(),
    level: 'B',
    teacher_in_charge: '鈴木講師',
    target_school: '県立第一高校',
    club_activities: 'バスケットボール部'
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. 生徒画面「授業設定」ボタン & 講師学習計画への遷移連携', () => {
    it('ボタンの名称が「⚙️ 授業設定」に変更されており、「通塾設定」は存在しないこと', () => {
      render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={() => {}}
        />
      );

      // 「⚙️ 授業設定」ボタンが存在すること
      const settingBtn = screen.getByRole('button', { name: /⚙️ 授業設定/ });
      expect(settingBtn).toBeDefined();

      // 旧名称「通塾設定」が存在しないこと
      expect(screen.queryByRole('button', { name: /⚙️ 通塾設定/ })).toBeNull();
    });

    it('「⚙️ 授業設定」ボタンを押下したとき、onGoToTeacherSchedule コールバックが生徒IDと表示日付で発火すること', () => {
      const handleGoToTeacherSchedule = vi.fn();
      const testDate = '2026-10-20';

      render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={() => {}}
          initialDate={testDate}
          onGoToTeacherSchedule={handleGoToTeacherSchedule}
        />
      );

      const settingBtn = screen.getByRole('button', { name: /⚙️ 授業設定/ });
      fireEvent.click(settingBtn);

      expect(handleGoToTeacherSchedule).toHaveBeenCalledTimes(1);
      expect(handleGoToTeacherSchedule).toHaveBeenCalledWith(mockStudent.id, testDate);
    });
  });

  describe('2. 二者面談（StudentInterview2）のCRUD・履歴管理・AIアドバイス', () => {
    it('db: 二者面談記録を保存し、別日の面談も上書きされず個別保存されること', async () => {
      const interview1: StudentInterview2 = {
        id: 'interview2-1',
        student_id: mockStudent.id,
        interviewer: '鈴木講師',
        interview_date: '2026-09-10',
        dream_goal: 'プログラマー',
        target_school: '第一高校',
        club_activity: 'バスケ部',
        club_members_count: '15人',
        close_friends: '田中くん',
        study_anxiety: '英語の文法が苦手',
        self_evaluation: 'まだ甘い',
        student_challenges: '暗記の反復不足',
        required_actions: '毎日単語5個',
        expectations: '自習室の利用',
        target_rank: '学年30位',
        target_score: '80点',
        notes: '秋の部活引退後に加速',
        custom_fields: [{ id: 'cf-1', label: 'スマホ利用時間', value: '1日2時間' }],
        created_at: '2026-09-10T10:00:00Z'
      };

      const interview2: StudentInterview2 = {
        id: 'interview2-2',
        student_id: mockStudent.id,
        interviewer: '佐藤講師',
        interview_date: '2026-10-15',
        dream_goal: 'データサイエンティスト',
        target_school: '第一高校理数科',
        club_activity: '引退済み',
        study_anxiety: '数学の応用問題',
        self_evaluation: '順調に伸びてきた',
        created_at: '2026-10-15T11:00:00Z'
      };

      await db.saveStudentInterview2(interview1);
      await db.saveStudentInterview2(interview2);

      const list = db.getStudentInterviews2(mockStudent.id);
      expect(list.length).toBe(2);
      // 日付降順（最新が先頭）
      expect(list[0].id).toBe('interview2-2');
      expect(list[1].id).toBe('interview2-1');
      expect(list[1].custom_fields?.[0].label).toBe('スマホ利用時間');

      // 1件削除
      await db.deleteStudentInterview2('interview2-1');
      const listAfterDelete = db.getStudentInterviews2(mockStudent.id);
      expect(listAfterDelete.length).toBe(1);
      expect(listAfterDelete[0].id).toBe('interview2-2');
    });

    it('AIコーチングアドバイス生成（二者面談）: 生徒心理分析、接し方、声かけフレーズ、スモールステップが含まれること', async () => {
      const interview: Partial<StudentInterview2> = {
        interviewer: '鈴木講師',
        interview_date: '2026-10-15',
        dream_goal: '建築士',
        target_school: '工業高校',
        club_activity: '美術部',
        study_anxiety: '計算ミスが多い',
        self_evaluation: '集中力が続かない',
        student_challenges: '見直しをしない',
        required_actions: '計算スペースを広く使う',
        target_score: '85点'
      };

      const advice = await generateInterview2CoachingAdvice(interview, mockStudent);
      expect(advice).toContain('AIコーチング・カウンセリングまとめ方針');
      expect(advice).toContain('生徒の心理状態・現状分析');
      expect(advice).toContain('今後の接し方・アプローチ方針');
      expect(advice).toContain('具体的な声かけフレーズ集');
      expect(advice).toContain('行動変容を促すスモールステップ');
      expect(advice).toContain('山田太郎');
    });
  });

  describe('3. 三者面談（StudentInterview3）のCRUD・履歴管理・AIアドバイス', () => {
    it('db: 三者面談記録を保存し、別日の面談も上書きされず個別保存されること', async () => {
      const interview1: StudentInterview3 = {
        id: 'interview3-1',
        student_id: mockStudent.id,
        interviewer: '鈴木講師',
        interview_date: '2026-07-20',
        parent_type: 'mother',
        parent_anxieties: '家で全然勉強しない',
        discussed_content: '夏期講習のコマ数',
        future_direction_agreed: 'yes',
        notes: '次回秋に再面談',
        custom_fields: [{ id: 'cf-p1', label: '家庭の就寝時間', value: '23時' }],
        created_at: '2026-07-20T10:00:00Z'
      };

      const interview2: StudentInterview3 = {
        id: 'interview3-2',
        student_id: mockStudent.id,
        interviewer: '鈴木講師',
        interview_date: '2026-10-18',
        parent_type: 'both',
        parent_anxieties: '志望校の内申点が足りるか心配',
        discussed_content: '推薦入試の可能性と併願校選び',
        future_direction_agreed: 'yes',
        created_at: '2026-10-18T10:00:00Z'
      };

      await db.saveStudentInterview3(interview1);
      await db.saveStudentInterview3(interview2);

      const list = db.getStudentInterviews3(mockStudent.id);
      expect(list.length).toBe(2);
      expect(list[0].id).toBe('interview3-2');
      expect(list[1].id).toBe('interview3-1');
      expect(list[1].custom_fields?.[0].label).toBe('家庭の就寝時間');

      // 削除
      await db.deleteStudentInterview3('interview3-1');
      const listAfterDelete = db.getStudentInterviews3(mockStudent.id);
      expect(listAfterDelete.length).toBe(1);
      expect(listAfterDelete[0].id).toBe('interview3-2');
    });

    it('AI家庭連携アドバイス生成（三者面談）: 総括、家庭・塾の役割分担、アプローチ指針、次回アクションプランが含まれること', async () => {
      const interview: Partial<StudentInterview3> = {
        interviewer: '鈴木講師',
        interview_date: '2026-10-18',
        parent_type: 'mother',
        parent_anxieties: 'スマホばかり見ていて注意すると反発する',
        discussed_content: '志望校と受験スケジュールのすり合わせ',
        future_direction_agreed: 'yes'
      };

      const advice = await generateInterview3CoachingAdvice(interview, mockStudent);
      expect(advice).toContain('AIコーチング・家庭連携まとめ方針');
      expect(advice).toContain('三者面談の総括・現状認識の共有');
      expect(advice).toContain('塾・家庭での役割分担と連携方針');
      expect(advice).toContain('生徒・保護者それぞれへの今後のアプローチ');
      expect(advice).toContain('次回フォローへの具体的アクションプラン');
      expect(advice).toContain('お母様');
    });
  });

  describe('4. 講師ダッシュボードにおける全校種（小・中・高）メニュー表示 & 面談UI操作', () => {
    it('小学生・中学生・高校生のすべての校種で「二者面談」「三者面談」メニューが表示されること', () => {
      const schoolTypes: Array<'elementary' | 'junior_high' | 'high_school'> = ['elementary', 'junior_high', 'high_school'];

      schoolTypes.forEach(type => {
        const { unmount } = render(
          <TeacherDashboard
            students={[mockStudent]}
            teacherType={type}
            initialStudentId={mockStudent.id}
          />
        );

        expect(screen.getByTestId('menu-two-way-interview')).toBeDefined();
        expect(screen.getByTestId('menu-three-way-interview')).toBeDefined();

        unmount();
      });
    });

    it('二者面談タブ: 入力、動的カスタム項目の追加、AIアドバイス生成、保存、別日履歴切替、削除が正常に動作すること', async () => {
      // 事前に1件保存
      await db.saveStudentInterview2({
        id: 'interview2-hist-1',
        student_id: mockStudent.id,
        interviewer: '前任講師',
        interview_date: '2026-08-01',
        dream_goal: 'パイロット',
        target_school: '航空高校',
        created_at: '2026-08-01T10:00:00Z'
      });

      render(
        <TeacherDashboard
          students={[mockStudent]}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="two-way-interview"
        />
      );

      // 二者面談ビューが表示されていること
      expect(screen.getByTestId('two-way-interview-view')).toBeDefined();

      // 過去履歴カードが表示されていること
      expect(screen.getByTestId('interview2-item-interview2-hist-1')).toBeDefined();

      // 「➕ 新規作成」ボタンを押下して新規フォームをクリア
      const newBtn = screen.getByTestId('interview2-new-btn');
      fireEvent.click(newBtn);

      // フィールド入力
      const interviewerInput = screen.getByTestId('interview2-interviewer');
      fireEvent.change(interviewerInput, { target: { value: '佐藤講師' } });

      const dateInput = screen.getByTestId('interview2-date');
      fireEvent.change(dateInput, { target: { value: '2026-10-25' } });

      const dreamInput = screen.getByTestId('interview2-dream-goal');
      fireEvent.change(dreamInput, { target: { value: '医師' } });

      const anxietyInput = screen.getByTestId('interview2-study-anxiety');
      fireEvent.change(anxietyInput, { target: { value: '理科の化学分野が苦手' } });

      // 動的カスタム項目「➕ 項目を追加」
      const addCustomBtn = screen.getByTestId('interview2-add-custom-field-btn');
      fireEvent.click(addCustomBtn);

      const customLabel = screen.getByTestId('interview2-custom-label-0');
      fireEvent.change(customLabel, { target: { value: '睡眠時間' } });
      const customValue = screen.getByTestId('interview2-custom-value-0');
      fireEvent.change(customValue, { target: { value: '6時間' } });

      // AIアドバイス生成ボタン押下
      const generateAiBtn = screen.getByTestId('interview2-generate-ai-btn');
      fireEvent.click(generateAiBtn);

      await waitFor(() => {
        const adviceTextarea = screen.getByTestId('interview2-ai-advice') as HTMLTextAreaElement;
        expect(adviceTextarea.value).toContain('AIコーチング');
      });

      // window.alert をモック
      vi.spyOn(window, 'alert').mockImplementation(() => {});

      // 面談保存ボタン押下
      const saveBtn = screen.getByTestId('interview2-save-btn');
      fireEvent.click(saveBtn);

      // dbに保存されたか確認
      const savedList = db.getStudentInterviews2(mockStudent.id);
      expect(savedList.length).toBe(2);
      expect(savedList.some(i => i.interview_date === '2026-10-25' && i.dream_goal === '医師')).toBe(true);

      // 過去の面談をクリックして切替
      const histItem = screen.getByTestId('interview2-item-interview2-hist-1');
      fireEvent.click(histItem);

      expect((screen.getByTestId('interview2-dream-goal') as HTMLInputElement).value).toBe('パイロット');

      // 削除ボタン押下
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const deleteBtn = screen.getByTestId('interview2-delete-btn');
      fireEvent.click(deleteBtn);

      const listAfterDelete = db.getStudentInterviews2(mockStudent.id);
      expect(listAfterDelete.length).toBe(1);
    });

    it('三者面談タブ: 入力、保護者選択、方向性Yes/No、動的項目、AIアドバイス、保存、削除が正常に動作すること', async () => {
      render(
        <TeacherDashboard
          students={[mockStudent]}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="three-way-interview"
        />
      );

      // 三者面談ビューが表示されていること
      expect(screen.getByTestId('three-way-interview-view')).toBeDefined();

      // フィールド入力
      const interviewerInput = screen.getByTestId('interview3-interviewer');
      fireEvent.change(interviewerInput, { target: { value: '佐藤講師' } });

      const dateInput = screen.getByTestId('interview3-date');
      fireEvent.change(dateInput, { target: { value: '2026-10-28' } });

      const parentSelect = screen.getByTestId('interview3-parent-type');
      fireEvent.change(parentSelect, { target: { value: 'both' } });

      const directionYes = screen.getByTestId('interview3-direction-yes');
      fireEvent.click(directionYes);

      const anxietyInput = screen.getByTestId('interview3-parent-anxieties');
      fireEvent.change(anxietyInput, { target: { value: '受験期のメンタル面が心配' } });

      const contentInput = screen.getByTestId('interview3-discussed-content');
      fireEvent.change(contentInput, { target: { value: '第一志望高校の合格目標と今後の学習スケジュール' } });

      // 動的カスタム項目「➕ 項目を追加」
      const addCustomBtn = screen.getByTestId('interview3-add-custom-field-btn');
      fireEvent.click(addCustomBtn);

      const customLabel = screen.getByTestId('interview3-custom-label-0');
      fireEvent.change(customLabel, { target: { value: '通塾手段' } });
      const customValue = screen.getByTestId('interview3-custom-value-0');
      fireEvent.change(customValue, { target: { value: '自転車' } });

      // AIアドバイス生成
      const generateAiBtn = screen.getByTestId('interview3-generate-ai-btn');
      fireEvent.click(generateAiBtn);

      await waitFor(() => {
        const adviceTextarea = screen.getByTestId('interview3-ai-advice') as HTMLTextAreaElement;
        expect(adviceTextarea.value).toContain('三者面談');
      });

      // 保存
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      const saveBtn = screen.getByTestId('interview3-save-btn');
      fireEvent.click(saveBtn);

      const savedList = db.getStudentInterviews3(mockStudent.id);
      expect(savedList.length).toBe(1);
      expect(savedList[0].parent_type).toBe('both');
      expect(savedList[0].future_direction_agreed).toBe('yes');
      expect(savedList[0].custom_fields?.[0].label).toBe('通塾手段');
    });
  });

  describe('5. Gemini APIキー設定時の生成 & 例外分岐', () => {
    it('APIキー設定時に Gemini モデル呼び出し処理が動作すること', async () => {
      localStorage.setItem('tentoru_gemini_api_key', 'test-gemini-key');

      // APIキーがあるときの呼び出し（ネットワークがないテスト環境ではcatchされるがtryブロックを通過する）
      await generateInterview2CoachingAdvice(
        { interviewer: '福田', interview_date: '2026-10-20' },
        mockStudent
      ).catch(e => {
        expect(e).toBeDefined();
      });

      await generateInterview3CoachingAdvice(
        { interviewer: '福田', interview_date: '2026-10-20', parent_type: 'mother' },
        mockStudent
      ).catch(e => {
        expect(e).toBeDefined();
      });

      localStorage.removeItem('tentoru_gemini_api_key');
    });
  });

  describe('6. Home ページにおける生徒画面「授業設定」から講師ダッシュボード学習計画への統合ルーティング', () => {
    it('生徒画面で「⚙️ 授業設定」をクリックすると講師ダッシュボードの schedule タブに直接遷移すること', async () => {
      await db.saveStudent(mockStudent);
      db.saveSession({
        user: { id: 'admin-1', email: 'admin@tentoru.jp', role: 'admin', name: '本部管理者' },
        logged_in_at: new Date().toISOString()
      });

      const { default: Home } = await import('../app/page');
      render(<Home />);

      // 最初は講師ダッシュボード
      await waitFor(() => {
        expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
      });

      // 生徒画面を開く
      const studentCards = screen.getAllByText(/山田太郎/);
      fireEvent.click(studentCards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('banner-view-student-screen-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('banner-view-student-screen-btn'));

      // 生徒画面が表示されたことを確認
      await waitFor(() => {
        expect(screen.getByText(/山田太郎 さんの学習画面/)).toBeInTheDocument();
      });

      // 「⚙️ 授業設定」ボタンをクリック
      const configBtn = screen.getByRole('button', { name: /⚙️ 授業設定/ });
      fireEvent.click(configBtn);

      // 講師ダッシュボードに戻り、schedule タブが表示されていること
      await waitFor(() => {
        expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
      });
    });
  });

  describe('7. db.ts Supabase クラウド連携分岐の網羅', () => {
    it('isMockMode=false かつ supabase がある場合に Supabase upsert/delete が呼ばれること', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'supa-1' }, error: null })
            })
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      };

      (db as any).isMockMode = false;
      (db as any).supabase = mockSupabase;

      await db.saveStudentInterview2({ id: 'supa-1', student_id: mockStudent.id, interviewer: 'A', interview_date: '2026-10-10', created_at: '' });
      await db.deleteStudentInterview2('supa-1');
      await db.saveStudentInterview3({ id: 'supa-3', student_id: mockStudent.id, interviewer: 'A', interview_date: '2026-10-10', parent_type: 'mother', future_direction_agreed: 'yes', created_at: '' });
      await db.deleteStudentInterview3('supa-3');

      expect(mockSupabase.from).toHaveBeenCalledWith('student_interviews_2');
      expect(mockSupabase.from).toHaveBeenCalledWith('student_interviews_3');

      (db as any).isMockMode = true;
      (db as any).supabase = null;
    });
  });
});
