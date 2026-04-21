import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const colors = await prisma.color.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(colors);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch colors' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, hexCode } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const color = await prisma.color.findFirst({ where: { name: name.trim() } });
    if (color) {
      return NextResponse.json({ error: 'Color already exists' }, { status: 400 });
    }

    const newColor = await prisma.color.create({
      data: { 
        name: name.trim(),
        hexCode: hexCode?.trim() || null
      },
    });

    return NextResponse.json(newColor);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create color' }, { status: 500 });
  }
}
