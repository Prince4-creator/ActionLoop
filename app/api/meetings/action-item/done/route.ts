import { NextResponse } from 'next/server';
import { markActionItemDone } from '@/app/actions/meetings';

export async function POST(req: Request) {
  try {
    const { actionItemId } = await req.json();
    if (!actionItemId) {
      return NextResponse.json({ error: 'actionItemId is required' }, { status: 400 });
    }

    const result = await markActionItemDone(actionItemId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to mark action item done' }, { status: 500 });
  }
}
