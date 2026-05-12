-- Drop existing constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add updated constraint including 'gift'
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('DEPOSIT', 'DEPOSIT_PENDING', 'WITHDRAW', 'WITHDRAW_BCR', 'BATTLE_WIN', 'GIFT_SENT', 'gift', 'bonus', 'manual_adjustment', 'BATTLE_REFUND', 'GIFT_RECEIVED'));
