import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const sizes = await prisma.size.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(sizes);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sizes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const size = await prisma.size.findFirst({ where: { name: name.trim().toUpperCase() } });
    if (size) {
      return NextResponse.json({ error: 'Size already exists' }, { status: 400 });
    }

    const newSize = await prisma.size.create({
      data: { name: name.trim().toUpperCase() },
    });

    return NextResponse.json(newSize);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create size' }, { status: 500 });
  }
}
