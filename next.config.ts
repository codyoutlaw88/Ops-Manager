import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["imapflow", "mailparser", "web-push"],
};
export default config;
