import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { parseRuntimeEnvironment } from '@brovexa/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const runtime = parseRuntimeEnvironment(process.env);
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  await app.listen(runtime.PORT, runtime.HOST);
}

void bootstrap();
