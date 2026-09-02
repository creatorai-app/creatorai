-- The "Allow referral code lookups" policy granted anon SELECT on *every column*
-- of any profile with a referral_code — including password_reset_otp and
-- password_reset_otp_expires_at. With the public anon key, anyone could request
-- a password reset for a target address, read the OTP straight out of profiles,
-- and complete the reset without ever seeing the target's inbox.
--
-- Nothing depends on the policy: referral code lookups run server-side on the
-- service role key, which bypasses RLS. Signed-in users keep reading their own
-- row through the existing "auth.uid() = user_id" select policy.
drop policy if exists "Allow referral code lookups" on "public"."profiles";
