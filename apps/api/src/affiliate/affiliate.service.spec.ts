import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AffiliateService } from './affiliate.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createDiscount, deleteDiscount } from '@lemonsqueezy/lemonsqueezy.js';

jest.mock('@lemonsqueezy/lemonsqueezy.js', () => ({
  lemonSqueezySetup: jest.fn(),
  createDiscount: jest.fn(),
  deleteDiscount: jest.fn(),
  listDiscounts: jest.fn(),
}));

const mockCreateDiscount = createDiscount as jest.Mock;
const mockDeleteDiscount = deleteDiscount as jest.Mock;

const mockFrom = jest.fn();
const mockAdminClient = { from: mockFrom };
const mockSupabaseService = {
  getAdminClient: () => mockAdminClient,
};

describe('AffiliateService', () => {
  let service: AffiliateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'LEMONSQUEEZY_STORE_ID') return 'store_123';
              if (key === 'LEMONSQUEEZY_API_KEY') return 'ls_key';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
  });

  describe('submitRequest', () => {
    it('throws when a pending request already exists', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'affiliate_requests') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  maybeSingle: () => ({ data: { id: 'req-1', status: 'pending' } }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.submitRequest('user-1', { reason: 'I can promote this.' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses profile name and email instead of client payload', async () => {
      const insertMock = jest.fn().mockReturnValue({
        select: () => ({
          single: () => ({ data: { id: 'req-new' }, error: null }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'affiliate_requests') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  maybeSingle: () => ({ data: null }),
                }),
              }),
            }),
            insert: insertMock,
          };
        }
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: {
                    full_name: 'Session User',
                    name: 'Session User Alt',
                    email: 'session@user.com',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      await service.submitRequest('user-1', {
        full_name: 'Spoofed Name',
        email: 'spoofed@email.com',
        reason: 'I can promote this.',
      });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          full_name: 'Session User',
          email: 'session@user.com',
          reason: 'I can promote this.',
        }),
      );
    });
  });

  describe('reviewRequest', () => {
    it('throws NotFoundException when request is missing', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'affiliate_requests') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({ data: null, error: { message: 'not found' } }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.reviewRequest('req-1', 'admin-1', 'approved'),
      ).rejects.toThrow(NotFoundException);
    });

    it('sends approval email with the admin note as the message when approved', async () => {
      const sendMock = jest.fn().mockResolvedValue({ id: 'mail-1' });
      (service as any).resend = { emails: { send: sendMock } };
      const updateMock = jest.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => ({ data: { id: 'req-1', status: 'approved' }, error: null }),
          }),
        }),
      });

      let requestFetchCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'affiliate_requests') {
          requestFetchCount += 1;
          if (requestFetchCount === 1) {
            return {
              select: () => ({
                eq: () => ({
                  single: () => ({
                    data: {
                      id: 'req-1',
                      status: 'pending',
                      email: 'applicant@test.com',
                      full_name: 'Applicant',
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            update: updateMock,
          };
        }
        return {};
      });

      await service.reviewRequest('req-1', 'admin-1', 'approved', 'Welcome aboard!');

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          reviewed_by: 'admin-1',
          admin_notes: 'Welcome aboard!',
        }),
      );
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('support@trycreatorai.com'),
          to: 'applicant@test.com',
          subject: expect.stringContaining('approved'),
          html: expect.stringContaining('Welcome aboard!'),
        }),
      );
    });

    it('does not send approval email for denied action', async () => {
      const sendMock = jest.fn();
      (service as any).resend = { emails: { send: sendMock } };

      let requestFetchCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'affiliate_requests') {
          requestFetchCount += 1;
          if (requestFetchCount === 1) {
            return {
              select: () => ({
                eq: () => ({
                  single: () => ({
                    data: {
                      id: 'req-1',
                      status: 'pending',
                      email: 'applicant@test.com',
                      full_name: 'Applicant',
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => ({ data: { id: 'req-1', status: 'denied' }, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await service.reviewRequest('req-1', 'admin-1', 'denied', 'Not a fit right now');

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('throws when approved but email provider is not configured', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'affiliate_requests') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: {
                    id: 'req-1',
                    status: 'pending',
                    email: 'applicant@test.com',
                    full_name: 'Applicant',
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => ({ data: { id: 'req-1', status: 'approved' }, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.reviewRequest('req-1', 'admin-1', 'approved'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('promo codes', () => {
    const EXISTING = {
      id: 'promo-1',
      owner_id: 'user-1',
      code: 'CREATOR20',
      ls_discount_id: 'ls-1',
      amount: 20,
      amount_type: 'percent',
      commission_rate: 20,
      label: 'Launch',
      is_active: true,
    };

    // Records what the row was updated with, and lets each test say how many
    // sales point at the code (delete is blocked once any do).
    const mockPromoTable = (salesCount = 0) => {
      const updateMock = jest.fn().mockReturnValue({
        eq: () => ({ select: () => ({ single: () => ({ data: EXISTING, error: null }) }) }),
      });
      const deleteMock = jest.fn().mockReturnValue({ eq: () => ({ error: null }) });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'affiliate_promo_codes') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: () => ({ data: EXISTING }) }) }),
            update: updateMock,
            delete: deleteMock,
          };
        }
        if (table === 'affiliate_sales') {
          return {
            select: () => ({ eq: () => ({ count: salesCount }) }),
          };
        }
        return {};
      });

      return { updateMock, deleteMock };
    };

    beforeEach(() => {
      mockDeleteDiscount.mockResolvedValue({ error: null });
      mockCreateDiscount.mockResolvedValue({ data: { data: { id: 'ls-2' } }, error: null });
    });

    it('deleting the Lemon Squeezy discount is what deactivation means', async () => {
      const { updateMock } = mockPromoTable();

      await service.updatePromoCode('promo-1', { is_active: false });

      expect(mockDeleteDiscount).toHaveBeenCalledWith('ls-1');
      expect(mockCreateDiscount).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false, ls_discount_id: null }),
      );
    });

    it('recreates the discount when the amount changes (LS has no update endpoint)', async () => {
      const { updateMock } = mockPromoTable();

      await service.updatePromoCode('promo-1', { amount: 35 });

      expect(mockDeleteDiscount).toHaveBeenCalledWith('ls-1');
      expect(mockCreateDiscount).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'CREATOR20', amount: 35, amountType: 'percent' }),
      );
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 35, ls_discount_id: 'ls-2' }),
      );
    });

    it('leaves Lemon Squeezy alone when only commission and label change', async () => {
      const { updateMock } = mockPromoTable();

      await service.updatePromoCode('promo-1', { commission_rate: 30, label: 'Renamed' });

      expect(mockDeleteDiscount).not.toHaveBeenCalled();
      expect(mockCreateDiscount).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ commission_rate: 30, label: 'Renamed', ls_discount_id: 'ls-1' }),
      );
    });

    it('refuses to delete a code that already has attributed sales', async () => {
      const { deleteMock } = mockPromoTable(3);

      await expect(service.deletePromoCode('promo-1')).rejects.toThrow(ConflictException);
      expect(deleteMock).not.toHaveBeenCalled();
      expect(mockDeleteDiscount).not.toHaveBeenCalled();
    });

    it('deletes the row and the Lemon Squeezy discount when unused', async () => {
      const { deleteMock } = mockPromoTable(0);

      await expect(service.deletePromoCode('promo-1')).resolves.toEqual({ success: true });
      expect(mockDeleteDiscount).toHaveBeenCalledWith('ls-1');
      expect(deleteMock).toHaveBeenCalled();
    });
  });
});
