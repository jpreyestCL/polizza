"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Pilcrow,
  TableIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
};

export function RichTextEditor({
  value,
  onChange,
  className,
  minHeightClass = "min-h-[160px]",
}: Props) {
  const [showSource, setShowSource] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none p-3",
          minHeightClass,
        ),
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border bg-background",
          minHeightClass,
          className,
        )}
      />
    );
  }

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs);

  function addLink() {
    const url = window.prompt("URL del enlace");
    if (!url) return;
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function addImage() {
    const url = window.prompt("URL de la imagen");
    if (!url) return;
    editor!.chain().focus().setImage({ src: url }).run();
  }

  function insertTable() {
    editor!
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }

  const btn = (active: boolean) =>
    cn(
      "h-8 w-8 p-0",
      active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
    );

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b px-1 py-1">
        <ToolbarButton
          aria-label="Negrita"
          className={btn(isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Cursiva"
          className={btn(isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Subrayado"
          className={btn(isActive("underline"))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="size-4" />
        </ToolbarButton>
        <ColorPicker editor={editor} />
        <ToolbarButton
          aria-label="Enlace"
          className={btn(isActive("link"))}
          onClick={addLink}
        >
          <LinkIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Imagen"
          className={btn(false)}
          onClick={addImage}
        >
          <ImagePlus className="size-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          aria-label="Párrafo"
          className={btn(isActive("paragraph"))}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Título 1"
          className={btn(isActive("heading", { level: 1 }))}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Título 2"
          className={btn(isActive("heading", { level: 2 }))}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Título 3"
          className={btn(isActive("heading", { level: 3 }))}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="size-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          aria-label="Alinear izquierda"
          className={btn(isActive({ textAlign: "left" } as never))}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Centrar"
          className={btn(isActive({ textAlign: "center" } as never))}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Alinear derecha"
          className={btn(isActive({ textAlign: "right" } as never))}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Justificar"
          className={btn(isActive({ textAlign: "justify" } as never))}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="size-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          aria-label="Lista"
          className={btn(isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Lista numerada"
          className={btn(isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Aumentar nivel"
          className={btn(false)}
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
        >
          <IndentIncrease className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Disminuir nivel"
          className={btn(false)}
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
        >
          <IndentDecrease className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          aria-label="Insertar tabla"
          className={btn(false)}
          onClick={insertTable}
        >
          <TableIcon className="size-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          aria-label="Ver código HTML"
          className={btn(showSource)}
          onClick={() => setShowSource((v) => !v)}
        >
          <Code2 className="size-4" />
        </ToolbarButton>
      </div>
      {showSource ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("rounded-none border-0 font-mono text-xs", minHeightClass)}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="ghost" size="sm" className={className} {...props}>
      {children}
    </Button>
  );
}

/**
 * Selector de color de texto. Paleta corta y sobria: en una propuesta el color
 * sirve para destacar una condición o una exclusión, no para decorar.
 */
const TEXT_COLORS: { label: string; value: string | null }[] = [
  { label: "Automático", value: null },
  { label: "Rojo", value: "#b42318" },
  { label: "Ámbar", value: "#b54708" },
  { label: "Verde", value: "#067647" },
  { label: "Azul", value: "#175cd3" },
  { label: "Morado", value: "#6941c6" },
  { label: "Gris", value: "#667085" },
];

function ColorPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current = (editor.getAttributes("textStyle").color as string) ?? null;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Color del texto"
        className="h-8 w-8 p-0 text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <Palette className="size-4" style={current ? { color: current } : undefined} />
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-9 z-50 w-40 rounded-md border bg-popover p-1 shadow-md">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.label}
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                onClick={() => {
                  if (c.value) editor.chain().focus().setColor(c.value).run();
                  else editor.chain().focus().unsetColor().run();
                  setOpen(false);
                }}
              >
                <span
                  className="size-3.5 shrink-0 rounded-full border"
                  style={{ backgroundColor: c.value ?? "transparent" }}
                />
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
