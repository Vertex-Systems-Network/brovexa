"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const config_1 = require("@brovexa/config");
const app_module_1 = require("./app.module");
const observability_1 = require("./observability");
async function bootstrap() {
    const runtime = (0, config_1.parseRuntimeEnvironment)(process.env);
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use(observability_1.requestContextMiddleware);
    app.useGlobalFilters(new observability_1.ApiExceptionFilter());
    app.enableShutdownHooks();
    await app.listen(runtime.PORT, runtime.HOST);
}
bootstrap().catch(() => {
    console.error('Brovexa API failed to start.');
    process.exitCode = 1;
});
//# sourceMappingURL=main.js.map