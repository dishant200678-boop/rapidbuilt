import { ZodError } from 'zod';
export function validate(schema) {
    return async (req, _res, next) => {
        try {
            if ('parseAsync' in schema && typeof schema.parseAsync === 'function') {
                const parsed = await schema.parseAsync({
                    body: req.body,
                    query: req.query,
                    params: req.params,
                });
                if (parsed.body !== undefined)
                    req.body = parsed.body;
                if (parsed.query !== undefined)
                    req.query = parsed.query;
                if (parsed.params !== undefined)
                    req.params = parsed.params;
            }
            else {
                const plainSchema = schema;
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
        }
        catch (error) {
            if (error instanceof ZodError) {
                next(error);
            }
            else {
                next(error);
            }
        }
    };
}
