"use client";

import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  CodeIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  CheckListIcon,
  QuoteDownIcon,
  CodeSquareIcon,
  MinusSignIcon,
  Link01Icon,
  Image01Icon,
} from "@hugeicons/core-free-icons";

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

interface RichEditorToolbarProps {
  editor: Editor;
  variant: "fixed" | "bubble";
  onLinkInsert: () => void;
  onImageClick: () => void;
}

export function RichEditorToolbar({
  editor,
  variant,
  onLinkInsert,
  onImageClick,
}: RichEditorToolbarProps) {
  const iconSize = 16;

  const wrapperClass =
    variant === "bubble"
      ? "flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
      : "flex flex-wrap items-center gap-0.5";

  return (
    <div className={wrapperClass}>
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Negrita (Ctrl+B)"
      >
        <HugeiconsIcon icon={TextBoldIcon} size={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Cursiva (Ctrl+I)"
      >
        <HugeiconsIcon icon={TextItalicIcon} size={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Subrayado (Ctrl+U)"
      >
        <HugeiconsIcon icon={TextUnderlineIcon} size={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Tachado"
      >
        <HugeiconsIcon icon={TextStrikethroughIcon} size={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="Codigo inline"
      >
        <HugeiconsIcon icon={CodeIcon} size={iconSize} />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Headings (only in fixed toolbar) */}
      {variant === "fixed" && (
        <>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            active={editor.isActive("heading", { level: 1 })}
            title="Titulo 1"
          >
            <HugeiconsIcon icon={Heading01Icon} size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            title="Titulo 2"
          >
            <HugeiconsIcon icon={Heading02Icon} size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
            title="Titulo 3"
          >
            <HugeiconsIcon icon={Heading03Icon} size={iconSize} />
          </ToolbarButton>
          <ToolbarSeparator />
        </>
      )}

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Lista con vinetas"
      >
        <HugeiconsIcon icon={LeftToRightListBulletIcon} size={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Lista numerada"
      >
        <HugeiconsIcon icon={LeftToRightListNumberIcon} size={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive("taskList")}
        title="Lista de tareas"
      >
        <HugeiconsIcon icon={CheckListIcon} size={iconSize} />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Cita"
      >
        <HugeiconsIcon icon={QuoteDownIcon} size={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Bloque de codigo"
      >
        <HugeiconsIcon icon={CodeSquareIcon} size={iconSize} />
      </ToolbarButton>

      {variant === "fixed" && (
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Linea horizontal"
        >
          <HugeiconsIcon icon={MinusSignIcon} size={iconSize} />
        </ToolbarButton>
      )}

      <ToolbarSeparator />

      {/* Link & Media */}
      <ToolbarButton
        onClick={onLinkInsert}
        active={editor.isActive("link")}
        title="Insertar enlace"
      >
        <HugeiconsIcon icon={Link01Icon} size={iconSize} />
      </ToolbarButton>

      {variant === "fixed" && (
        <ToolbarButton onClick={onImageClick} title="Insertar imagen">
          <HugeiconsIcon icon={Image01Icon} size={iconSize} />
        </ToolbarButton>
      )}
    </div>
  );
}
