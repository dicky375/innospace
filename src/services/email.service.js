// Simple email service (placeholder for now)
// You can replace this with actual email sending later

export async function sendVerificationEmail(email, token) {
  console.log(`[EMAIL] Verification email would be sent to ${email} with token ${token}`);
  // In production, use nodemailer or a service like SendGrid
  return true;
}

// export async function sendPasswordResetEmail(email, token) {
//   console.log(`[EMAIL] Password reset email would be sent to ${email} with token ${token}`);
//   return true;
// }

export async function sendRegistrationApprovalEmail(email, name, programTitle) {
  console.log(`[EMAIL] Registration approval email to ${email} for ${programTitle}`);
  return true;
}

export async function sendPayoutNotificationEmail(email, amount, status) {
  console.log(`[EMAIL] Payout ${status} notification to ${email} for ₦${amount}`);
  return true;
}

export default {
  //sendVerificationEmail,
  //sendPasswordResetEmail,
  sendRegistrationApprovalEmail,
  sendPayoutNotificationEmail
};