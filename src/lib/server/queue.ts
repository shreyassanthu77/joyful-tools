import { kv } from "./kv.ts";
import { nanoid } from "../nanoid.ts";

const queues = new Map<string, Queue<any>>();
export type QueueOptions<T> = {
	channel: string;
	handler: (data: T) => Promise<void>;
	onFailure?: (data: T, error: unknown) => Promise<void>;
	maxRetries?: number;
	retryDelay?: number;
};

export function createQueue<T>(options: QueueOptions<T>) {
	const {
		channel,
		handler,
		onFailure,
		maxRetries = 3,
		retryDelay = 200,
	} = options;
	if (queues.has(channel)) {
		throw new Error(`Queue with channel ${channel} already exists`);
	}

	async function $enqueue(data: T, delay?: number) {
		const id = nanoid(10);
		const msg: Payload<T> = {
			[MSG_TAG]: channel,
			id,
			data,
			attempt: 0,
		};
		await kv.enqueue(msg, {
			delay,
		});
	}

	$enqueue.getFailed = async function* (): AsyncGenerator<
		Payload<T>,
		void,
		unknown
	> {
		const msgs = kv.list<Payload<T>>({
			prefix: ["queue_deadletter", channel],
		});
		for await (const msg of msgs) {
			yield msg.value;
		}
		return;
	};

	queues.set(channel, { handler, maxRetries, retryDelay, onFailure });

	return $enqueue;
}

type Queue<T> = {
	maxRetries: number;
	retryDelay: number;
	handler: (data: T) => Promise<void>;
	onFailure?: (data: T, error: unknown) => Promise<void>;
};

const MSG_TAG = "$$QUEUE_MSG$$";
type Payload<T> = {
	[MSG_TAG]: string;
	id: string;
	data: T;
	attempt: number;
	error?: string;
};

function isPayload<T>(msg: unknown): msg is Payload<T> {
	return MSG_TAG in (msg as object);
}

kv.listenQueue(async (msg: unknown) => {
	if (!isPayload(msg)) return;
	const channel = msg[MSG_TAG];
	const queue = queues.get(channel);
	if (!queue) return;
	try {
		await queue.handler(msg.data);
	} catch (err) {
		msg.attempt++;
		if (msg.attempt >= queue.maxRetries) {
			if (queue.onFailure) {
				await queue.onFailure(msg.data, err);
				return;
			}
			msg.error = String(err);
			await kv.set(["queue_deadletter", channel, msg.id], msg);
			return;
		}
		await kv.enqueue(msg, { delay: queue.retryDelay });
	}
});
