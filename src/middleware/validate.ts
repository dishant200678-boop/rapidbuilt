import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';

type SchemaInput =
  | ZodTypeAny
  | {
      body?: ZodTypeAny;
      query?: ZodTypeAny;
      params?: ZodTypeAny;
    };

export function validate(schema: SchemaInput) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if ('parseAsync' in schema && typeof schema.parseAsync === 'function') {
        const parsed = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        }) as Record<string, any>;

        if (parsed.body !== undefined) req.body = parsed.body;
        if (parsed.query !== undefined) req.query = parsed.query;
        if (parsed.params !== undefined) req.params = parsed.params;
      } else {
        const plainSchema = schema as {
          body?: ZodTypeAny;
          query?: ZodTypeAny;
          params?: ZodTypeAny;
        };
        if (plainSchema.body) {
          req.body = await plainSchema.body.parseAsync(req.body);
        }
        if (plainSchema.query) {
          req.query = await plainSchema.query.parseAsync(req.query);
        }
        if (plainSchema.params) {
          req.params = await plainSchema.params.parseAsync(req.params);
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
}
