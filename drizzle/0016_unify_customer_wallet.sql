-- Move each customer's legacy purchase-credit balance into their wallet once.
-- Legacy tables and ledger rows remain in place for historical records.
CREATE TABLE IF NOT EXISTS "customer_wallet_credit_migrations" (
  "user_id" integer PRIMARY KEY REFERENCES "users"("id"),
  "legacy_phone" text NOT NULL,
  "amount" bigint NOT NULL,
  "migrated_at" timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  legacy RECORD;
  migrated_user_id integer;
BEGIN
  FOR legacy IN
    SELECT u.id AS user_id, u.phone, cb.balance
    FROM customer_balances cb
    JOIN users u ON u.phone = cb.phone
    WHERE cb.balance > 0
    ORDER BY u.id
  LOOP
    migrated_user_id := NULL;
    INSERT INTO customer_wallet_credit_migrations(user_id, legacy_phone, amount)
    VALUES (legacy.user_id, legacy.phone, legacy.balance)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id INTO migrated_user_id;

    IF migrated_user_id IS NOT NULL THEN
      INSERT INTO customer_wallets(user_id, balance)
      VALUES (legacy.user_id, legacy.balance)
      ON CONFLICT (user_id) DO UPDATE
      SET balance = customer_wallets.balance + EXCLUDED.balance,
          updated_at = now();

      INSERT INTO customer_wallet_entries(user_id, amount, type, description, reference)
      VALUES (
        legacy.user_id,
        legacy.balance,
        'legacy_credit_migration',
        'انتقال مانده اعتبار خرید قدیمی به کیف پول',
        'legacy-credit-migration:' || legacy.user_id
      )
      ON CONFLICT (reference) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Clear only balances already transferred above so older application instances
-- cannot expose and spend the same amount a second time. The row and ledger stay.
UPDATE customer_balances cb
SET balance = 0, updated_at = now()
FROM customer_wallet_credit_migrations migration
WHERE cb.phone = migration.legacy_phone
  AND migration.user_id IN (
    SELECT id FROM users WHERE phone = cb.phone
  );

-- Keep the previous credit activity visible in the unified wallet history too.
INSERT INTO customer_wallet_entries(user_id, amount, type, description, reference, created_at)
SELECT u.id,
       old_entry.amount,
       'legacy_credit_history',
       old_entry.note,
       'legacy-credit-entry:' || old_entry.id,
       old_entry.created_at
FROM customer_credit_entries old_entry
JOIN users u ON u.phone = old_entry.phone
ON CONFLICT (reference) DO NOTHING;
