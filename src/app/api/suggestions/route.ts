import { NextRequest, NextResponse } from 'next/server';
import { generateLearningSuggestions } from '@/lib/suggestions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const suggestions = await generateLearningSuggestions(studentId);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('[GET /api/suggestions]', err);
    const message = err instanceof Error ? err.message : 'An error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
