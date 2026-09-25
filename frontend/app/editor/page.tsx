import type { Metadata } from "next";
import { EditorApp } from "@/components/editor/EditorApp";

export const metadata: Metadata = {
  title: "Editor · Family Tree Builder",
};

export default function EditorPage() {
  return <EditorApp />;
}
