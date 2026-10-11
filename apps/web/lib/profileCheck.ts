
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export type ProfileData = {
    id: string;
    credits: number;
    ai_trained: boolean;
    youtube_connected: boolean;
};

export async function checkUserPermissions(supabase: SupabaseClient) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { user: null, profile: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, credits, ai_trained, youtube_connected')
        .eq('user_id', user.id)
        .single();

    if (profileError || !profile) {
        return { user, profile: null, error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) };
    }

    const typedProfile: ProfileData = profile as ProfileData;

    if (!typedProfile.ai_trained && !typedProfile.youtube_connected) {
        return { user, profile: typedProfile, error: NextResponse.json({ message: 'AI memory and YouTube connection are required' }, { status: 403 }) };
    }

    if (typedProfile.credits < 1) {
        return { user, profile: typedProfile, error: NextResponse.json({
                error: 'Insufficient credits. Please upgrade your plan or earn more credits.'
            }, { status: 403 }) };
    }

    return { user, profile: typedProfile, error: null };
}

export async function decrementUserCredits(supabase: SupabaseClient, userId: string, amount: number) {
    const { error } = await supabase.rpc('decrement_user_credits', {
        user_id_to_update: userId,
        amount_to_decrement: amount
    });

    return { error };
}