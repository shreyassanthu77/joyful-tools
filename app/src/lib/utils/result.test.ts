import { describe, expect, it, vi } from 'vitest';
import { AsyncResult, Err, Ok, Result } from './result';

describe('Result.Ok', () => {
	it('ok', () => {
		const result = new Ok('hello');
		expect(result.ok()).toBe(true);
	});

	it('err', () => {
		const result = new Ok('hello');
		expect(result.err()).toBe(false);
	});

	it('unwrap', () => {
		const result = new Ok('hello');
		expect(result.unwrap()).toBe('hello');
	});

	it('unwrapErr', () => {
		const result = new Ok('hello');
		expect(() => result.unwrapErr()).toThrow();
	});

	it('unwrapOr', () => {
		const result = new Ok('hello');
		expect(result.unwrapOr('world')).toBe('hello');
	});

	it('andThen', () => {
		const result = new Ok('hello').andThen((value) => new Ok(value.toUpperCase()));
		expect(result.unwrap()).toBe('HELLO');
	});

	it('orElse', () => {
		const result = new Ok('hello').orElse(() => new Ok('world'));
		expect(result.unwrap()).toBe('hello');
	});

	it('map', () => {
		const result = new Ok('hello').map((value) => value.toUpperCase());
		expect(result.unwrap()).toBe('HELLO');
	});

	it('mapErr', () => {
		const result = new Ok('hello').mapErr(() => 'world');
		expect(result.unwrap()).toBe('hello');
	});

	it('mapOrDefault', () => {
		const withValue = new Ok('hello').mapOrDefault('world');
		expect(withValue.unwrap()).toBe('hello');

		const withFn = new Ok('hello').mapOrDefault(() => 'world');
		expect(withFn.unwrap()).toBe('hello');
	});
});

describe('Result.Err', () => {
	it('ok', () => {
		const result = new Err('hello');
		expect(result.ok()).toBe(false);
	});

	it('err', () => {
		const result = new Err('hello');
		expect(result.err()).toBe(true);
	});

	it('unwrap', () => {
		const result = new Err('hello');
		expect(() => result.unwrap()).toThrow();
	});

	it('unwrapErr', () => {
		const result = new Err('hello');
		expect(result.unwrapErr()).toBe('hello');
	});

	it('unwrapOr', () => {
		const result = new Err('hello');
		expect(result.unwrapOr('world')).toBe('world');
	});

	it('andThen', () => {
		const result = new Err('hello').andThen(() => new Ok('world'));
		expect(result.unwrapErr()).toBe('hello');
	});

	it('orElse', () => {
		const result = new Err('hello').orElse(() => new Ok('world'));
		expect(result.unwrap()).toBe('world');
	});

	it('map', () => {
		const result = new Err('hello').map(() => 'world');
		expect(result.unwrapErr()).toBe('hello');
	});

	it('mapErr', () => {
		const result = new Err('hello').mapErr(() => 'world');
		expect(result.unwrapErr()).toBe('world');
	});

	it('mapOrDefault', () => {
		const withValue = new Err('hello').mapOrDefault('world');
		expect(withValue.unwrap()).toBe('world');

		const withFn = new Err('hello').mapOrDefault(() => 'world');
		expect(withFn.unwrap()).toBe('world');
	});
});

describe('AsyncResult', () => {
	it('basic', async () => {
		const a = new AsyncResult(Promise.resolve(new Ok('hello')));
		const result = await a;
		expect(result.ok()).toBe(true);
		expect(result.unwrap()).toBe('hello');

		const b = new AsyncResult(Promise.resolve(new Err('hello')));
		const result2 = await b;
		expect(result2.ok()).toBe(false);
		expect(result2.unwrapErr()).toBe('hello');
	});

	it('fromAsync simple', async () => {
		const a = await Result.fromAsync(async () => {
			return 'hello';
		});
		expect(a).toBeInstanceOf(Ok);
		expect(a.unwrap()).toBe('hello');
	});

	it('fromAsync that throws', async () => {
		const a = await Result.fromAsync<never, Error>(async () => {
			throw new Error('yoo');
		});
		expect(a).toBeInstanceOf(Err);
		expect(a.unwrapErr()).toBeInstanceOf(Error);
	});
});
