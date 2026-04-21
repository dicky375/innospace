import dotenv from 'dotenv';
dotenv.config();

export const SERVER_REGISTRY = [
  {
    name: 'Auth Service',
    target: `http://localhost:${process.env.SERVER1_PORT || 3001}`,
    routes: ['/api/auth', '/api/users', '/api/login', '/api/register'],
  },
  {
    name: 'Registration Service',
    target: `http://localhost:${process.env.SERVER2_PORT || 3002}`,
    routes: ['/api/programs', '/api/registrations', '/api/affiliates'],
  },
  {
    name: 'Payment Service',
    target: `http://localhost:${process.env.SERVER3_PORT || 3003}`,
    routes: ['/api/payments', '/api/commissions', '/api/payouts', '/api/webhook'],
  }
];

export const getTargetService = (url) => {
  const path = url.split('?')[0];
  return SERVER_REGISTRY.find(service => 
    service.routes.some(route => path.startsWith(route))
  );
};