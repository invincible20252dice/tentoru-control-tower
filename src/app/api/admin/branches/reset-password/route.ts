import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'emailは必須です' }, { status: 400 });
    }

    const res = await db.sendBranchPasswordReset(email);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('API /admin/branches/reset-password Error:', error);
    return NextResponse.json(
      { error: error?.message || 'パスワード再設定メール送信に失敗しました' },
      { status: 500 }
    );
  }
}
