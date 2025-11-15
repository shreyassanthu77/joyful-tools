import { Err, Ok, Result } from './result';

export function jsonParse(value: string): Result<unknown, Error>;
export function jsonParse(value: string, defaultValue: unknown): Result<unknown, never>;
export function jsonParse(value: string, defaultValue?: unknown): Result<unknown, Error> {
	try {
		return new Ok(JSON.parse(value));
	} catch (e) {
		if (defaultValue !== undefined) {
			return new Ok(defaultValue);
		}
		return new Err(e as Error);
	}
}

export function jsonStringify(value: unknown): Result<string, Error> {
	try {
		return new Ok(JSON.stringify(value));
	} catch (e) {
		return new Err(e as Error);
	}
}
