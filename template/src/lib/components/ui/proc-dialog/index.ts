import type { Component, ComponentProps, Snippet } from "svelte";
import DialogProvider from "./dialog-provider.svelte";
import { dialogState } from "./dialog-state.svelte.ts";
import ConfirmDialog from "./confirm-dialog.svelte";
import type { ButtonVariant } from "$lib/components/ui/button"

export interface DialogBaseProps<T> {
	close: void extends T ? () => void : (result: T) => void;
}

export interface DialogSnippetProps<Data = never, T = void>
	extends DialogBaseProps<T> {
	data: Data;
}

export type DialogComponentProps<Props, T = void> = void extends Props
	? DialogBaseProps<T>
	: DialogBaseProps<T> & Props;

type BaseDialog<Kind extends string, Other> = Prettify<
	{
		id: number;
		kind: Kind;
		resolvers: ReturnType<typeof withResolvers<any>>;
	} & Other
>;

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type ConfirmDialogOptions = {
	title: string;
	message: string;
	styles?: {
		reverseActions?: boolean;
		header?: string;
		content?: string;
		footer?: string;
		title?: string;
		message?: string;
		confirm?: string;
		confirmVariant?: ButtonVariant;
		cancel?: string;
		cancelVariant?: ButtonVariant;
	};
	onConfirm?: () => void | Promise<void>;
	onCancel?: () => void | Promise<void>;
};

export type Dialog =
	| BaseDialog<
		"snippet",
		{
			snippet: {
				s: Snippet<[DialogSnippetProps<any>]>;
				props: any;
			};
		}
	>
	| BaseDialog<
		"component",
		{
			component: Component<any, any, any>;
			props: any;
		}
	>
	| BaseDialog<"confirm", ConfirmDialogOptions>;

let id = 0;

function snippet<T = void, Props = never>(
	snippet: Snippet<[DialogSnippetProps<Props>]>,
	props?: Props,
): Promise<T | void>;
function snippet<T = void, Props = {}>(
	snippet: Snippet<[DialogSnippetProps<Props>]>,
	props: Props,
): Promise<T | void> {
	const resolvers = withResolvers<T>();
	dialogState.add({
		id: id++,
		kind: "snippet",
		snippet: {
			s: snippet as Snippet<[DialogSnippetProps<unknown>]>,
			props,
		},
		resolvers,
	});
	return resolvers.promise;
}

function component<
	C extends Component<any, any, any>,
	AllProps = ComponentProps<C>,
	Props = Prettify<Omit<AllProps, keyof DialogBaseProps<any>>>,
	Res = AllProps extends DialogBaseProps<infer T> ? T : void,
	Args = {} extends Props ? [] : [Props],
// @ts-expect-error Args is an array dw
>(component: C, ...args: NoInfer<Args>): Promise<Res | void> {
	const resolvers = withResolvers<Res | void>();
	dialogState.add({
		id: id++,
		kind: "component",
		component,
		props: (args as any)?.[0],
		resolvers,
	});
	return resolvers.promise;
}

async function confirm(options: ConfirmDialogOptions): Promise<boolean> {
	const res = await component(ConfirmDialog, options);
	return res ?? false;
}

export const dialog = {
	Provider: DialogProvider,
	snippet,
	component,
	confirm,
};

function withResolvers<T>() {
	if (Promise.withResolvers) return Promise.withResolvers<T>();
	let resolve: (value: T | PromiseLike<T>) => void;
	let reject: (reason?: any) => void;
	let promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve: resolve!, reject: reject! };
}

export default dialog;
