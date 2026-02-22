import { Bold, Italic, Underline, List, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { sanitizeRichHtml } from '../../security/htmlSanitizer';
import { toSafeAssetUrl, toSafeExternalHref } from '../../security/urlPolicy';
import styles from './notices.module.css';

const MAX_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024;

export default function Editor({ value, onChange, placeholder, onUploadImage, uploading }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const savedRangeRef = useRef(null);

  const isRangeInsideEditor = (range) => {
    const editor = editorRef.current;
    if (!editor || !range) return false;
    const container = range.commonAncestorContainer;
    return container === editor || editor.contains(container);
  };

  const getCurrentEditorRange = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    return isRangeInsideEditor(range) ? range : null;
  };

  const createEditorEndRange = () => {
    const editor = editorRef.current;
    if (!editor) return null;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    return range;
  };

  const rememberEditorSelection = () => {
    const range = getCurrentEditorRange();
    if (!range) return;
    savedRangeRef.current = range.cloneRange();
  };

  const focusEditorWithSelection = () => {
    const editor = editorRef.current;
    if (!editor) return null;

    let range = getCurrentEditorRange();
    if (!range && savedRangeRef.current && isRangeInsideEditor(savedRangeRef.current)) {
      range = savedRangeRef.current.cloneRange();
    }
    if (!range) {
      range = createEditorEndRange();
    }
    if (!range) return null;

    editor.focus();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    savedRangeRef.current = range.cloneRange();
    return range;
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const safeValue = sanitizeRichHtml(value || '');
    if (editor.innerHTML !== safeValue) {
      editor.innerHTML = safeValue;
    }
  }, [value]);

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || '';
    const safeHtml = sanitizeRichHtml(html);
    if (editorRef.current && editorRef.current.innerHTML !== safeHtml) {
      editorRef.current.innerHTML = safeHtml;
    }
    onChange(safeHtml);
  };

  const apply = (command) => {
    focusEditorWithSelection();
    document.execCommand(command, false, null);
    rememberEditorSelection();
    handleInput();
  };

  const addLink = () => {
    const url = window.prompt('링크 URL을 입력하세요');
    if (!url) return;

    const safeUrl = toSafeExternalHref(url);
    if (!safeUrl) {
      window.alert('안전한 링크(http, https, mailto, tel)만 사용할 수 있습니다.');
      return;
    }

    focusEditorWithSelection();
    document.execCommand('createLink', false, safeUrl);
    rememberEditorSelection();
    handleInput();
  };

  const insertImage = (url) => {
    const safeUrl = toSafeAssetUrl(url);
    if (!safeUrl) return;
    const editor = editorRef.current;
    if (!editor) return;

    const img = document.createElement('img');
    img.src = safeUrl;
    img.alt = 'image';
    img.style.maxWidth = '100%';

    const range = focusEditorWithSelection() || createEditorEndRange();
    if (!range) return;
    range.insertNode(img);
    range.setStartAfter(img);
    range.collapse(true);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    savedRangeRef.current = range.cloneRange();
    handleInput();
  };

  const handleImageClick = () => {
    if (!onUploadImage) return;
    if (!getCurrentEditorRange()) {
      savedRangeRef.current = createEditorEndRange();
    } else {
      rememberEditorSelection();
    }
    fileInputRef.current?.click();
  };

  const handleImageSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      window.alert('이미지 파일만 업로드할 수 있습니다.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      window.alert('이미지는 10MB 이하만 업로드할 수 있습니다.');
      e.target.value = '';
      return;
    }

    try {
      const res = await onUploadImage(file);
      insertImage(res.url);
    } catch (err) {
      if (err?.message) window.alert(err.message);
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
        onClick={() => {
          editorRef.current?.focus();
          rememberEditorSelection();
        }}
        onKeyUp={rememberEditorSelection}
        onMouseUp={rememberEditorSelection}
        onFocus={rememberEditorSelection}
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
