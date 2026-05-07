import dotenv from 'dotenv';
dotenv.config();

export const SERVER_REGISTRY = [
  {
    name: 'Auth Service',
    prefix: '/auth',
    target: `http://localhost:${process.env.SERVER1_PORT || 3001}`,
    routes: ['/api/auth', '/api/users', '/api/login', '/api/register'],
  },
  {
    name: 'Registration Service',
    prefix: '/register',
    target: `http://localhost:${process.env.SERVER2_PORT || 3002}`,
    routes: ['/api/programs', '/api/registrations', '/api/affiliates'],
  },
  {
    name: 'Payment Service',
    prefix: '/payment',
    target: `http://localhost:${process.env.SERVER3_PORT || 3003}`,
    routes: ['/api/payments', '/api/commissions', '/api/payouts', '/api/webhook'],
  }
];

export const getTargetService = (url) => {
  return SERVER_REGISTRY.find(service =>
    url.startswith(service.prefix)
  );
};