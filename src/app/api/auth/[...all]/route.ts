import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/src/lib/auth";

export const { POST, GET } = toNextJsHandler(auth);
