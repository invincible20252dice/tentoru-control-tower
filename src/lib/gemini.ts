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
