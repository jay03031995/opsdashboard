import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { isDatabaseConfigured, prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
const email =
  typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

const password =
  typeof body.password === 'string' ? body.password : '';

if (!email || !password) {
  return NextResponse.json(
    { error: 'Email and password are required' },
    { status: 400 }
  );
}

/* ---------- HARDCODED ADMIN LOGIN ---------- */

const ADMIN_EMAIL = 'admin@opsdashboard.com';
const ADMIN_PASSWORD = 'Admin@123';

if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
  const token = jwt.sign(
    {
      userId: 'admin',
      tenantId: 'default',
      role: 'ADMIN',
      email: ADMIN_EMAIL,
    },
    process.env.JWT_SECRET || 'development-secret',
    { expiresIn: '7d' }
  );

  const response = NextResponse.json({
    user: {
      id: 'admin',
      name: 'Admin',
      email: ADMIN_EMAIL,
      role: 'ADMIN',
      tenantId: 'default',
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

/* ---------- DATABASE LOGIN ---------- */

if (!isDatabaseConfigured()) {
  return NextResponse.json(
    { error: 'Database not configured' },
    { status: 500 }
  );
}

const user = await prisma.user.findUnique({
  where: { email },
  select: {
    id: true,
    name: true,
    email: true,
    password: true,
    role: true,
    tenantId: true,
  },
});

if (!user) {
  return NextResponse.json(
    { error: 'Invalid credentials' },
    { status: 401 }
  );
}

const isValid = await bcrypt.compare(password, user.password);

if (!isValid) {
  return NextResponse.json(
    { error: 'Invalid credentials' },
    { status: 401 }
  );
}

const token = jwt.sign(
  {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  },
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

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
