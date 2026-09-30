CREATE TABLE IF NOT EXISTS central_loyalty_members (
  id serial PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  birthdate timestamptz,
  sms_consent boolean NOT NULL DEFAULT false,
  visits integer NOT NULL DEFAULT 0,
  total_spent bigint NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS central_loyalty_consent_birthday ON central_loyalty_members (sms_consent, birthdate);
CREATE INDEX IF NOT EXISTS central_loyalty_updated ON central_loyalty_members (updated_at);
CREATE TABLE IF NOT EXISTS central_birthday_sms (
  id serial PRIMARY KEY,
  member_id integer NOT NULL,
  birthday_date text NOT NULL,
  status text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT central_birthday_sms_member_date UNIQUE (member_id, birthday_date)
);
