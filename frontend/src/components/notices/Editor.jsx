import { Bold, Italic, Underline, List, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import styles from './notices.module.css';

export default function Editor({ value, onChange, placeholder, onUploadImage, uploading }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value && editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
    if (!value && editor.textContent) {
      // keep existing text on manual typing
      return;
    }
  }, [value]);

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || '';
    onChange(html);
  };

  const apply = (command) => {
    document.execCommand(command, false, null);
    editorRef.current?.focus();
    handleInput();
  };

  const addLink = () => {
    const url = window.prompt('링크 URL을 입력하세요');
    if (url) {
      document.execCommand('createLink', false, url);
      editorRef.current?.focus();
      handleInput();
    }
  };

  const insertImage = (url) => {
    if (!url) return;
    const editor = editorRef.current;
    if (!editor) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'image';
    img.style.maxWidth = '100%';
    const range = window.getSelection().getRangeAt(0);
    range.insertNode(img);
    range.collapse(false);
    editorRef.current?.focus();
    handleInput();
  };

  const handleImageClick = () => {
    if (!onUploadImage) return;
    fileInputRef.current?.click();
  };

  const handleImageSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await onUploadImage(file);
      insertImage(res.url);
    } catch (err) {
      // optionally surface error via onChange or toast in parent
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className={styles.editorShell}>
      <div className={styles.editorToolbar}>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('bold')}>
          <Bold size={14} />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('italic')}>
          <Italic size={14} />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('underline')}>
          <Underline size={14} />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => apply('insertUnorderedList')}>
          <List size={14} />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          <LinkIcon size={14} />
        </button>
        {onUploadImage && (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleImageClick} disabled={uploading}>
            <ImageIcon size={14} />
          </button>
        )}
        {uploading && <span className={styles.editorUploading}>이미지 업로드 중...</span>}
      </div>
      <div
        ref={editorRef}
        className={styles.editorArea}
        contentEditable
        tabIndex={0}
        suppressContentEditableWarning
        onInput={handleInput}
        onClick={() => editorRef.current?.focus()}
        data-placeholder={placeholder}
      />
      {onUploadImage && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageSelected}
        />
      )}
    </div>
  );
}
