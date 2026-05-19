import { NextResponse } from 'next/server';
import { fetchAllCameras } from '@/lib/aggregator';

export const revalidate = 300;

export async function GET() {
  const { cameras, errors } = await fetchAllCameras();
  return NextResponse.json(
    {
      count: cameras.length,
      errors,
      cameras,
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
  );
}
