const express = require('express');
const router = express.Router(); // to attach routers
const supabase = require('../lib/supabase'); // import supabase

/* --- USER PREFERENCES ENDPOINTS ---*/

router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('preferred_model, preferred_language, updated_at')
            .eq('user_id', userId)
            .single();

        if (error && error.code === 'PGRST116') {
            // No row found – auto-create with SQL DEFAULT
            const { data: newPref, error: insertError } = await supabase
                .from('user_preferences')
                .insert({ user_id: userId })
                .select('preferred_model, preferred_language, updated_at')
                .single();
            if (insertError) throw insertError;
            return res.json(newPref);
        }
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('[Preferences GET] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});

router.put('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { preferred_model, preferred_language } = req.body;
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    if (!preferred_model) return res.status(400).json({ error: 'preferred_model is required' });

    // Build the upsert payload
    const upsertPayload = {
        user_id: userId,
        preferred_model,
        updated_at: new Date().toISOString()
    };
    if (preferred_language) {
        upsertPayload.preferred_language = preferred_language;
    }

    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .upsert(upsertPayload, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('[Preferences PUT] Error:', error.message);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

module.exports = router;