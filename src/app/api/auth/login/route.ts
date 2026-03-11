import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { isDatabaseConfigured, prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!isDatabaseConfigured()) {
      const devEmail = (process.env.DEV_LOGIN_EMAIL || 'admin@example.com').toLowerCase();
      const devPassword = process.env.DEV_LOGIN_PASSWORD || 'Admin@123';

      if (email !== devEmail || password !== devPassword) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const token = jwt.sign(
        { userId: 'dev-admin', tenantId: 'dev-tenant', role: 'ADMIN', email: devEmail },
        process.env.JWT_SECRET || 'development-secret',
        { expiresIn: '7d' }
      );

      const response = NextResponse.json({
        user: {
          id: 'dev-admin',
          name: 'Dev Admin',
          email: devEmail,
          role: 'ADMIN',
          tenantId: 'dev-tenant',
        },
      });

      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true, role: true, tenantId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'development-secret',
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
