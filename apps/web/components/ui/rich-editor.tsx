"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExt from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import UnderlineExt from "@tiptap/extension-underline";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { cn } from "@/lib/utils";
import { RichEditorToolbar } from "./rich-editor-toolbar";

const lowlight = createLowlight(common);

export interface RichEditorProps {
  content: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
  className?: string;
  minHeight?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function RichEditor({
  content,
  onChange,
  placeholder = "Escribe algo...",
  editable = true,
  onImageUpload,
  className,
  minHeight = "120px",
  onFocus,
  onBlur,
}: RichEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder }),
      ImageExt.configure({
        HTMLAttributes: {
          class: "rich-editor-image",
        },
      }),
      Link.configure({
        openOnClick: !editable,
        HTMLAttributes: {
          class: "rich-editor-link",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "rich-editor-task-list",
        },
      }),
      TaskItem.configure({
        nested: true,
      }),
      UnderlineExt,
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "rich-editor-content prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          !editable && "cursor-default",
        ),
        style: editable ? `min-height: ${minHeight}` : "",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length && onImageUpload) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            handleImageUpload(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (items && onImageUpload) {
          for (const item of items) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) handleImageUpload(file);
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML());
    },
    onFocus: () => onFocus?.(),
    onBlur: () => onBlur?.(),
    immediatelyRender: false,
  });

  // Sync content from outside when editor exists
  const lastExternalContent = useRef(content);
  useEffect(() => {
    if (!editor) return;
    if (content !== lastExternalContent.current) {
      lastExternalContent.current = content;
      const currentHTML = editor.getHTML();
      if (currentHTML !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [content, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor || !onImageUpload) return;
      setIsUploading(true);
      try {
        const url = await onImageUpload(file);
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch {
        // Upload failed; let the parent handle the error
      } finally {
        setIsUploading(false);
      }
    },
    [editor, onImageUpload],
  );

  const handleImageButtonClick = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImageUpload(file);
      e.target.value = "";
    },
    [handleImageUpload],
  );

  const handleLinkInsert = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href ?? "";
    const url = window.prompt("URL del enlace:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border border-input bg-transparent px-3 py-2",
          className,
        )}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rich-editor-wrapper group relative rounded-md border border-input bg-transparent transition-colors",
        editable && "focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30",
        isUploading && "pointer-events-none opacity-70",
        className,
      )}
    >
      {/* Bubble menu (appears on text selection) */}
      {editable && (
        <BubbleMenu
          editor={editor}
          options={{
            placement: "top",
          }}
          shouldShow={(props) => {
            const { empty } = props.state.selection;
            if (empty) return false;
            if (props.editor.isActive("image")) return false;
            return true;
          }}
        >
          <RichEditorToolbar
            editor={editor}
            variant="bubble"
            onLinkInsert={handleLinkInsert}
            onImageClick={handleImageButtonClick}
          />
        </BubbleMenu>
      )}

      {/* Fixed toolbar at top */}
      {editable && (
        <div className="border-b border-border px-1 py-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <RichEditorToolbar
            editor={editor}
            variant="fixed"
            onLinkInsert={handleLinkInsert}
            onImageClick={handleImageButtonClick}
          />
        </div>
      )}

      <EditorContent editor={editor} className="px-3 py-2" />

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60">
          <span className="text-xs text-muted-foreground">Subiendo imagen...</span>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
      />
    </div>
  );
}
