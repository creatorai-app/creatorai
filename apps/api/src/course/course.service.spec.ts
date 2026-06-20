import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourseService } from './course.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockSupabaseClient = { from: mockFrom, rpc: mockRpc };
const mockSupabaseService = {
  getClient: () => mockSupabaseClient,
};

describe('CourseService', () => {
  let service: CourseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_CLOUD_PROJECT') return 'test-project';
              if (key === 'GOOGLE_CLOUD_LOCATION') return 'global';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CourseService>(CourseService);
  });

  describe('generate', () => {
    it('should throw BadRequestException when topic is empty', async () => {
      await expect(
        service.generate('user-1', { topic: '' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when credits are insufficient', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => ({
              data: { credits: 1 },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        service.generate('user-1', { topic: 'JavaScript Basics' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw InternalServerErrorException when profile fetch fails', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => ({
              data: null,
              error: { message: 'error' },
            }),
          }),
        }),
      });

      await expect(
        service.generate('user-1', { topic: 'JavaScript' })
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
