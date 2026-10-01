// Email via Resend and SMS via Twilio. Without provider keys, messages are
// only logged (and shown on /messages in demo mode), so nothing goes out by accident.

import { Resend } from "resend";
import twilio from "twilio";
import type { Backend } from "./backend/types";

const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "CareRide <careride@example.org>";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

export async function sendEmail(backend: Backend, to: string | null, subject: string, body: string) {
  if (!to) return;
  let delivered = false;
  if (RESEND_KEY) {
    try {
      const { error } = await new Resend(RESEND_KEY).emails.send({ from: EMAIL_FROM, to, subject, text: body });
      delivered = !error;
      if (error) console.error("[careride] email failed", error.message);
    } catch (e) {
      console.error("[careride] email failed", e);
    }
  }
  await backend.logMessage({ channel: "email", to, subject, body, delivered });
}

export async function sendSms(backend: Backend, to: string | null, body: string) {
  if (!to) return;
  let delivered = false;
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      await twilio(TWILIO_SID, TWILIO_TOKEN).messages.create({ from: TWILIO_FROM, to, body });
      delivered = true;
    } catch (e) {
      console.error("[careride] sms failed", e);
    }
  }
  await backend.logMessage({ channel: "sms", to, subject: null, body, delivered });
}
