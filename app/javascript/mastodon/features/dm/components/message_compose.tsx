import type React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { sendMessage } from 'mastodon/actions/dm';
import api from 'mastodon/api';
import { Picker } from 'mastodon/features/emoji/emoji_picker';
import { useAppDispatch } from 'mastodon/store';

const messages = defineMessages({
  emoji: { id: 'dm.compose.emoji', defaultMessage: 'Emoji' },
  attachImage: {
    id: 'dm.compose.attach_image',
    defaultMessage: 'Attach image',
  },
  placeholder: {
    id: 'dm.compose.placeholder',
    defaultMessage: 'Type a message...',
  },
  send: { id: 'dm.compose.send', defaultMessage: 'Send' },
  uploading: { id: 'dm.compose.uploading', defaultMessage: 'Uploading...' },
  removeImage: {
    id: 'dm.compose.remove_image',
    defaultMessage: 'Remove image',
  },
  maxImages: {
    id: 'dm.compose.max_images',
    defaultMessage: 'Maximum 4 images',
  },
  fileTooLarge: {
    id: 'dm.compose.file_too_large',
    defaultMessage: 'Image is too large. Maximum size is 10MB.',
  },
  uploadFailed: {
    id: 'dm.compose.upload_failed',
    defaultMessage: 'Upload failed. Please try again.',
  },
});

interface MediaAttachment {
  id: string;
  preview_url: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface MessageComposeProps {
  roomId: string;
}

export const MessageCompose: React.FC<MessageComposeProps> = ({ roomId }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>(
    [],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    const blobUrls = blobUrlsRef.current;
    const errorTimer = errorTimerRef.current;
    return () => {
      blobUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      blobUrls.clear();
      if (errorTimer) {
        clearTimeout(errorTimer);
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      const textarea = e.target;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && mediaAttachments.length === 0) return;

    const params: {
      content: string;
      media_ids?: string[];
    } = { content: trimmed };
    if (mediaAttachments.length > 0) {
      params.media_ids = mediaAttachments.map((m) => m.id);
    }

    dispatch(sendMessage(roomId, params));
    setText('');
    setMediaAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [dispatch, roomId, text, mediaAttachments]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Safari may end composition before keydown; 229 still identifies the IME Enter.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const isComposing = e.nativeEvent.isComposing || e.keyCode === 229;
      if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleToggleEmojiPicker = useCallback(() => {
    setShowEmojiPicker((prev) => !prev);
  }, []);

  const handleEmojiPick = useCallback(
    (emoji: { native?: string; id?: string }) => {
      const emojiText = emoji.native ?? `:${emoji.id}:`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = text.slice(0, start) + emojiText + text.slice(end);
        setText(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd =
            start + emojiText.length;
          textarea.focus();
        }, 0);
      } else {
        setText(text + emojiText);
      }
      setShowEmojiPicker(false);
    },
    [text],
  );

  // Close emoji picker on click outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const showUploadError = useCallback((message: string) => {
    setUploadError(message);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = setTimeout(() => {
      setUploadError(null);
      errorTimerRef.current = null;
    }, 3000);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remainingSlots = 4 - mediaAttachments.length;
      if (remainingSlots <= 0) return;

      const filesToUpload = Array.from(files).slice(0, remainingSlots);

      // Client-side file size validation
      const validFiles: File[] = [];
      for (const file of filesToUpload) {
        if (file.size > MAX_FILE_SIZE) {
          showUploadError(intl.formatMessage(messages.fileTooLarge));
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setUploading(true);

      const pollForMedia = async (
        mediaId: string,
      ): Promise<{ id: string; preview_url?: string } | null> => {
        let delay = 1000;
        const maxRetries = 5;
        for (let i = 0; i < maxRetries; i++) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          try {
            const response = await api().get<{
              id: string;
              preview_url?: string;
            }>(`/api/v1/media/${mediaId}`);
            if (response.status === 200) {
              return response.data;
            }
          } catch {
            // Continue polling
          }
          delay *= 2;
        }
        return null;
      };

      const uploadPromises = validFiles.map(async (file) => {
        const data = new FormData();
        data.append('file', file);
        try {
          const response = await api().post<{
            id: string;
            preview_url?: string;
          }>('/api/v2/media', data);
          const { status, data: responseData } = response;

          if (status === 202) {
            // Poll for completion
            const polledData = await pollForMedia(responseData.id);
            if (polledData) {
              const previewUrl =
                polledData.preview_url ?? URL.createObjectURL(file);
              if (previewUrl.startsWith('blob:')) {
                blobUrlsRef.current.add(previewUrl);
              }
              return { id: polledData.id, preview_url: previewUrl };
            }
            // Polling exhausted, use what we have
            const previewUrl =
              responseData.preview_url ?? URL.createObjectURL(file);
            if (previewUrl.startsWith('blob:')) {
              blobUrlsRef.current.add(previewUrl);
            }
            return { id: responseData.id, preview_url: previewUrl };
          }

          if (status === 200) {
            const previewUrl =
              responseData.preview_url ?? URL.createObjectURL(file);
            if (previewUrl.startsWith('blob:')) {
              blobUrlsRef.current.add(previewUrl);
            }
            return { id: responseData.id, preview_url: previewUrl };
          }

          return null;
        } catch {
          showUploadError(intl.formatMessage(messages.uploadFailed));
          return null;
        }
      });

      void Promise.all(uploadPromises).then((results) => {
        const successful = results.filter(
          (r): r is MediaAttachment => r !== null,
        );
        if (successful.length > 0) {
          setUploadError(null);
        }
        setMediaAttachments((prev) => [...prev, ...successful]);
        setUploading(false);
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [mediaAttachments.length, intl, showUploadError],
  );

  const handleRemoveMedia = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const mediaId = e.currentTarget.dataset.mediaId;
      if (!mediaId) return;
      setMediaAttachments((prev) => {
        const removed = prev.find((m) => m.id === mediaId);
        if (removed?.preview_url.startsWith('blob:')) {
          URL.revokeObjectURL(removed.preview_url);
          blobUrlsRef.current.delete(removed.preview_url);
        }
        return prev.filter((m) => m.id !== mediaId);
      });
    },
    [],
  );

  const handleDismissError = useCallback(() => {
    setUploadError(null);
  }, []);

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className='dm-message-compose'>
      {uploadError && (
        <div className='dm-message-compose__upload-error'>
          <span>{uploadError}</span>
          <button
            type='button'
            onClick={handleDismissError}
            aria-label='Dismiss'
          >
            &times;
          </button>
        </div>
      )}
      {mediaAttachments.length > 0 && (
        <div className='dm-message-compose__media-preview'>
          {mediaAttachments.map((media) => (
            <div key={media.id} className='dm-message-compose__media-item'>
              <img src={media.preview_url} alt='' />
              <button
                className='dm-message-compose__media-remove'
                type='button'
                onClick={handleRemoveMedia}
                data-media-id={media.id}
                title={intl.formatMessage(messages.removeImage)}
              >
                <svg
                  width='14'
                  height='14'
                  viewBox='0 0 24 24'
                  fill='currentColor'
                >
                  <path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {uploading && (
        <div className='dm-message-compose__upload-progress'>
          <span>{intl.formatMessage(messages.uploading)}</span>
        </div>
      )}
      <div className='dm-message-compose__input-row'>
        <div className='dm-message-compose__field'>
          <div className='dm-message-compose__actions-left'>
            <button
              ref={emojiButtonRef}
              className='dm-message-compose__btn'
              type='button'
              title={intl.formatMessage(messages.emoji)}
              onClick={handleToggleEmojiPicker}
            >
              <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <circle cx='12' cy='12' r='10' />
                <path d='M8 14s1.5 2 4 2 4-2 4-2' />
                <line x1='9' y1='9' x2='9.01' y2='9' />
                <line x1='15' y1='9' x2='15.01' y2='9' />
              </svg>
            </button>
            <button
              className='dm-message-compose__btn'
              type='button'
              title={intl.formatMessage(messages.attachImage)}
              onClick={handleAttachClick}
              disabled={mediaAttachments.length >= 4 || uploading}
            >
              <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48' />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>
          <textarea
            ref={textareaRef}
            className='dm-message-compose__input'
            placeholder={intl.formatMessage(messages.placeholder)}
            aria-label={intl.formatMessage(messages.placeholder)}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        </div>
        <button
          className={`dm-message-compose__send ${text.trim() || mediaAttachments.length > 0 ? 'dm-message-compose__send--active' : ''}`}
          type='button'
          onClick={handleSubmit}
          disabled={!text.trim() && mediaAttachments.length === 0}
          title={intl.formatMessage(messages.send)}
        >
          <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
            <path d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' />
          </svg>
        </button>
      </div>
      {showEmojiPicker && (
        <div className='dm-message-compose__emoji-picker' ref={emojiPickerRef}>
          <Picker
            perLine={8}
            emojiSize={22}
            showPreview={false}
            showSkinTones={false}
            onClick={handleEmojiPick}
            emojiTooltip
          />
        </div>
      )}
    </div>
  );
};
