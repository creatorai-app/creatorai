import { z } from 'zod';

export const MIN_WITHDRAWAL_AMOUNT = 50;

export const CreateAffiliateLinkSchema = z.object({
  label: z.string().trim().max(120).optional(),
  target_url: z.string().trim().max(512).optional(),
  promotion_channel: z.string().trim().max(500).optional(),
});
export type CreateAffiliateLinkInput = z.infer<typeof CreateAffiliateLinkSchema>;

export const PayoutMethodSchema = z.object({
  method: z.enum(['paypal', 'wise', 'bank']),
  details: z.record(z.string(), z.string().trim().max(256)),
});
export type PayoutMethodInput = z.infer<typeof PayoutMethodSchema>;

export const RequestWithdrawalSchema = z.object({
  amount: z.number().positive().min(MIN_WITHDRAWAL_AMOUNT, `Minimum withdrawal is $${MIN_WITHDRAWAL_AMOUNT}`),
});
export type RequestWithdrawalInput = z.infer<typeof RequestWithdrawalSchema>;

export const CreatePromoCodeSchema = z.object({
  owner_id: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(3, 'Code must be 3-256 characters')
    .max(256)
    .regex(/^[A-Z0-9]+$/, 'Only uppercase letters and numbers are allowed')
    .transform((val) => val.toUpperCase()),
  amount: z.number().positive(),
  amount_type: z.enum(['percent', 'fixed']),
  commission_rate: z.number().min(0).max(100).default(20),
  label: z.string().trim().max(120).optional(),
});
export type CreatePromoCodeInput = z.infer<typeof CreatePromoCodeSchema>;

export const UpdatePromoCodeSchema = z.object({
  commission_rate: z.number().min(0).max(100).optional(),
  label: z.string().trim().max(120).optional(),
  is_active: z.boolean().optional(),
});
export type UpdatePromoCodeInput = z.infer<typeof UpdatePromoCodeSchema>;

export const UpdateWithdrawalSchema = z.object({
  status: z.enum(['approved', 'paid', 'rejected']),
  admin_notes: z.string().trim().max(500).optional(),
});
export type UpdateWithdrawalInput = z.infer<typeof UpdateWithdrawalSchema>;
