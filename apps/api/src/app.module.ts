import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { HealthController } from './health.controller';
import { ReadinessController } from './readiness.controller';

@Module({
  controllers: [HealthController, ReadinessController],
  providers: [DatabaseService],
})
export class AppModule {}
