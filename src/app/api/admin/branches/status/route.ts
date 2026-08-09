import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId } = body;

    if (!branchId) {
      return NextResponse.json({ error: 'branchIdは必須です' }, { status: 400 });
    }

    const updated = await db.toggleBranchStatus(branchId);
    return NextResponse.json({
      success: true,
      branch: updated,
      message: `校舎ステータスを「${updated.status === 'active' ? '有効' : '一時停止'}」に更新しました。`
    });
  } catch (error: any) {
    console.error('API /admin/branches/status Error:', error);
    return NextResponse.json(
      { error: error?.message || 'ステータス更新に失敗しました' },
      { status: 500 }
    );
  }
}
