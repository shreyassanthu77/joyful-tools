import { describe, expect, it } from 'vitest';
import { pipe } from './pipe';
import { Err, Ok, Result } from './result';

describe('Result', () => {
	it('ok and err', () => {
		const ok = new Ok('hello');
		expect(ok.ok()).toBe(true);
		expect(ok.err()).toBe(false);

		const err = new Err('hello');
		expect(err.ok()).toBe(false);
		expect(err.err()).toBe(true);
	});

	it('unwrap and unwrapErr', () => {
		const ok = new Ok('hello');
		expect(ok.unwrap()).toBe('hello');
		expect(() => ok.unwrapErr()).toThrow();

		const err = new Err('hello');
		expect(() => err.unwrap()).toThrow();
		expect(err.unwrapErr()).toBe('hello');
	});

	it('map', () => {
		const ok = new Ok('hello');
		const okMapped = pipe(
			ok,
			Result.map((value) => value.toUpperCase())
		);
		expect(okMapped.ok()).toBe(true);
		expect(okMapped.unwrap()).toBe('HELLO');

		const err = new Err<string, string>('hello');
		const errMapped = pipe(
			err,
			Result.map((value) => value.toUpperCase())
		);
		expect(errMapped.ok()).toBe(false);
	});

	it('mapErr', () => {
		const ok = new Ok<string, string>('hello');
		const okMapped = pipe(
			ok,
			Result.mapErr((error) => error.toUpperCase())
		);
		expect(okMapped.ok()).toBe(true);
		expect(okMapped.unwrap()).toBe('hello');

		const err = new Err<string, string>('hello');
		const errMapped = pipe(
			err,
			Result.mapErr((error) => error.toUpperCase())
		);
		expect(errMapped.ok()).toBe(false);
		expect(errMapped.unwrapErr()).toBe('HELLO');
	});

	it('andThen', () => {
		const ok = new Ok('hello');
		const okLen = pipe(
			ok,
			Result.andThen((value) => new Ok(value.length))
		);
		expect(okLen.ok()).toBe(true);
		expect(okLen.unwrap()).toBe(5);

		const err = new Err<string, string>('hello');
		const errLen = pipe(
			err,
			Result.andThen((value) => new Ok(value.length))
		);
		expect(errLen.ok()).toBe(false);
		expect(errLen.unwrapErr()).toBe('hello');
	});

	it('orElse', () => {
		const ok = new Ok<string, string>('hello');
		const okMapped = pipe(
			ok,
			Result.orElse(() => new Ok('world'))
		);
		expect(okMapped.ok()).toBe(true);
		expect(okMapped.unwrap()).toBe('hello');

		const err = new Err<string, string>('hello');
		const errMapped = pipe(
			err,
			Result.orElse((error) => new Ok(error))
		);
		expect(errMapped.ok()).toBe(true);
		expect(errMapped.unwrap()).toBe('hello');
	});
});
