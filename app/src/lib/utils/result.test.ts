import { describe, expect, it } from 'vitest';
import { Err, Ok, Result } from './result';

describe('AsyncResult', () => {
	it('should resolve', async () => {
		const result = await Result.fromAsync(async () => {
			return 'hello';
		});
		expect(result).toBeInstanceOf(Ok);
		expect(result.unwrap()).toBe('hello');
	});

	it('should reject', async () => {
		const result = await Result.fromAsync<never, Error>(async () => {
			throw new Error('hello');
		});
		expect(result).toBeInstanceOf(Err);
		expect(result.unwrapErr()).toBeInstanceOf(Error);
		expect(result.unwrapErr().message).toBe('hello');
	});
});
