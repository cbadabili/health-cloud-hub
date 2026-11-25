// End-to-end check of a running Clinithetics API, the way the app uses it.
//
// Creates a throwaway doctor, approves their registration, sets up two-step
// sign-in with a real TOTP code, creates a practice, registers a patient,
// uploads a certificate, and checks that a second user sees none of it.
//
// It writes test data, so it refuses to run against production.
//
// Usage (from the repo root, after `npm ci`):
//   API_URL=https://api.staging.clinithetics.beedab.com \
//   ANON_KEY=... SERVICE_ROLE_KEY=... ENV_NAME=staging \
//   node infra/azure/server/smoke-flow.mjs
import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, ENV_NAME } = process.env;
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Set API_URL, ANON_KEY and SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (ENV_NAME === "prod" || /\/\/api\.clinithetics\.beedab\.com/.test(API_URL)) {
  console.error("Refusing to write test data to production.");
  process.exit(1);
}

let failures = 0;
const check = (ok, message) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} - ${message}`);
  if (!ok) failures++;
};
const must = (result, what) => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
};

// RFC 6238 TOTP (what authenticator apps compute).
const base32Decode = (input) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};
const totp = (secret, at = Date.now()) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
};

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(API_URL, SERVICE_ROLE_KEY, opts);
const tag = `smoke-${Date.now()}-${randomBytes(3).toString("hex")}`;
const password = `Sm0ke!${randomBytes(12).toString("hex")}`;

const newUser = async (label, meta) => {
  const email = `${tag}-${label}@example.invalid`;
  const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta }), `create ${label}`);
  const client = createClient(API_URL, ANON_KEY, opts);
  must(await client.auth.signInWithPassword({ email, password }), `sign in ${label}`);
  return { id: created.user.id, email, client };
};

try {
  console.log(`Smoke flow against ${API_URL} (${tag})`);

  // 1. A doctor signs up; the sign-up trigger records the requested role.
  const doc = await newUser("doctor", { first_name: "Smoke", last_name: "Doctor", role: "doctor", registration_council: "HPCSA", registration_number: "MP0123456" });
  const role = must(await admin.from("user_roles").select("role").eq("user_id", doc.id).maybeSingle(), "read role");
  check(role?.role === "doctor", "sign-up created a doctor role");

  // 2. A platform admin approves their registration (done by service role here).
  must(await admin.from("doctor_verifications").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("doctor_id", doc.id), "approve doctor");

  // 3. Certificate upload into the private bucket, under the doctor's own folder.
  const upload = await doc.client.storage.from("doctor-certificates").upload(`${doc.id}/certificate.pdf`, Buffer.from("%PDF-1.4 smoke"), { contentType: "application/pdf" });
  check(!upload.error, `certificate upload works${upload.error ? `: ${upload.error.message}` : ""}`);

  // 4. Create a practice, then get the two-step sign-in it requires.
  const practiceId = must(await doc.client.rpc("create_practice", { _name: `Smoke clinic ${tag}`, _country: "BW" }), "create practice");
  check(typeof practiceId === "string", "practice created");

  const blocked = await doc.client.rpc("register_patient", { _practice_id: practiceId, _first_name: "Too", _last_name: "Early" });
  check(!!blocked.error, "before two-step sign-in, the practice refuses to register patients");

  const enrolled = must(await doc.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Smoke" }), "enroll TOTP");
  const wrong = await doc.client.auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: "000000" });
  check(!!wrong.error, "a wrong code is rejected");
  must(await doc.client.auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: totp(enrolled.totp.secret) }), "verify TOTP");
  const aal = must(await doc.client.auth.mfa.getAuthenticatorAssuranceLevel(), "read assurance level");
  check(aal.currentLevel === "aal2", "session upgraded to two-step (aal2)");

  const practices = must(await doc.client.rpc("my_practices"), "my_practices");
  const mine = practices.find((p) => p.practice_id === practiceId);
  check(mine?.currency === "BWP" && mine?.timezone === "Africa/Gaborone" && mine.roles.includes("owner"), "practice is Botswana (BWP, Gaborone) and the doctor is owner");

  // 5. Register a patient (no login needed) and read it back.
  const reg = must(await doc.client.rpc("register_patient", { _practice_id: practiceId, _first_name: "Mpho", _last_name: "Kgosi", _date_of_birth: "1990-04-01", _id_type: "omang", _id_number: "123456789", _phone_e164: "+26771234567" }), "register patient");
  check(!!reg.patient_id, "patient registered");
  const pts = must(await doc.client.from("patients").select("id, first_name").eq("practice_id", practiceId), "read patients");
  check(pts.length === 1 && pts[0].first_name === "Mpho", "owner can read the patient after two-step sign-in");

  const dup = must(await doc.client.rpc("register_patient", { _practice_id: practiceId, _first_name: "Mpho", _last_name: "Kgosi", _phone_e164: "+26771234567" }), "register duplicate");
  check(!dup.patient_id && dup.duplicates?.length === 1, "a likely duplicate is flagged, not saved");

  const audit = must(await doc.client.from("audit_events").select("action").eq("practice_id", practiceId), "read audit");
  check(audit.some((a) => a.action === "patients.insert"), "patient registration is in the audit log");

  // 6. Someone else sees nothing.
  const other = await newUser("outsider", { first_name: "Out", last_name: "Sider", role: "patient" });
  const leak = await other.client.from("patients").select("id").eq("practice_id", practiceId);
  check((leak.data ?? []).length === 0, "another user can't see the practice's patients");
  const leakCert = await other.client.storage.from("doctor-certificates").download(`${doc.id}/certificate.pdf`);
  check(!!leakCert.error, "another user can't download the doctor's certificate");
  const anon = createClient(API_URL, ANON_KEY, opts);
  const anonRead = await anon.from("patients").select("id");
  check((anonRead.data ?? []).length === 0, "anonymous visitors see no patients");
} catch (error) {
  console.error(`  FAIL - ${error.message}`);
  failures++;
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll smoke checks passed.");
process.exit(failures ? 1 : 0);
