import type { Dialog } from "./index.ts";

class DialogState {
	dialogs: Dialog[] = $state([]);

	add(dialog: Dialog) {
		if (typeof document === "undefined") return;
		this.dialogs.push(dialog);
	}

	remove(id: number) {
		this.dialogs = this.dialogs.filter((d) => d.id !== id);
	}
}

export const dialogState = new DialogState();
