import { GoogleGenerativeAI } from '@google/generative-ai';

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
