import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import { RolesGuard, Roles } from '../guards/roles.guard';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private getUserId(req: AuthRequest): string {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }

  // ==================== DASHBOARD ====================

  @Get('stats')
  @ApiOperation({ summary: 'Admin dashboard aggregate stats' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('revenue-by-tier')
  @ApiOperation({ summary: 'Revenue, sales, failed payments and churn per plan' })
  getRevenueByTier() {
    return this.adminService.getRevenueByTier();
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Purchase-intent funnel: viewed -> clicked -> checkout -> completed' })
  getFunnel() {
    return this.adminService.getFunnel();
  }

  // ==================== USERS ====================

  @Get('users')
  @ApiOperation({ summary: 'Paginated users with filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers(
      Number(page) || 1,
      Number(limit) || 20,
      search,
      role,
    );
  }

  @Get('plans')
  @ApiOperation({ summary: 'Active membership plans (for admin assignment)' })
  getPlans() {
    return this.adminService.getPlans();
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiParam({ name: 'userId' })
  getUser(@Param('userId') userId: string) {
    return this.adminService.getUser(userId);
  }

  @Put('users/:userId/plan')
  @ApiOperation({ summary: 'Set a user membership plan and grant its credits' })
  @ApiParam({ name: 'userId' })
  @ApiBody({ schema: { type: 'object', required: ['planId'], properties: { planId: { type: 'string' }, validityMonths: { type: 'number', enum: [1, 2, 3, 6, 12] } } } })
  setUserPlan(
    @Param('userId') userId: string,
    @Body() body: { planId: string; validityMonths?: number },
    @Req() req: AuthRequest,
  ) {
    this.adminService.logActivity(this.getUserId(req), 'set_user_plan', 'user', userId, body);
    return this.adminService.setUserPlan(userId, body.planId, body.validityMonths);
  }

  @Put('users/:userId')
  @ApiOperation({ summary: 'Update user fields' })
  @ApiParam({ name: 'userId' })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  updateUser(
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthRequest,
  ) {
    this.adminService.logActivity(this.getUserId(req), 'update_user', 'user', userId, body);
    return this.adminService.updateUser(userId, body);
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'userId' })
  deleteUser(@Param('userId') userId: string, @Req() req: AuthRequest) {
    this.adminService.logActivity(this.getUserId(req), 'delete_user', 'user', userId);
    return this.adminService.deleteUser(userId);
  }

  // ==================== BLOGS ====================

  @Get('blogs')
  @ApiOperation({ summary: 'Paginated blog posts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getBlogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getBlogs(Number(page) || 1, Number(limit) || 20, status);
  }

  @Get('blogs/:id')
  @ApiOperation({ summary: 'Get blog post' })
  @ApiParam({ name: 'id' })
  getBlog(@Param('id') id: string) {
    return this.adminService.getBlog(id);
  }

  @Post('blogs')
  @ApiOperation({ summary: 'Create blog post' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'slug', 'content'],
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        excerpt: { type: 'string' },
        content: { type: 'string' },
        cover_image_url: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        status: { type: 'string' },
        featured: { type: 'boolean' },
      },
    },
  })
  createBlog(
    @Body() body: {
      title: string;
      slug: string;
      excerpt?: string;
      content: string;
      cover_image_url?: string;
      category?: string;
      tags?: string[];
      status?: string;
      featured?: boolean;
    },
    @Req() req: AuthRequest,
  ) {
    const userId = this.getUserId(req);
    this.adminService.logActivity(userId, 'create_blog', 'blog', undefined, { title: body.title });
    return this.adminService.createBlog(userId, body);
  }

  @Put('blogs/:id')
  @ApiOperation({ summary: 'Update blog post' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  updateBlog(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthRequest,
  ) {
    this.adminService.logActivity(this.getUserId(req), 'update_blog', 'blog', id);
    return this.adminService.updateBlog(id, body);
  }

  @Delete('blogs/:id')
  @ApiOperation({ summary: 'Delete blog post' })
  @ApiParam({ name: 'id' })
  deleteBlog(@Param('id') id: string, @Req() req: AuthRequest) {
    this.adminService.logActivity(this.getUserId(req), 'delete_blog', 'blog', id);
    return this.adminService.deleteBlog(id);
  }

  // ==================== ACTIVITIES ====================

  @Get('activities')
  @ApiOperation({ summary: 'Cross-feature user activity feed' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'category', required: false, description: 'feature | error | subscription | affiliate' })
  getActivities(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.adminService.getActivityFeed(
      Number(page) || 1,
      Number(limit) || 30,
      category,
    );
  }

  // ==================== MAILS ====================

  @Get('mails')
  @ApiOperation({ summary: 'Outbound mail log' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getMails(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getMails(Number(page) || 1, Number(limit) || 20, status);
  }

  @Get('mails/:id')
  @ApiOperation({ summary: 'Get a single mail message' })
  @ApiParam({ name: 'id' })
  getMail(@Param('id') id: string) {
    return this.adminService.getMail(id);
  }

  @Post('mails/:id/reply')
  @ApiOperation({ summary: 'Reply to a mail via Resend and mark it replied' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', required: ['subject', 'html'], properties: { subject: { type: 'string' }, html: { type: 'string' } } } })
  replyToMail(
    @Param('id') id: string,
    @Body() body: { subject: string; html: string },
    @Req() req: AuthRequest,
  ) {
    const userId = this.getUserId(req);
    this.adminService.logActivity(userId, 'reply_mail', 'mail_message', id, { subject: body.subject });
    return this.adminService.replyToMail(id, userId, body.subject, body.html);
  }

  @Put('mails/:id')
  @ApiOperation({ summary: 'Update mail delivery status' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } } })
  updateMailStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: AuthRequest,
  ) {
    return this.adminService.updateMailStatus(id, body.status, this.getUserId(req));
  }

  // ==================== JOB POSTS CRUD ====================

  @Get('jobs')
  @ApiOperation({ summary: 'List job posts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getJobs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getJobPosts(Number(page) || 1, Number(limit) || 20, status);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job post' })
  @ApiParam({ name: 'id' })
  getJob(@Param('id') id: string) {
    return this.adminService.getJobPost(id);
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Create job post' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'team', 'description'],
      properties: {
        title: { type: 'string' },
        team: { type: 'string' },
        location: { type: 'string' },
        type: { type: 'string' },
        category: { type: 'string', enum: ['engineering', 'ai', 'design', 'marketing', 'business', 'other'] },
        description: { type: 'string' },
        requirements: { type: 'string' },
        status: { type: 'string', enum: ['active', 'inactive', 'closed'] },
      },
    },
  })
  createJob(
    @Body() body: Record<string, unknown>,
    @Req() req: AuthRequest,
  ) {
    this.adminService.logActivity(this.getUserId(req), 'create_job', 'job_post', undefined, { title: body.title });
    return this.adminService.createJobPost(body);
  }

  @Put('jobs/:id')
  @ApiOperation({ summary: 'Update job post' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  updateJob(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthRequest,
  ) {
    this.adminService.logActivity(this.getUserId(req), 'update_job', 'job_post', id);
    return this.adminService.updateJobPost(id, body);
  }

  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Delete job post' })
  @ApiParam({ name: 'id' })
  deleteJob(@Param('id') id: string, @Req() req: AuthRequest) {
    this.adminService.logActivity(this.getUserId(req), 'delete_job', 'job_post', id);
    return this.adminService.deleteJobPost(id);
  }

  // ==================== JOB APPLICATIONS ====================

  @Get('applications')
  @ApiOperation({ summary: 'List job applications' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getApplications(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getApplications(Number(page) || 1, Number(limit) || 20, status);
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Get job application' })
  @ApiParam({ name: 'id' })
  getApplication(@Param('id') id: string) {
    return this.adminService.getApplication(id);
  }

  @Put('applications/:id')
  @ApiOperation({ summary: 'Update application status' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: { status: { type: 'string' }, notes: { type: 'string' } },
    },
  })
  updateApplicationStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
    @Req() req: AuthRequest,
  ) {
    const userId = this.getUserId(req);
    this.adminService.logActivity(userId, 'update_application', 'job_application', id, body);
    return this.adminService.updateApplicationStatus(id, body.status, userId, body.notes);
  }

  @Delete('applications/:id')
  @ApiOperation({ summary: 'Delete job application' })
  @ApiParam({ name: 'id' })
  deleteApplication(@Param('id') id: string, @Req() req: AuthRequest) {
    this.adminService.logActivity(this.getUserId(req), 'delete_application', 'job_application', id);
    return this.adminService.deleteApplication(id);
  }

  // ==================== SUBSCRIPTIONS ====================

  @Get('subscriptions')
  @ApiOperation({ summary: 'All subscriptions with owning user and plan' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllSubscriptions(Number(page) || 1, Number(limit) || 20, status);
  }

  // ==================== AFFILIATES ====================

  @Get('affiliates/links')
  @ApiOperation({ summary: 'All affiliate links' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAffiliateLinks(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllAffiliateLinks(Number(page) || 1, Number(limit) || 20);
  }

  @Get('affiliates/sales')
  @ApiOperation({ summary: 'All affiliate sales' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAffiliateSales(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllAffiliateSales(Number(page) || 1, Number(limit) || 20);
  }

  @Put('affiliates/links/:id')
  @ApiOperation({ summary: 'Update affiliate link' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  updateAffiliateLink(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthRequest,
  ) {
    this.adminService.logActivity(this.getUserId(req), 'update_affiliate_link', 'affiliate_link', id, body);
    return this.adminService.updateAffiliateLink(id, body);
  }

  @Put('affiliates/sales/:id')
  @ApiOperation({ summary: 'Update affiliate sale status' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } } })
  updateAffiliateSaleStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: AuthRequest,
  ) {
    this.adminService.logActivity(this.getUserId(req), 'update_sale_status', 'affiliate_sale', id, body);
    return this.adminService.updateAffiliateSaleStatus(id, body.status);
  }
}
