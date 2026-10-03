import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeDocumentsController, EmployeeProfileController } from './employee-profile.controller';
import { PeopleController } from './people.controller';
import { PiiCryptoService } from './pii-crypto.service';
import { PrivateFilesService } from './private-files.service';
import { ProfileService } from './profile.service';
import { DocumentsService } from './documents.service';
import { PeopleService } from './people.service';

/** Self-service profile, private data (encrypted), documents, directory and spotlight. */
@Module({
  imports: [PrismaModule],
  controllers: [EmployeeProfileController, EmployeeDocumentsController, PeopleController],
  providers: [PiiCryptoService, PrivateFilesService, ProfileService, DocumentsService, PeopleService],
  exports: [PiiCryptoService, PrivateFilesService],
})
export class EmployeeProfileModule {}
