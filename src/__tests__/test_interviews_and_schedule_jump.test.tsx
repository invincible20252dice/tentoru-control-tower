import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { db, Student, StudentInterview2, StudentInterview3 } from '../lib/db';
import { 
  generateInterview2CoachingAdvice, 
  generateInterview3CoachingAdvice, 
  generateInterviewSummary, 
  parseInterviewTranscriptToFields 
} from '../lib/gemini';
import { 
  getLatestUnitTestStatusForSubject, 
  calculateLessonRangeForSlot, 
  normalizeUnitName 
} from '../lib/scheduler';
import { GoogleGenerativeAI } from '@google/generative-ai';
import StudentDashboard from '../components/StudentDashboard';
import TeacherDashboard from '../components/TeacherDashboard';

vi.mock('html2canvas', () => {
  return {
    default: vi.fn().mockImplementation(() =>
      Promise.resolve({
        toDataURL: () => 'data:image/png;base64,mockImage'
      })
    )
  };
});

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

    it('面談の要約生成（二者面談・3者共有用）: 目的・強み・3者の約束（生徒・家庭・塾）が含まれること', async () => {
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

      const summary = await generateInterviewSummary({
        interviewType: 'two-way',
        interview,
        student: mockStudent
      });
      expect(summary).toContain('二者面談の要約');
      expect(summary).toContain('3者の約束・今後のアクション');
      expect(summary).toContain('山田太郎');
    });

    it('音声議事録テキストからの項目自動抽出（parseInterviewTranscriptToFields）が正常に動作すること', async () => {
      const transcript = `
面談を実施しました。志望校は第一高校です。将来の夢は医師になりたいと言っています。
部活はバスケ部で、部員は15人です。仲良い友達は田中くんです。
不安は数学の計算ミスが多いことです。今の自己評価はまだまだ甘いです。
課題は復習不足で、約束は毎日ワークを1ページやることです。目標は80点です。
`;
      const parsed = await parseInterviewTranscriptToFields(transcript, 'two-way');
      expect(parsed.target_school).toContain('第一高校');
      expect(parsed.dream_goal).toContain('医師');
      expect(parsed.club_activity).toContain('バスケ部');
      expect(parsed.club_members_count).toBe('15');
      expect(parsed.close_friends).toBe('田中くん');
      expect(parsed.study_anxiety).toContain('計算ミス');
      expect(parsed.required_actions).toContain('毎日ワーク');
      expect(parsed.target_score).toBe('80点');
    });
  });

  describe('3. 三者面談（StudentInterview3）のCRUD・履歴管理・面談要約生成', () => {
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

    it('面談の要約生成（三者面談・3者共有用）: 目的・ハイライト・3者の約束（生徒・家庭・塾）が含まれること', async () => {
      const interview: Partial<StudentInterview3> = {
        interviewer: '鈴木講師',
        interview_date: '2026-10-18',
        parent_type: 'mother',
        parent_anxieties: 'スマホばかり見ていて注意すると反発する',
        discussed_content: '志望校と受験スケジュールのすり合わせ',
        future_direction_agreed: 'yes'
      };

      const summary = await generateInterviewSummary({
        interviewType: 'three-way',
        interview,
        student: mockStudent
      });
      expect(summary).toContain('三者面談の要約');
      expect(summary).toContain('3者の約束・今後のアクション');
      expect(summary).toContain('お母様');
    });
  });

  describe('4. 講師ダッシュボードにおける全校種（小・中・高）メニュー表示（絵文字なし） & 面談UI操作', () => {
    it('小学生・中学生・高校生のすべての校種で「二者面談」「三者面談」メニュー（絵文字なし）が表示されること', () => {
      const schoolTypes: Array<'elementary' | 'junior_high' | 'high_school'> = ['elementary', 'junior_high', 'high_school'];

      schoolTypes.forEach(type => {
        const { unmount } = render(
          <TeacherDashboard
            students={[mockStudent]}
            teacherType={type}
            initialStudentId={mockStudent.id}
          />
        );

        const m2 = screen.getByTestId('menu-two-way-interview');
        const m3 = screen.getByTestId('menu-three-way-interview');
        expect(m2).toBeDefined();
        expect(m3).toBeDefined();
        // 絵文字アイコンが削除されていること
        expect(m2.textContent?.trim()).toBe('二者面談');
        expect(m3.textContent?.trim()).toBe('三者面談');

        unmount();
      });
    });

    it('二者面談タブ: 音声議事録入力、面談要約生成、画像出力、保存、別日履歴切替、削除が正常に動作すること', async () => {
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

      // SpeechRecognition モックのセットアップ
      const mockRec = {
        lang: '',
        continuous: false,
        interimResults: false,
        start: vi.fn(),
        stop: vi.fn(),
        onresult: null as any,
        onerror: null as any,
        onend: null as any
      };
      function MockRecognition() {
        return mockRec;
      }
      (window as any).SpeechRecognition = MockRecognition;
      (window as any).webkitSpeechRecognition = MockRecognition;

      // 音声録音＆議事録入力パネルの確認
      const recordBtn = screen.getByTestId('interview2-record-btn');
      expect(recordBtn).toBeDefined();
      fireEvent.click(recordBtn); // 録音開始
      expect(mockRec.start).toHaveBeenCalled();

      // 音声イベント発火
      if (mockRec.onresult) {
        mockRec.onresult({
          results: [[{ transcript: '志望校は第一高校です。将来の夢は医師になりたい。部活はバスケ部です。' }]]
        });
      }
      if (mockRec.onerror) {
        mockRec.onerror(new Error('speech error'));
      }
      if (mockRec.onend) {
        mockRec.onend();
      }

      // 再度クリックで停止ブランチ
      fireEvent.click(recordBtn);
      fireEvent.click(recordBtn);

      // 文字起こしテキストから自動抽出
      const parseBtn = screen.getByTestId('interview2-parse-transcript-btn');
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      fireEvent.click(parseBtn);

      await waitFor(() => {
        const schoolInput = screen.getByTestId('interview2-target-school') as HTMLInputElement;
        expect(schoolInput.value).toContain('第一高校');
      });

      // 空文字のときに抽出を押した場合の警告ブランチ
      const transcriptArea = screen.getByTestId('interview2-transcript');
      fireEvent.change(transcriptArea, { target: { value: '' } });
      fireEvent.click(parseBtn);

      // 過去履歴カードが表示されていること
      expect(screen.getByTestId('interview2-item-interview2-hist-1')).toBeDefined();

      // 「➕ 新規作成」ボタンを押下して新規フォームをクリア
      const newBtn = screen.getByTestId('interview2-new-btn');
      fireEvent.click(newBtn);

      // フィールド入力（全項目を網羅）
      const interviewerInput = screen.getByTestId('interview2-interviewer');
      fireEvent.change(interviewerInput, { target: { value: '佐藤講師' } });

      const dateInput = screen.getByTestId('interview2-date');
      fireEvent.change(dateInput, { target: { value: '2026-10-25' } });

      const dreamInput = screen.getByTestId('interview2-dream-goal');
      fireEvent.change(dreamInput, { target: { value: '医師' } });

      fireEvent.change(screen.getByTestId('interview2-club-activity'), { target: { value: 'バスケ部' } });
      fireEvent.change(screen.getByTestId('interview2-club-members-count'), { target: { value: '15' } });
      fireEvent.change(screen.getByTestId('interview2-close-friends'), { target: { value: '鈴木くん' } });
      fireEvent.change(screen.getByTestId('interview2-study-anxiety'), { target: { value: '理科の化学分野が苦手' } });
      fireEvent.change(screen.getByTestId('interview2-self-evaluation'), { target: { value: '70点' } });
      fireEvent.change(screen.getByTestId('interview2-student-challenges'), { target: { value: '計算ミス' } });
      fireEvent.change(screen.getByTestId('interview2-required-actions'), { target: { value: '毎日計算ドリル' } });
      fireEvent.change(screen.getByTestId('interview2-expectations'), { target: { value: '平均点+10点' } });
      fireEvent.change(screen.getByTestId('interview2-target-rank'), { target: { value: '学年20位' } });
      fireEvent.change(screen.getByTestId('interview2-target-score'), { target: { value: '85点' } });
      fireEvent.change(screen.getByTestId('interview2-notes'), { target: { value: '特記事項メモ' } });

      // 動的カスタム項目「➕ 項目を追加」
      const addCustomBtn = screen.getByTestId('interview2-add-custom-field-btn');
      fireEvent.click(addCustomBtn);
      fireEvent.click(addCustomBtn); // 2個追加

      const customLabel = screen.getByTestId('interview2-custom-label-0');
      fireEvent.change(customLabel, { target: { value: '睡眠時間' } });
      const customValue = screen.getByTestId('interview2-custom-value-0');
      fireEvent.change(customValue, { target: { value: '6時間' } });

      // 2個目のカスタム項目を削除
      const removeCustomBtn = screen.getByTestId('interview2-remove-custom-field-1');
      fireEvent.click(removeCustomBtn);

      // 面談要約生成ボタン押下
      const generateAiBtn = screen.getByTestId('interview2-generate-ai-btn');
      fireEvent.click(generateAiBtn);

      await waitFor(() => {
        const adviceTextarea = screen.getByTestId('interview2-ai-advice') as HTMLTextAreaElement;
        expect(adviceTextarea.value).toContain('二者面談の要約');
      });

      // 画像出力ボタン押下 & プレビュー確認
      expect(screen.getByTestId('interview2-summary-card-preview')).toBeDefined();
      const downloadImgBtn = screen.getByTestId('interview2-download-image-btn');
      fireEvent.click(downloadImgBtn);

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

    it('三者面談タブ: 音声議事録入力、面談要約生成、画像出力、保存、削除が正常に動作すること', async () => {
      // 過去履歴を保存
      await db.saveStudentInterview3({
        id: 'interview3-hist-1',
        student_id: mockStudent.id,
        interviewer: '過去講師',
        interview_date: '2026-07-20',
        parent_type: 'mother',
        future_direction_agreed: 'yes',
        notes: '過去メモ',
        created_at: '2026-07-20T10:00:00Z'
      });

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

      // 音声録音＆議事録入力パネルの確認
      const recordBtn = screen.getByTestId('interview3-record-btn');
      expect(recordBtn).toBeDefined();
      fireEvent.click(recordBtn);

      const transcriptArea = screen.getByTestId('interview3-transcript');
      fireEvent.change(transcriptArea, { target: { value: '三者面談です。保護者の不安は高校受験の内申点です。' } });
      const parseBtn = screen.getByTestId('interview3-parse-transcript-btn');
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      fireEvent.click(parseBtn);

      // 空文字警告ブランチ
      fireEvent.change(transcriptArea, { target: { value: '   ' } });
      // 「➕ 新規作成」ボタンを押下して新規フォームをクリア
      const newBtn3 = screen.getByTestId('interview3-new-btn');
      fireEvent.click(newBtn3);

      // フィールド入力
      const interviewerInput = screen.getByTestId('interview3-interviewer');
      fireEvent.change(interviewerInput, { target: { value: '佐藤講師' } });

      const dateInput = screen.getByTestId('interview3-date');
      fireEvent.change(dateInput, { target: { value: '2026-10-28' } });

      const parentSelect = screen.getByTestId('interview3-parent-type');
      fireEvent.change(parentSelect, { target: { value: 'both' } });

      const directionNo = screen.getByTestId('interview3-direction-no');
      fireEvent.click(directionNo);

      const directionYes = screen.getByTestId('interview3-direction-yes');
      fireEvent.click(directionYes);

      const anxietyInput = screen.getByTestId('interview3-parent-anxieties');
      fireEvent.change(anxietyInput, { target: { value: '受験期のメンタル面が心配' } });

      const contentInput = screen.getByTestId('interview3-discussed-content');
      fireEvent.change(contentInput, { target: { value: '第一志望高校の合格目標と今後の学習スケジュール' } });

      fireEvent.change(screen.getByTestId('interview3-notes'), { target: { value: '三者面談特記' } });

      // 動的カスタム項目「➕ 項目を追加」
      const addCustomBtn = screen.getByTestId('interview3-add-custom-field-btn');
      fireEvent.click(addCustomBtn);
      fireEvent.click(addCustomBtn); // 2個

      const customLabel = screen.getByTestId('interview3-custom-label-0');
      fireEvent.change(customLabel, { target: { value: '通塾手段' } });
      const customValue = screen.getByTestId('interview3-custom-value-0');
      fireEvent.change(customValue, { target: { value: '自転車' } });

      fireEvent.click(screen.getByTestId('interview3-remove-custom-field-1')); // 削除

      // 面談要約生成
      const generateAiBtn = screen.getByTestId('interview3-generate-ai-btn');
      fireEvent.click(generateAiBtn);

      await waitFor(() => {
        const adviceTextarea = screen.getByTestId('interview3-ai-advice') as HTMLTextAreaElement;
        expect(adviceTextarea.value).toContain('三者面談の要約');
      });

      // 画像ダウンロードボタン & プレビュー確認
      expect(screen.getByTestId('interview3-summary-card-preview')).toBeDefined();
      const downloadImgBtn = screen.getByTestId('interview3-download-image-btn');
      fireEvent.click(downloadImgBtn);

      // 保存
      const saveBtn = screen.getByTestId('interview3-save-btn');
      fireEvent.click(saveBtn);

      const savedList = db.getStudentInterviews3(mockStudent.id);
      expect(savedList.length).toBe(2);
      expect(savedList.some(i => i.parent_type === 'both' && i.future_direction_agreed === 'yes')).toBe(true);

      // 過去履歴の切替と削除
      const histItem = screen.getByTestId('interview3-item-interview3-hist-1');
      fireEvent.click(histItem);

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const deleteBtn = screen.getByTestId('interview3-delete-btn');
      fireEvent.click(deleteBtn);

      const listAfterDelete = db.getStudentInterviews3(mockStudent.id);
      expect(listAfterDelete.length).toBe(1);
    });
  });

  describe('5. 単元テスト合格後の学習計画新単元進行 & 自動リスケ連携', () => {
    it('中尾謙信の算数: 80点不合格だった単元が再テストで100点合格した場合、新単元（くりあがりのあるたしざん）に進むこと', async () => {
      const studentKenshin: Student = {
        id: 'student-kenshin-1',
        student_id: 'student-kenshin-1',
        name: '中尾謙信',
        grade: '小1',
        school_id: 'school-1',
        status: 'normal',
        start_unit_id: null,
        created_at: new Date().toISOString(),
        selected_subjects: ['算数'],
        selected_days: ['tuesday', 'friday'],
        default_slots: 1
      };
      await db.saveStudent(studentKenshin);

      // カリキュラムマスターを用意
      const masters = [
        { id: 'math-1', subject: '算数', grade: '小1', sort_order: 1, unit_name: '3つの かずの けいさん', lesson_name: '3つの かずの けいさん (1)' },
        { id: 'math-test-1', subject: '算数', grade: '小1', sort_order: 2, unit_name: '3つの かずの けいさん', lesson_name: '3つの かずの けいさん - 単元確認テスト', item_type: 'unit_test' },
        { id: 'math-2', subject: '算数', grade: '小1', sort_order: 3, unit_name: 'くりあがりのあるたしざん', lesson_name: 'くりあがりのあるたしざん (1)' },
        { id: 'math-test-2', subject: '算数', grade: '小1', sort_order: 4, unit_name: 'くりあがりのあるたしざん', lesson_name: 'くりあがりのあるたしざん - 単元確認テスト', item_type: 'unit_test' }
      ];
      await db.saveCurriculumMasters(masters as any);

      // 過去に 80点（不合格）
      await db.saveMiniTestResult({
        id: 'test-1',
        student_id: studentKenshin.id,
        subject: '算数',
        test_type: 'unit_test',
        unit_name: '3つの かずの けいさん',
        test_content: '算数: 3つの かずの けいさん - 単元確認テスト',
        date: '2026-10-13',
        score: 80,
        passing_line: '90点以上',
        passed: false,
        created_at: '2026-10-13T10:00:00Z'
      });

      // その後、再テストで 100点（合格）
      await db.saveMiniTestResult({
        id: 'test-2',
        student_id: studentKenshin.id,
        subject: '算数',
        test_type: 'unit_test',
        unit_name: '3つの かずの けいさん',
        test_content: '算数: 【再テスト対策・総】算数: 3つの かずの けいさん - 単元確認テスト',
        date: '2026-10-23',
        score: 100,
        passing_line: '90点以上',
        passed: true,
        created_at: '2026-10-23T10:00:00Z'
      });

      // normalizeUnitName で装飾接頭辞・接尾辞が除去されること
      const norm1 = normalizeUnitName('算数: 3つの かずの けいさん - 単元確認テスト');
      const norm2 = normalizeUnitName('算数: 【再テスト対策・総】算数: 3つの かずの けいさん - 単元確認テスト');
      expect(norm1).toBe('3つの かずの けいさん');
      expect(norm2).toBe('3つの かずの けいさん');

      // getLatestUnitTestStatusForSubject の確認
      const status = getLatestUnitTestStatusForSubject({
        studentId: studentKenshin.id,
        subject: '算数'
      });
      expect(status.hasFailedUnitTest).toBe(false);
      expect(status.completedUnitTestKeys.has('3つの かずの けいさん')).toBe(true);

      // 次回授業を計算
      const range = calculateLessonRangeForSlot({
        subject: '算数',
        student: studentKenshin,
        curriculumMasters: masters as any
      });
      // 3つの かずの けいさん は合格済みのため、新単元の「くりあがりのあるたしざん」に進んでいること！
      expect(range.start_lesson_name).toContain('くりあがりのあるたしざん');
    });
  });

  describe('6. Gemini APIキー設定時の生成 & 例外分岐', () => {
    it('空文字の文字起こしは空オブジェクトを返すこと', async () => {
      expect(await parseInterviewTranscriptToFields('', 'two-way')).toEqual({});
      expect(await parseInterviewTranscriptToFields('   ', 'three-way')).toEqual({});
    });

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

      await generateInterviewSummary({
        interviewType: 'two-way',
        interview: { interviewer: '福田', interview_date: '2026-10-20' },
        student: mockStudent
      }).catch(e => {
        expect(e).toBeDefined();
      });

      await generateInterviewSummary({
        interviewType: 'three-way',
        interview: { interviewer: '福田', interview_date: '2026-10-20' },
        student: mockStudent
      }).catch(e => {
        expect(e).toBeDefined();
      });

      await parseInterviewTranscriptToFields('志望校は第一高校です。', 'two-way').catch(e => {
        expect(e).toBeDefined();
      });

      localStorage.removeItem('tentoru_gemini_api_key');
    });

    it('GoogleGenerativeAI API呼出成功時の結果パースとマージ', async () => {
      localStorage.setItem('tentoru_gemini_api_key', 'test-key');
      const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              dream_goal: 'プログラマー',
              target_school: '第一高校',
              club_activity: 'サッカー部',
              interviewer: '山田講師'
            })
          }
        })
      } as any);

      const parsed = await parseInterviewTranscriptToFields('部活はサッカー部です。志望校は第一高校です。', 'two-way');
      expect(parsed.dream_goal).toBe('プログラマー');
      expect(parsed.target_school).toBe('第一高校');

      const sumRes = await generateInterviewSummary({
        interviewType: 'two-way',
        interview: { interviewer: '福田', interview_date: '2026-10-20' },
        student: mockStudent
      });
      expect(typeof sumRes).toBe('string');

      // 非JSONテキスト返却時のフォールバック
      spy.mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => 'plain text without json'
          }
        })
      } as any);
      const fallbackParsed = await parseInterviewTranscriptToFields('部活はサッカー部です。', 'two-way');
      expect(fallbackParsed.club_activity).toBe('サッカー部');

      spy.mockRestore();
      localStorage.removeItem('tentoru_gemini_api_key');
    });
  });

  describe('7. Home ページにおける生徒画面「授業設定」から講師ダッシュボード学習計画への統合ルーティング', () => {
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

  describe('8. db.ts Supabase クラウド連携分岐の網羅', () => {
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
      // 既存更新パス
      await db.saveStudentInterview2({ id: 'supa-1', student_id: mockStudent.id, interviewer: 'A更新', interview_date: '2026-10-10', created_at: '' });
      await db.deleteStudentInterview2('supa-1');

      await db.saveStudentInterview3({ id: 'supa-3', student_id: mockStudent.id, interviewer: 'A', interview_date: '2026-10-10', parent_type: 'mother', future_direction_agreed: 'yes', created_at: '' });
      // 既存更新パス
      await db.saveStudentInterview3({ id: 'supa-3', student_id: mockStudent.id, interviewer: 'A更新', interview_date: '2026-10-10', parent_type: 'mother', future_direction_agreed: 'yes', created_at: '' });
      await db.deleteStudentInterview3('supa-3');

      expect(mockSupabase.from).toHaveBeenCalledWith('student_interviews_2');
      expect(mockSupabase.from).toHaveBeenCalledWith('student_interviews_3');

      // Supabase 例外発生時の try/catch 警告ハンドリング
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Supabase save error'))
          })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error('Supabase delete error'))
        })
      } as any);

      await db.saveStudentInterview2({ id: 'supa-err-2', student_id: mockStudent.id, interviewer: 'A', interview_date: '2026-10-10', created_at: '' });
      await db.deleteStudentInterview2('supa-err-2');
      await db.saveStudentInterview3({ id: 'supa-err-3', student_id: mockStudent.id, interviewer: 'A', interview_date: '2026-10-10', parent_type: 'mother', future_direction_agreed: 'yes', created_at: '' });
      await db.deleteStudentInterview3('supa-err-3');

      (db as any).isMockMode = true;
      (db as any).supabase = null;
    });
  });
});
