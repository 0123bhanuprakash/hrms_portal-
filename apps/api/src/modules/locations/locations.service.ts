import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateLocationDto) {
    if (dto.isDefault) {
      // Unset previous default
      await this.prisma.officeLocation.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.officeLocation.create({
      data: {
        companyId,
        name: dto.name.trim(),
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country || 'India',
        pincode: dto.pincode,
        isDefault: dto.isDefault || false,
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.officeLocation.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { employees: true } },
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const location = await this.prisma.officeLocation.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { employees: true } },
      },
    });

    if (!location) {
      throw new NotFoundException(`Office location with ID '${id}' not found`);
    }

    return location;
  }

  async update(companyId: string, id: string, dto: UpdateLocationDto) {
    await this.findOne(companyId, id);

    if (dto.isDefault) {
      await this.prisma.officeLocation.updateMany({
        where: { companyId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.officeLocation.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);

    const employeeCount = await this.prisma.employee.count({
      where: { locationId: id },
    });

    if (employeeCount > 0) {
      throw new BadRequestException(
        `Cannot delete office location assigned to ${employeeCount} employee(s).`,
      );
    }

    await this.prisma.officeLocation.delete({ where: { id } });

    return { message: 'Office location deleted successfully' };
  }
}
