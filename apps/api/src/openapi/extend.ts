import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Must run before any contract schema is created, hence it is the first import of `main.ts`
// and of the OpenAPI spec module.
extendZodWithOpenApi(z);
