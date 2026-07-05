import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const serviceName = 'ActionLoop';

export function createTotpSecret() {
  return authenticator.generateSecret();
}

export function createTotpOtpAuthUrl(email: string, secret: string) {
  return authenticator.keyuri(email, serviceName, secret);
}

export async function createTotpQrCodeDataUrl(email: string, secret: string) {
  const otpauth = createTotpOtpAuthUrl(email, secret);
  return QRCode.toDataURL(otpauth);
}

export function verifyTotpCode(secret: string, code: string) {
  return authenticator.verify({ token: code, secret });
}
