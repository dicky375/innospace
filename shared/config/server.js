import dotenv from 'dotenv';
dotenv.config();

/**
 * INNOSPACE SERVER REGISTRY
 * 
 * How routing works:
 * - Load balancer matches request URL against each service prefix
 * - The prefix is STRIPPED before forwarding to the target service
 * - Example: POST /auth/api/auth/register → strips /auth → POST /api/auth/register → Auth Service
 * 
 * So from the frontend/Postman, all URLs follow this pattern:
 * - Auth:         http://localhost:3000/auth/api/auth/...
 * - Auth Users:   http://localhost:3000/auth/api/users/...
 * - Registration: http://localhost:3000/reg/api/programs/...
 * - Registration: http://localhost:3000/reg/api/registrations/...
 * - Payment:      http://localhost:3000/pay/api/payments/...
 * - Payment:      http://localhost:3000/pay/api/commissions/...
 * - Webhook:      http://localhost:3000/pay/api/webhook/paystack
 */

export const SERVER_REGISTRY = [
  {
    name: 'Auth Service',
    prefix: '/auth',
    target: process.env.AUTH_SERVICE_URL || `http://localhost:${process.env.SERVER1_PORT || 3001}`,
    routes: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/refresh',
      'POST /api/auth/logout',
      'GET  /api/users',
      'GET  /api/users/by-email',
    ],
  },
  {
    name: 'Registration Service',
    prefix: '/reg',
    target: process.env.REGISTRATION_SERVICE_URL || `http://localhost:${process.env.SERVER2_PORT || 3002}`,
    routes: [
      'GET    /api/programs',
      'POST   /api/programs',
      'GET    /api/programs/:id',
      'PATCH  /api/programs/:id',
      'DELETE /api/programs/:id',
      'GET    /api/registrations/all',
      'GET    /api/registrations/pending',
      'GET    /api/registrations/my',
      'GET    /api/registrations/my/stats',
      'GET    /api/registrations/:id',
      'POST   /api/registrations',
      'PATCH  /api/registrations/:id/approve',
      'PATCH  /api/registrations/:id/reject',
      'PATCH  /api/registrations/:id/cancel',
      'PATCH  /api/registrations/:id/mark-paid',
      
    ],
  },
  {
    name: 'Payment Service',
    prefix: '/pay',
    target: `http://localhost:${process.env.SERVER3_PORT || 3003}`,
    routes: [
      'POST /api/payments/initialize',
      'GET  /api/payments/verify/:reference',
      'GET  /api/payments/transactions',
      'GET  /api/payments/transactions/all',
      'GET  /api/commissions/balance',
      'GET  /api/commissions/leaderboard',
      'POST /api/webhook/paystack',
      'POST /api/payouts/request',
      'GET  /api/payouts/my',
      'GET  /api/payouts/pending',
      'GET  /api/payouts/all',
      'PATCH /api/payouts/:id/approve',
      'PATCH /api/payouts/:id/reject',
      'GET  /api/config/commission',
'     PATCH /api/config/commission',
    ],
  },
];

export const getTargetService = (url) => {
  return SERVER_REGISTRY.find(service => url.startsWith(service.prefix));
};