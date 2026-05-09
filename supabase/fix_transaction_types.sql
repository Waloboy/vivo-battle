-- ============================================================
-- FIX: transactions_type_check constraint
-- Allows new standardized types + legacy types for compatibility
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Drop the old constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- 2. Create new constraint with all valid types
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'DEPOSIT',        -- New: Recarga de WCR
    'WITHDRAW',       -- New: Retiro de BCR
    'GIFT_SENT',      -- Envío de regalo en batalla
    'BATTLE_WON',     -- Victoria en batalla
    -- Legacy types (backward compat with existing data)
    'deposit',
    'DEPOSIT_PENDING',
    'withdrawal',
    'gift',
    'battle_win',
    'bonus',
    'manual_adjustment'
  ));

-- 3. Verify: list all distinct types currently in the table
SELECT DISTINCT type, COUNT(*) as total FROM transactions GROUP BY type ORDER BY type;
