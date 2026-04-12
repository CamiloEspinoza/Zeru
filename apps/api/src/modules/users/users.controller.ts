import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createUserSchema,
  updateUserSchema,
  updateMembershipSchema,
  linkPersonSchema,
  type CreateUserSchema,
  type UpdateUserSchema,
  type UpdateMembershipSchema,
  type LinkPersonSchema,
} from './dto';
import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
  ) {
    const query = {
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      search: search || undefined,
    };
    return this.usersService.findAll(tenantId, query);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.usersService.findById(id, tenantId);
  }

  @Get(':id/linked-person')
  getLinkedPerson(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.usersService.getLinkedPerson(id, tenantId);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserSchema,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.create(tenantId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserSchema,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.update(id, tenantId, body);
  }

  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMembershipSchema)) body: UpdateMembershipSchema,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.updateMembership(id, tenantId, body.role as UserRole);
  }

  @Patch(':id/link-person')
  linkPerson(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(linkPersonSchema)) body: LinkPersonSchema,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.linkPerson(id, tenantId, body.personProfileId);
  }

  @Patch(':id/unlink-person')
  unlinkPerson(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.unlinkPerson(id, tenantId);
  }
}
