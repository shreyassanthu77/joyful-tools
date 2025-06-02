import { table, defaults } from "./shared";
export const users = table("users", ()=>({
        ...defaults
    }));
