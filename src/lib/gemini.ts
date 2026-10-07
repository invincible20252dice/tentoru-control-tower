import { GoogleGenerativeAI } from '@google/generative-ai';
import { Student, StudentInterview2, StudentInterview3 } from './db';

// APIキーの取得
export function getGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem('tentoru_gemini_api_key');
    if (localKey) return localKey;
  }
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
}

// APIキーの保存
export function saveGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key) {
      localStorage.setItem('tentoru_gemini_api_key', key);
    } else {
      localStorage.removeItem('tentoru_gemini_api_key');
    }
  }
}

export interface AnalyzedTestScores {
  test_name: string;
  score_japanese: number | null;
  score_math: number | null;
  score_english: number | null;
  score_social: number | null;
  score_science: number | null;
  score_total: number | null;
  class_rank: string | null;
  school_rank: string | null;
  deviation_value: number | null;
}

// 成績表画像のAI解析
export async function analyzeReportCardImage(base64Image: string, mimeType: string): Promise<AnalyzedTestScores> {
  const apiKey = getGeminiApiKey();

  // APIキーがない場合はデモ（モック）データを返してフォールバック動作とする
  if (!apiKey) {
    console.warn('Gemini API key is not configured. Falling back to demo mock data.');
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          test_name: '1学期期末テスト',
          score_japanese: 82,
          score_math: 90,
          score_english: 85,
          score_social: 78,
          score_science: 88,
          score_total: 423,
          class_rank: '5',
          school_rank: '12',
          deviation_value: 62.5
        });
      }, 2000); // 2秒の擬似ディレイを演出
    });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // 画像処理・テキスト抽出に適した gemini-1.5-flash を利用
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
これは中学生または小学生の成績表・成績通知表の画像です。
画像から、国語、数学、英語、社会、理科の点数、合計点、クラス順位、学年順位、偏差値を抽出してください。
出力は、以下のJSONフォーマット（Markdownコードブロックを付けず、純粋なJSONテキストのみ）で返してください。
点数や順位、偏差値の数値が画像に存在しない場合、または判定できない場合は null としてください。
順位について、数字の後に「位」や「/」などの文字が入っている場合は数値のみを抽出してください。
順位が知らされていない、または不明な箇所は "ー" にしてください。

JSONフォーマット（この形式の文字列のみを正確に出力してください）：
{
  "test_name": "テストの名前（例：1学期中間テスト、2学期期末テストなど。推測できる名称を書いてください）",
  "score_japanese": 国語の点数（数値、なければnull）,
  "score_math": 数学の点数（数値、なければnull）,
  "score_english": 英語の点数（数値、なければnull）,
  "score_social": 社会の点数（数値、なければnull）,
  "score_science": 理科の点数（数値、なければnull）,
  "score_total": 5教科合計点（数値、なければnull）,
  "class_rank": "クラス順位（文字列、例: \"5\" または \"ー\"）",
  "school_rank": "学年順位（文字列、例: \"12\" または \"ー\"）",
  "deviation_value": 偏差値（数値、なければnull）
}
`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Image,
        mimeType: mimeType
      }
    }
  ]);

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('解析結果がJSONフォーマットではありませんでした。');
  }

  const parsed = JSON.parse(jsonMatch[0]) as AnalyzedTestScores;
  return parsed;
}

// 二者面談用 AIコーチング・カウンセリングアドバイス生成
export async function generateInterview2CoachingAdvice(
  interview: Partial<StudentInterview2>,
  student?: Partial<Student> | null
): Promise<string> {
  const apiKey = getGeminiApiKey();
  const studentName = student?.name || '生徒';
  const customInfo = interview.custom_fields && interview.custom_fields.length > 0
    ? interview.custom_fields.map(f => `・${f.label}: ${f.value || '未記入'}`).join('\n')
    : 'なし';

  const prompt = `あなたは教育コーチング・心理カウンセリングのプロ講師です。
以下は講師と生徒（${studentName}さん）の【二者面談】の記録です。

【生徒情報・面談記録】
・生徒氏名: ${studentName} (${student?.grade || '学年未設定'})
・面談担当者: ${interview.interviewer || '未設定'}
・面談日: ${interview.interview_date || '未設定'}
・将来の夢・なりたい像: ${interview.dream_goal || '未設定'}
・志望校: ${interview.target_school || '未設定'}
・所属部活・クラブ: ${interview.club_activity || 'なし'} (${interview.club_members_count ? interview.club_members_count + '人' : ''})
・部活や日頃で仲良い人: ${interview.close_friends || '特になし'}
・勉強に関しての不安: ${interview.study_anxiety || '特になし'}
・今の勉強状況への自己評価: ${interview.self_evaluation || '未回答'}
・今の生徒の課題点: ${interview.student_challenges || '未回答'}
・行動ベースで求めること: ${interview.required_actions || '特になし'}
・これから期待していること: ${interview.expectations || '特になし'}
・目標順位: ${interview.target_rank || '未設定'}
・目標点数: ${interview.target_score || '未設定'}
・その他メモ: ${interview.notes || 'なし'}
・カスタム項目:
${customInfo}

上記の面談記録をもとに、コーチング・カウンセリングの視点から、以下の構成で具体的かつ実践的なアドバイス・方針をまとめてください：
1. 【生徒の心理状態・現状分析】：不安や自己評価、人間関係を踏まえた心理的背景の理解
2. 【今後の接し方・アプローチ方針】：信頼関係を深めモチベーションを引き出す指導スタンス
3. 【具体的な声かけフレーズ集】：授業前後や宿題確認時に講師がそのまま使える言葉がけ（3〜4パターン）
4. 【行動変容を促すスモールステップ】：行動ベースで求めることを実現するための具体的約束・フォロー手順

親しみやすく、かつ講師が今日から使える実践的な日本語のMarkdown形式で記述してください。`;

  if (!apiKey) {
    const anxietyText = interview.study_anxiety ? `「${interview.study_anxiety}」という不安を抱えています。` : '特段の強い不安は表出していませんが、潜在的なつまずきに注意が必要です。';
    const dreamText = interview.dream_goal ? `将来の夢「${interview.dream_goal}」や志望校「${interview.target_school || '目標校'}」` : '目標設定';
    const actionText = interview.required_actions ? `求める行動「${interview.required_actions}」` : '学習習慣の定着';

    return `### 💡 AIコーチング・カウンセリングまとめ方針（二者面談）

#### 1. 生徒の心理状態・現状分析
- 現在、${anxietyText}
- 自己評価（${interview.self_evaluation || '現状維持'}）と課題点（${interview.student_challenges || '基礎固め'}）のギャップを受け止める「承認と傾聴」が第一歩です。
- 部活や人間関係（${interview.club_activity || '部活'}・友人関係）も学習エネルギーに直結しているため、勉強以外の雑談からラポール（信頼関係）を構築するのが効果的です。

#### 2. 今後の接し方・アプローチ方針
- **「否定しない・まず受容する」**: 不安やできていない点について問い詰めるのではなく、「そう感じていたんだね」と受け止める姿勢を徹底します。
- **目標（${dreamText}）との接続**: 今日の1コマの勉強が、本人のなりたい未来にどう繋がっているかを肯定的に関連付けます。
- **加点主義でのフィードバック**: できた小さな行動（来塾、宿題の着手、小テストのやり直しなど）を即座に認知・言語化して褒めます。

#### 3. 具体的な声かけフレーズ集
- **授業開始時**: 「${studentName}さん、${interview.club_activity ? interview.club_activity + 'お疲れ様！' : '今日もよく来たね！'} 今日も一緒に一歩進めよう！」
- **課題着手時**: 「完璧を目指さなくて大丈夫。まずは${actionText}を1つだけやってみよう！」
- **授業終了時**: 「今日のこの単元、前よりスムーズに解けていたよ。この調子で${interview.target_score ? interview.target_score + '点を目指していこう！' : '進めていこう！'}」

#### 4. 行動変容を促すスモールステップ
1. **今日やることの明確化**: ${actionText} を具体的なチェックリスト化する。
2. **中間承認**: 次回来塾時に「前回の約束」の進捗を笑顔で確認し、少しでも進んでいれば即賞賛する。
3. **成功体験の蓄積**: 小さなテストや自習で達成感を持たせ、自己評価の引き上げを図る。`;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error (Interview 2):', error);
    throw error;
  }
}

// 三者面談用 AIコーチング・家庭連携アドバイス生成
export async function generateInterview3CoachingAdvice(
  interview: Partial<StudentInterview3>,
  student?: Partial<Student> | null
): Promise<string> {
  const apiKey = getGeminiApiKey();
  const studentName = student?.name || '生徒';
  const customInfo = interview.custom_fields && interview.custom_fields.length > 0
    ? interview.custom_fields.map(f => `・${f.label}: ${f.value || '未記入'}`).join('\n')
    : 'なし';

  const parentLabel = interview.parent_type === 'mother' ? 'お母様' :
    interview.parent_type === 'father' ? 'お父様' :
    interview.parent_type === 'both' ? 'ご両親' :
    interview.parent_type || '保護者様';

  const directionText = interview.future_direction_agreed === true || interview.future_direction_agreed === 'yes' ? '合意形成済み' : '要継続すり合わせ';

  const prompt = `あなたは教育コーチングおよび保護者対応・カウンセリングの専門家です。
以下は生徒（${studentName}さん）・保護者（${parentLabel}）・講師の【三者面談】の記録です。

【生徒・保護者情報・面談記録】
・生徒氏名: ${studentName} (${student?.grade || '学年未設定'})
・面談担当者: ${interview.interviewer || '未設定'}
・面談日: ${interview.interview_date || '未設定'}
・同席保護者: ${parentLabel}
・保護者にとっての不安・疑問: ${interview.parent_anxieties || '特になし'}
・話した内容（志望校・コース選択など）: ${interview.discussed_content || '未設定'}
・今後の方向性の合意: ${directionText}
・その他メモ: ${interview.notes || 'なし'}
・カスタム項目:
${customInfo}

上記の面談記録をもとに、コーチング・カウンセリング視点から、以下の構成で具体的かつ実践的なアドバイス・家庭連携方針をまとめてください：
1. 【三者面談の総括・現状認識の共有】：保護者と生徒それぞれの想い・不安のギャップと共通目標の整理
2. 【塾・家庭での役割分担と連携方針】：塾が担う指導・サポートと、家庭で保護者にお願いしたい見守り・声かけスタンス
3. 【生徒・保護者それぞれへの今後のアプローチ】：生徒へのモチベーション支援と、保護者への定期報告・不安解消のポイント
4. 【次回フォローへの具体的アクションプラン】：塾として直近1〜2ヶ月で実行するステップ

温かく安心感を与え、塾・生徒・家庭が三位一体で前進できる実践的な日本語のMarkdown形式で記述してください。`;

  if (!apiKey) {
    return `### 👨‍👩‍👦 AIコーチング・家庭連携まとめ方針（三者面談）

#### 1. 三者面談の総括・現状認識の共有
- **保護者様の思い**: ${parentLabel}は「${interview.parent_anxieties || '学習状況や将来の進路'}」について真剣に案じていらっしゃいます。
- **生徒本人の受け止め**: 面談の場では緊張や遠慮もあった可能性があります。保護者様の期待と本人のプレッシャーのバランスに細心の配慮が必要です。
- **方向性の確認**: 「${interview.discussed_content || '志望校・学習方針'}」について、方向性の合意（${directionText}）を踏まえた具体的なスケジュール進行が求められます。

#### 2. 塾・家庭での役割分担と連携方針
- **家庭での役割（安心基地）**: 「勉強しなさい」の督促は塾に任せていただき、家庭では「体調管理」と「努力している事実を認める」受容的な環境づくりをご提案します。
- **塾での役割（ペースメーカー）**: 授業計画・進捗管理・小テスト・弱点克服を塾が責任を持ってコントロールし、生徒が迷わず机に向かえるよう伴走します。

#### 3. 生徒・保護者それぞれへの今後のアプローチ
- **生徒へのアプローチ**: 面談で決まった目標に向けて、本人が孤立しないよう「先生たちが味方だからね」という心理的安全性を最優先で伝えます。
- **保護者様へのアプローチ**: ${parentLabel}の不安（${interview.parent_anxieties || '学習面・進路面'}）を解消するため、学習進捗や小テストの成果を定期的にアプリ・連絡帳・電話等でポジティブに報告します。

#### 4. 次回フォローへの具体的アクションプラン
1. **直近2週間の計画遂行**: 面談で共有した方針に沿って、毎回の授業進捗を計画通りに進める。
2. **中間進捗のご連絡**: 3〜4週間後に「面談後の生徒の変化・頑張り」を保護者様へショートメッセージまたはお電話で共有する。
3. **方向性の再確認**: ${directionText === '合意形成済み' ? '次の定期テストや模試での成果を確認' : '次回面談で具体的な選択肢を絞り込んで合意を深める'}。`;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error (Interview 3):', error);
    throw error;
  }
}

// -------------------------------------------------------------
// 生徒・保護者・講師 3者共有用「面談の要約」生成
// -------------------------------------------------------------
export async function generateInterviewSummary(params: {
  interviewType: 'two-way' | 'three-way';
  interview: Partial<StudentInterview2 & StudentInterview3>;
  student?: Partial<Student> | null;
}): Promise<string> {
  const { interviewType, interview, student } = params;
  const apiKey = getGeminiApiKey();
  const studentName = student?.name || '生徒';
  const customInfo = interview.custom_fields && interview.custom_fields.length > 0
    ? interview.custom_fields.map(f => `・${f.label}: ${f.value || '未記入'}`).join('\n')
    : 'なし';

  const isThreeWay = interviewType === 'three-way';
  const parentLabel = interview.parent_type === 'mother' ? 'お母様' :
    interview.parent_type === 'father' ? 'お父様' :
    interview.parent_type === 'both' ? 'ご両親' :
    interview.parent_type || '保護者様';

  const prompt = isThreeWay ? `あなたは教育現場の面談ディレクターです。
生徒（${studentName}さん）、保護者（${parentLabel}）、講師の【三者面談】の内容を、生徒・保護者・講師の3者全員が共有しやすく、前向きに取り組める【面談の要約シート】としてまとめてください。

【面談データ】
・生徒: ${studentName} (${student?.grade || ''})
・担当者: ${interview.interviewer || '担当講師'} / 面談日: ${interview.interview_date || '本日'}
・同席保護者: ${parentLabel}
・保護者の不安・相談: ${interview.parent_anxieties || '特になし'}
・面談で話した内容: ${interview.discussed_content || '学習・進路相談'}
・メモ・補足: ${interview.notes || 'なし'}
・カスタム項目: ${customInfo}

以下の構成で、温かく分かりやすいMarkdown形式で出力してください：
### 📋 三者面談の要約（生徒・保護者・講師 共有シート）
1. 🎯 面談の目的と現状の共有
2. 💡 話し合いのハイライト（進路・学習・家庭での様子）
3. 🤝 3者の約束・今後のアクション
   - 👦 生徒自身ががんばること
   - 👨‍👩‍👧 ご家庭での温かい見守り・サポート
   - 🏫 塾・講師の指導方針・次回までの伴走計画` :
  `あなたは教育現場の面談ディレクターです。
生徒（${studentName}さん）と講師の【二者面談】の内容を、生徒・保護者・講師の3者全員が共有しやすく、安心とやる気が生まれる【面談の要約シート】としてまとめてください。

【面談データ】
・生徒: ${studentName} (${student?.grade || ''})
・担当者: ${interview.interviewer || '担当講師'} / 面談日: ${interview.interview_date || '本日'}
・将来の夢・目標: ${interview.dream_goal || '未設定'} / 志望校: ${interview.target_school || '未設定'}
・部活動・交友関係: ${interview.club_activity || 'なし'} (${interview.club_members_count ? interview.club_members_count + '人' : ''}) / ${interview.close_friends || ''}
・勉強の不安: ${interview.study_anxiety || '特になし'}
・自己評価: ${interview.self_evaluation || '未回答'} / 課題点: ${interview.student_challenges || '未回答'}
・求める行動: ${interview.required_actions || '特になし'}
・期待すること: ${interview.expectations || '特になし'}
・目標順位/点数: ${interview.target_rank || ''} / ${interview.target_score || ''}
・メモ: ${interview.notes || 'なし'}
・カスタム項目: ${customInfo}

以下の構成で、温かく分かりやすいMarkdown形式で出力してください：
### 📋 二者面談の要約（生徒・保護者・講師 共有シート）
1. 🎯 面談の目的と目標（夢・志望校）
2. 🌟 本人の強みと現在の振り返り（自己評価と課題）
3. 🤝 3者の約束・今後のアクション
   - 👦 生徒自身ががんばること（スモールステップ）
   - 👨‍👩‍👧 ご家庭での温かい見守り・サポート
   - 🏫 塾・講師の指導方針・次回までの伴走計画`;

  if (!apiKey) {
    if (isThreeWay) {
      return `### 📋 三者面談の要約（生徒・保護者・講師 共有シート）

#### 1. 🎯 面談の目的と現状の共有
- **面談対象**: ${studentName}さん (${student?.grade || ''}) / 同席: ${parentLabel}
- **面談日 / 担当**: ${interview.interview_date || '本日'}（担当: ${interview.interviewer || '講師'}）
- **共有テーマ**: ${interview.discussed_content || '志望校・学習計画および家庭連携について'}

#### 2. 💡 話し合いのハイライト
- **保護者様の想い・ご不安**: ${interview.parent_anxieties ? `「${interview.parent_anxieties}」について率直にお話しいただきました。` : '学習習慣の定着や進路に向けた見守り体制について確認しました。'}
- **生徒本人の様子**: 今後の目標に向けて前向きに学習へ取り組む意欲が確認できました。
- **共有できた方向性**: 焦らず一歩ずつステップを踏んで進めていく方針で一致しました。

#### 3. 🤝 3者の約束・今後のアクション
- 👦 **${studentName}さん自身ががんばること**:
  - 毎回の授業前の宿題をやり切り、間違えた問題の解き直しを習慣化する。
- 👨‍👩‍👧 **ご家庭での温かい見守り・サポート**:
  - 「勉強しなさい」の指示出しは塾にお任せいただき、家庭では努力しているプロセスを認めて安心できる居場所を作る。
- 🏫 **塾・講師の指導方針・次回までの伴走計画**:
  - 個別学習計画に基づき、単元ごとの定着を小テストで徹底確認。定期的な進捗をご家庭へ共有します。`;
    }

    return `### 📋 二者面談の要約（生徒・保護者・講師 共有シート）

#### 1. 🎯 面談の目的と目標
- **面談対象**: ${studentName}さん (${student?.grade || ''})（担当: ${interview.interviewer || '講師'}）
- **将来の夢・なりたい像**: ${interview.dream_goal || '自分のやりたいこと・目標に向けて邁進'}
- **目標校・目標指標**: ${interview.target_school ? `志望校「${interview.target_school}」` : '目標達成に向けて'}（${interview.target_score ? `目標点: ${interview.target_score}点` : ''}${interview.target_rank ? ` 目標順位: ${interview.target_rank}` : ''}）

#### 2. 🌟 本人の強みと現在の振り返り
- **現在の自己評価と課題**: 本人の自己評価は「${interview.self_evaluation || '一歩ずつ前進'}」であり、課題として「${interview.student_challenges || '日々の学習継続'}」が挙がりました。
- **不安への向き合い方**: ${interview.study_anxiety ? `「${interview.study_anxiety}」という不安について、原因と対策を整理しました。` : '疑問点を抱え込まずすぐに講師に相談できる環境を作ります。'}
- **日々の生活・部活**: ${interview.club_activity ? `部活動（${interview.club_activity}）と両立しながら進めるペースを整えます。` : '生活リズムを整えながら学習時間を確保します。'}

#### 3. 🤝 3者の約束・今後のアクション
- 👦 **${studentName}さん自身ががんばること**:
  - ${interview.required_actions || '授業で習ったことをその日のうちに1回見直す。'}
- 👨‍👩‍👧 **ご家庭での温かい見守り・サポート**:
  - 日々の小さな頑張り（机に向かったこと、来塾したこと）を温かく言葉にして認める。
- 🏫 **塾・講師の指導方針・次回までの伴走計画**:
  - 単元テストの確実な合格と、つまずき箇所の即時フォローを行い、自信を育てます。`;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error (Interview Summary):', error);
    throw error;
  }
}

// -------------------------------------------------------------
// 音声録音（文字起こしテキスト）から面談各項目への自動振り分け抽出
// -------------------------------------------------------------
export interface ParsedInterviewFields {
  interviewer?: string;
  interview_date?: string;
  dream_goal?: string;
  target_school?: string;
  club_activity?: string;
  club_members_count?: string;
  close_friends?: string;
  study_anxiety?: string;
  self_evaluation?: string;
  student_challenges?: string;
  required_actions?: string;
  expectations?: string;
  target_rank?: string;
  target_score?: string;
  parent_type?: string;
  parent_anxieties?: string;
  discussed_content?: string;
  notes?: string;
}

export async function parseInterviewTranscriptToFields(
  transcript: string,
  interviewType: 'two-way' | 'three-way'
): Promise<ParsedInterviewFields> {
  if (!transcript || transcript.trim().length === 0) {
    return {};
  }

  const apiKey = getGeminiApiKey();

  // ルールベース・正規表現による高精度抽出（フォールバック兼用）
  const extractRuleBased = (): ParsedInterviewFields => {
    const res: ParsedInterviewFields = {};
    const text = transcript;

    // 志望校
    const schoolMatch = text.match(/(?:志望校|行きたい高校|行きたい大学|目標校|受験校)[は:：が]?\s*([^\s,、。]+(?:高校|中学校|大学|校)?)/);
    if (schoolMatch) res.target_school = schoolMatch[1].replace(/(?:です|だ|を目指しています|を目指してます|に行きたいです|に行きたい)$/, '').trim();

    // 夢・目標
    const dreamMatch = text.match(/(?:将来の夢|夢|なりたい(?:もの|職業|像))[は:：が]?\s*([^\s,、。]+(?:になりたい|になる|先生|医師|プログラマー|公務員|デザイナー)?)/);
    if (dreamMatch) res.dream_goal = dreamMatch[1].replace(/(?:になりたい|になる)?(?:です|だ)?$/, '').trim();

    // 部活
    const clubMatch = text.match(/(?:部活|クラブ|所属)[は:：が]?\s*([^\s,、。]+(?:部|クラブ|チーム)?)/);
    if (clubMatch) res.club_activity = clubMatch[1].replace(/(?:です|だ|に入っています|に入ってます|をやっています|をやてます)$/, '').trim();

    // 部活人数
    const membersMatch = text.match(/(?:部員|人数|メンバー)[は:：が]?\s*(\d+)\s*人/);
    if (membersMatch) res.club_members_count = membersMatch[1].trim();

    // 仲良い人
    const friendsMatch = text.match(/(?:仲良い(?:人|友達|友だち)|よく一緒にいる(?:人|友達))[は:：が]?\s*([^\s,、。]+)/);
    if (friendsMatch) res.close_friends = friendsMatch[1].replace(/(?:です|だ|よ|ね)$/, '').trim();

    // 勉強の不安・悩み
    const anxietyMatch = text.match(/(?:不安|悩み|心配|困っていること)[は:：が]?\s*([^。]+(?:です|ます|こと)?)/);
    if (anxietyMatch) res.study_anxiety = anxietyMatch[1].trim();

    // 自己評価
    const evalMatch = text.match(/(?:自己評価|自分の評価|手応え|今の勉強)[は:：が]?\s*([^。]+(?:点|割|良い|悪い|普通|まだまだ|頑張っている)?)/);
    if (evalMatch) res.self_evaluation = evalMatch[1].trim();

    // 課題点
    const challengeMatch = text.match(/(?:課題|弱点|直したいところ|改善点)[は:：が]?\s*([^。]+)/);
    if (challengeMatch) res.student_challenges = challengeMatch[1].trim();

    // 求める行動
    const actionMatch = text.match(/(?:行動|約束|やるべきこと|宿題|毎日の勉強)[は:：が]?\s*([^。]+)/);
    if (actionMatch) res.required_actions = actionMatch[1].trim();

    // 目標点数
    const scoreMatch = text.match(/(?:目標点|次のテストで|目標)[は:：が]?\s*(\d+)\s*点/);
    if (scoreMatch) res.target_score = `${scoreMatch[1]}点`;

    // 保護者の不安（三者面談）
    const parentAnxMatch = text.match(/(?:保護者|お母さん|お父さん|親)の?(?:不安|相談|心配)[は:：が]?\s*([^。]+)/);
    if (parentAnxMatch) res.parent_anxieties = parentAnxMatch[1].trim();

    // 話した内容
    if (interviewType === 'three-way') {
      res.discussed_content = text.slice(0, 300).trim();
    }
    res.notes = `【音声文字起こし】\n${text}`;

    return res;
  };

  if (!apiKey) {
    return extractRuleBased();
  }

  try {
    const prompt = `以下は教育現場での${interviewType === 'three-way' ? '三者面談' : '二者面談'}の音声文字起こしテキストです。
この会話から情報を抽出し、指定のJSON形式で返してください。会話に含まれていない項目はnullとしてください。

【文字起こし】
${transcript}

【出力JSONフォーマット】
{
  "interviewer": "面談担当講師名またはnull",
  "dream_goal": "将来の夢・なりたい像またはnull",
  "target_school": "志望校またはnull",
  "club_activity": "所属部活またはnull",
  "club_members_count": "部活人数(数字文字列)またはnull",
  "close_friends": "仲の良い人またはnull",
  "study_anxiety": "勉強に関しての不安またはnull",
  "self_evaluation": "今の勉強への自己評価またはnull",
  "student_challenges": "今の生徒の課題点またはnull",
  "required_actions": "行動ベースで求めることまたはnull",
  "expectations": "これから期待していることまたはnull",
  "target_rank": "目標順位またはnull",
  "target_score": "目標点数またはnull",
  "parent_type": "同席保護者(mother/father/both/その他)またはnull",
  "parent_anxieties": "保護者の不安・疑問またはnull",
  "discussed_content": "面談で話した主な内容の簡潔な要約またはnull"
}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return extractRuleBased();
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const merged = { ...extractRuleBased() };
    Object.keys(parsed).forEach(k => {
      if (parsed[k] !== null && parsed[k] !== undefined && parsed[k] !== '') {
        (merged as any)[k] = String(parsed[k]);
      }
    });
    return merged;
  } catch (e) {
    console.error('Failed to parse transcript via Gemini, falling back to rule-based:', e);
    return extractRuleBased();
  }
}

