-- Function to atomically add points to a battle
CREATE OR REPLACE FUNCTION add_battle_points(
    p_battle_id UUID,
    p_side TEXT,
    p_points INT
) RETURNS void AS $$
BEGIN
    IF p_side = 'A' THEN
        UPDATE battles
        SET score_a = score_a + p_points
        WHERE id = p_battle_id AND is_active = true;
    ELSIF p_side = 'B' THEN
        UPDATE battles
        SET score_b = score_b + p_points
        WHERE id = p_battle_id AND is_active = true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
