/* validate(schema, 'body' | 'params' | 'query') -> parsed data in req.valid[source] */
const validate = (schema, source = 'body') => (req, res, next) => {
  req.valid = req.valid || {};
  req.valid[source] = schema.parse(req[source]); // ZodError is handled by errorHandler
  next();
};
module.exports = { validate };
