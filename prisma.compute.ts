import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "participate",
    framework: "nextjs",
    env: ".env",
  },
});
