import { kv } from "./kv.ts";
import { nanoid } from "../nanoid.ts";

const queues = new Map<string, Queue<any>>();
export type QueueOptions<T> = {
	channel: string;
	handler: (data: T) => Promise<void>;
};

export function createQueue<T>(options: QueueOptions<T>) {
	const { channel, handler } = options;
	if (queues.has(channel)) {
		throw new Error(`Queue with channel ${channel} already exists`);
	}
	queues.set(channel, { handler });

	async function $enqueue(data: T, delay?: number) {
		const id = nanoid(10);
		const msg: Payload<T> = {
			[MSG_TAG]: channel,
			id,
			data,
		};
		await kv.enqueue(msg, { delay });
	}

	return $enqueue;
}

type Queue<T> = {
	handler: (data: T) => Promise<void>;
};

const MSG_TAG = "$$QUEUE_MSG$$";
type Payload<T> = {
	[MSG_TAG]: string;
	id: string;
	data: T;
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
		// TODO: handle error
	}
});
