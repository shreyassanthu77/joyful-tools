import { Result } from './result';

export function jsonParse(value: string): Result<unknown, Error> {
	try {
		return Result.ok(JSON.parse(value));
	} catch (e) {
		return Result.err(e as Error);
	}
}

export function jsonStringify(value: unknown): Result<string, Error> {
	try {
		return Result.ok(JSON.stringify(value));
	} catch (e) {
		return Result.err(e as Error);
	}
}
