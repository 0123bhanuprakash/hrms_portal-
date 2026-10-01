import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './modules/auth/decorators/public.decorator';

@ApiTags('Root')
@Controller()
@Public()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API Root Information' })
  getApiRoot() {
    return {
      name: 'HRMS Portal REST API',
      version: '1.0.0',
      status: 'online',
      documentation: '/api/docs',
      health: '/health',
      timestamp: new Date().toISOString(),
    };
  }
}
