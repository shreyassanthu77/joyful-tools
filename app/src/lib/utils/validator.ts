import { Err, Ok, Result } from './result';
import type { StandardSchemaV1 } from './standard-schema';

type ValidationResult<Schema extends StandardSchemaV1> = Result<
	StandardSchemaV1.InferOutput<Schema>,
	StandardSchemaV1.FailureResult
>;

export function validate<
	Schema extends StandardSchemaV1,
	Input = StandardSchemaV1.InferInput<Schema>
>(s: Schema, input: Input): ValidationResult<Schema> {
	if (import.meta.env.DEV) {
		if (s['~standard'].version !== 1) {
			throw new Error('Standard schema version mismatch. Expected 1.');
		}
	}

	const result = s['~standard'].validate(input);
	if (result instanceof Promise) {
		throw new Error('Async validation is not supported.');
	}
	if (result.issues) {
		return new Err(result);
	}
	return new Ok(result.value);
}

// export function validateAsync<
// 	Schema extends StandardSchemaV1,
// 	Input = StandardSchemaV1.InferInput<Schema>
// >(
// 	s: Schema,
// 	input: Input
// ): AsyncResult<StandardSchemaV1.InferOutput<Schema>, StandardSchemaV1.FailureResult> {
// 	if (import.meta.env.DEV) {
// 		if (s['~standard'].version !== 1) {
// 			throw new Error('Standard schema version mismatch. Expected 1.');
// 		}
// 	}
//
// 	return Result.fromAsync(async () => {
// 		const result = await s['~standard'].validate(input);
// 		if (result.issues) {
// 			throw result;
// 		}
// 		return result.value;
// 	});
// }
