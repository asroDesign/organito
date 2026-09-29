"use client";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  ClassicEditor, Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Code, Link, List, ListProperties, TodoList,
  BlockQuote, Table, TableToolbar, TableProperties, TableCellProperties, TableCaption, Image, ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageUpload, ImageInsert,
  MediaEmbed, Alignment, Font, Highlight, HorizontalLine, Indent, IndentBlock, RemoveFormat, SourceEditing, FindAndReplace, SpecialCharacters, SpecialCharactersEssentials,
  PasteFromOffice, Autoformat, WordCount, CodeBlock, AutoLink,
  type Editor, type FileLoader, type UploadAdapter,
} from "ckeditor5";
import translations from "ckeditor5/translations/fa.js";
import "ckeditor5/ckeditor5.css";

class InternalUploadAdapter implements UploadAdapter {
  private ctrl = new AbortController();
  constructor(private loader: FileLoader) {}
  async upload() {
    const file = await this.loader.file;
    if (!file) throw new Error("فایلی انتخاب نشده");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "editor");
    const r = await fetch("/api/media", { method: "POST", body: fd, headers: { "x-csrf": "1" }, signal: this.ctrl.signal });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "خطای بارگذاری تصویر");
    return { default: j.url as string };
  }
  abort() { this.ctrl.abort(); }
}
function UploadPlugin(editor: Editor) {
  editor.plugins.get("FileRepository").createUploadAdapter = (loader: FileLoader) => new InternalUploadAdapter(loader);
}

export default function RichEditorInner({ value, onChange, placeholder, minHeight = 260 }: { value: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number }) {
  return (
    <div className="rich-editor" style={{ ["--re-min" as string]: `${minHeight}px` }}>
      <CKEditor
        editor={ClassicEditor}
        data={value}
        config={{
          licenseKey: "GPL",
          language: { ui: "fa", content: "fa" },
          translations: [translations],
          placeholder,
          plugins: [
            Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Code, Link, AutoLink, List, ListProperties, TodoList, BlockQuote,
            Table, TableToolbar, TableProperties, TableCellProperties, TableCaption, Image, ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageUpload, ImageInsert,
            MediaEmbed, Alignment, Font, Highlight, HorizontalLine, Indent, IndentBlock, RemoveFormat, SourceEditing, FindAndReplace, SpecialCharacters, SpecialCharactersEssentials,
            PasteFromOffice, Autoformat, WordCount, CodeBlock,
          ],
          extraPlugins: [UploadPlugin],
          toolbar: {
            items: ["undo", "redo", "|", "heading", "|", "fontSize", "fontColor", "fontBackgroundColor", "highlight", "|", "bold", "italic", "underline", "strikethrough", "subscript", "superscript", "code", "removeFormat", "|",
              "alignment", "bulletedList", "numberedList", "todoList", "outdent", "indent", "|", "link", "insertImage", "insertTable", "mediaEmbed", "blockQuote", "codeBlock", "horizontalLine", "specialCharacters", "|", "findAndReplace", "sourceEditing"],
            shouldNotGroupWhenFull: false,
          },
          heading: { options: [
            { model: "paragraph", title: "پاراگراف", class: "ck-heading_paragraph" },
            { model: "heading2", view: "h2", title: "تیتر ۱", class: "ck-heading_heading2" },
            { model: "heading3", view: "h3", title: "تیتر ۲", class: "ck-heading_heading3" },
            { model: "heading4", view: "h4", title: "تیتر ۳", class: "ck-heading_heading4" },
          ] },
          fontSize: { options: [12, 14, "default", 18, 22, 28] },
          image: { toolbar: ["imageTextAlternative", "toggleImageCaption", "|", "imageStyle:inline", "imageStyle:block", "imageStyle:side", "|", "resizeImage"], insert: { integrations: ["upload", "url"] } },
          table: { contentToolbar: ["tableColumn", "tableRow", "mergeTableCells", "tableProperties", "tableCellProperties", "toggleTableCaption"] },
          link: { addTargetToExternalLinks: true, defaultProtocol: "https://" },
          mediaEmbed: { previewsInData: true },
        }}
        onChange={(_e, editor) => onChange(editor.getData())}
      />
    </div>
  );
}
