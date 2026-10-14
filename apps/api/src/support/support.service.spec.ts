import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupportService } from './support.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockSupabaseService: Pick<SupabaseService, 'getClient'> = {
  getClient: () => ({
    from: () => ({ insert: () => Promise.resolve({ error: null }) }),
  }) as unknown as ReturnType<SupabaseService['getClient']>,
};

describe('SupportService', () => {
  let service: SupportService;

  describe('when Resend is not configured', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SupportService,
          { provide: ConfigService, useValue: { get: () => undefined } },
          { provide: SupabaseService, useValue: mockSupabaseService },
        ],
      }).compile();
      service = module.get<SupportService>(SupportService);
    });

    it('should throw InternalServerErrorException when email service not configured', async () => {
      await expect(
        service.reportIssue('Subject', 'user@test.com', 'Body text')
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('input validation', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SupportService,
          { provide: ConfigService, useValue: { get: () => undefined } },
          { provide: SupabaseService, useValue: mockSupabaseService },
        ],
      }).compile();
      service = module.get<SupportService>(SupportService);
    });

    it('should throw BadRequestException when subject is empty', async () => {
      await expect(
        service.reportIssue('', 'user@test.com', 'Body')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when email is empty', async () => {
      await expect(
        service.reportIssue('Subject', '', 'Body')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when body is empty', async () => {
      await expect(
        service.reportIssue('Subject', 'user@test.com', '')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when body is too long', async () => {
      await expect(
        service.reportIssue('Subject', 'user@test.com', 'x'.repeat(5001))
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delivery', () => {
    it('emails support and the admin notification address', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SupportService,
          { provide: ConfigService, useValue: { get: () => undefined } },
          { provide: SupabaseService, useValue: mockSupabaseService },
        ],
      }).compile();
      service = module.get<SupportService>(SupportService);
      const sendMock = jest.fn().mockResolvedValue({ data: { id: 'e1' }, error: null });
      (service as any).resend = { emails: { send: sendMock } };
      process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@test.com';

      await service.reportIssue('Feedback: Other', 'user@test.com', 'Love it');

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['support@trycreatorai.com', 'admin@test.com'],
          replyTo: 'user@test.com',
        }),
      );
      delete process.env.ADMIN_NOTIFICATION_EMAIL;
    });
  });
});
