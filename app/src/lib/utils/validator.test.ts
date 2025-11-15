import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { validate, validateAsync } from './validator';
import { Err, Ok } from './result';

describe('sync', () => {
	it('should validate', () => {
		const schema = v.string();
		const result = validate(schema, 'hello');
		expect(result).toBeInstanceOf(Ok);
		expect(result.unwrap()).toBe('hello');
	});

	it('should fail', () => {
		const schema = v.object({
			a: v.string()
		});
		const result = validate(schema, {});
		expect(result).toBeInstanceOf(Err);
		expect(result.unwrapErr().issues.length).toBe(1);
	});

	it('should throw on async', () => {
		const schema = v.pipeAsync(v.string());
		expect(() => validate(schema, 'hello')).toThrow();
	});
});

describe('async', () => {
	it('should validate', async () => {
		const schema = v.pipeAsync(v.string());
		const result = await validateAsync(schema, 'hello');
		expect(result).toBeInstanceOf(Ok);
		expect(result.unwrap()).toBe('hello');
	});

	it('should fail', async () => {
		const schema = v.pipeAsync(v.object({ a: v.string() }));
		const result = await validateAsync(schema, {});
		expect(result).toBeInstanceOf(Err);
		expect(result.unwrapErr().issues.length).toBe(1);
	});
});
