import dotenv from 'dotenv';
dotenv.config();

export const SERVER_REGISTRY = [
  {
    name: 'server1-auth',
    target: `http://localhost:${process.env.SERVER1_PORT || 3001}`,
    routes: ['/api/auth', '/api/users'],
  },
  {
    name: 'server2-registration',
    target: `http://localhost:${process.env.SERVER2_PORT || 3002}`,
    routes: ['/api/programs', '/api/registrations'],
  },
  {
    name: 'server3-payment',
    target: `http://localhost:${process.env.SERVER3_PORT || 3003}`,
    routes: ['/api/payments', '/api/commissions', '/api/webhook'],
  },
];