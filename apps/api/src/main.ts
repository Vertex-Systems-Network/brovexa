import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { parseRuntimeEnvironment } from '@brovexa/config';
import { AppModule } from './app.module';
import { ApiExceptionFilter, requestContextMiddleware } from './observability';

async function bootstrap(): Promise<void> {
  const runtime = parseRuntimeEnvironment(process.env);
  const app = await NestFactory.create(AppModule);

  app.use(requestContextMiddleware);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(runtime.PORT, runtime.HOST);
}

bootstrap().catch(() => {
  console.error('Brovexa API failed to start.');
  process.exitCode = 1;
});
