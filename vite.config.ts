import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // base: "./", 
  // 開発環境では相対パスを使用、本番環境ではルートパスを使用
  base: "/support-planning/",
  plugins: [react],
});
