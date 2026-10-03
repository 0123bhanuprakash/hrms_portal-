import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';

@Injectable()
export class DesignationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The org level must belong to the same company (404 otherwise). */
  private async assertLevel(companyId: string, orgLevelId: string | null | undefined) {
    if (!orgLevelId) return;
    const found = await this.prisma.orgLevel.count({ where: { id: orgLevelId, companyId } });
    if (!found) throw new NotFoundException('Org level not found in this company');
  }

  async create(companyId: string, dto: CreateDesignationDto) {
    const trimmedName = dto.name.trim();

    const existing = await this.prisma.designation.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: trimmedName,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Designation '${trimmedName}' already exists in this company`,
      );
    }

    await this.assertLevel(companyId, dto.orgLevelId);

    return this.prisma.designation.create({
      data: {
        companyId,
        name: trimmedName,
        level: dto.level || 1,
        orgLevelId: dto.orgLevelId ?? null,
      },
      include: {
        _count: { select: { employees: true } },
        orgLevel: { select: { id: true, name: true, rank: true, color: true } },
      },
    });
  }

  async findAll(companyId: string, query?: { search?: string }) {
    const where: any = { companyId };

    if (query?.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    return this.prisma.designation.findMany({
      where,
      orderBy: [{ orgLevel: { rank: 'desc' } }, { level: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { employees: true } },
        orgLevel: { select: { id: true, name: true, rank: true, color: true } },
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const designation = await this.prisma.designation.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { employees: true } },
        orgLevel: { select: { id: true, name: true, rank: true, color: true } },
      },
    });

    if (!designation) {
      throw new NotFoundException(`Designation with ID '${id}' not found`);
    }

    return designation;
  }

  async update(companyId: string, id: string, dto: UpdateDesignationDto) {
    await this.findOne(companyId, id);

    if (dto.name) {
      const trimmedName = dto.name.trim();
      const existing = await this.prisma.designation.findFirst({
        where: {
          companyId,
          name: trimmedName,
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Designation '${trimmedName}' already in use`,
        );
      }
    }

    await this.assertLevel(companyId, dto.orgLevelId);

    return this.prisma.designation.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.orgLevelId !== undefined && { orgLevelId: dto.orgLevelId }),
      },
      include: {
        _count: { select: { employees: true } },
        orgLevel: { select: { id: true, name: true, rank: true, color: true } },
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);

    const employeeCount = await this.prisma.employee.count({
      where: { designationId: id },
    });

    if (employeeCount > 0) {
      throw new BadRequestException(
        `Cannot delete designation assigned to ${employeeCount} employee(s).`,
      );
    }

    await this.prisma.designation.delete({ where: { id } });

    return { message: 'Designation deleted successfully' };
  }
}
