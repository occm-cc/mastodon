import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEventHandler, FC } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import type { Area } from 'react-easy-crop';
import Cropper from 'react-easy-crop';

import { setDragUploadEnabled } from '@/mastodon/actions/compose_typed';
import { Button } from '@/mastodon/components/button';
import { RangeInputField } from '@/mastodon/components/form_fields/range_input_field';
import {
  selectImageInfo,
  uploadImage,
} from '@/mastodon/reducers/slices/profile_edit';
import type { ImageLocation } from '@/mastodon/reducers/slices/profile_edit';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';

import { DialogModal } from '../../ui/components/dialog_modal';
import type { DialogModalProps } from '../../ui/components/dialog_modal';

import { ImageAltTextField } from './image_alt';
import classes from './styles.module.scss';

import 'react-easy-crop/react-easy-crop.css';

const messages = defineMessages({
  avatarAdd: {
    id: 'account_edit.upload_modal.title_add.avatar',
    defaultMessage: 'Add profile photo',
  },
  headerAdd: {
    id: 'account_edit.upload_modal.title_add.header',
    defaultMessage: 'Add cover photo',
  },
  custom_logoAdd: {
    id: 'account_edit.upload_modal.title_add.custom_logo',
    defaultMessage: 'Add custom logo',
  },
  background_imageAdd: {
    id: 'account_edit.upload_modal.title_add.background_image',
    defaultMessage: 'Add background image',
  },
  avatarReplace: {
    id: 'account_edit.upload_modal.title_replace.avatar',
    defaultMessage: 'Replace profile photo',
  },
  headerReplace: {
    id: 'account_edit.upload_modal.title_replace.header',
    defaultMessage: 'Replace cover photo',
  },
  custom_logoReplace: {
    id: 'account_edit.upload_modal.title_replace.custom_logo',
    defaultMessage: 'Replace custom logo',
  },
  background_imageReplace: {
    id: 'account_edit.upload_modal.title_replace.background_image',
    defaultMessage: 'Replace background image',
  },
  zoomLabel: {
    id: 'account_edit.upload_modal.step_crop.zoom',
    defaultMessage: 'Zoom',
  },
});

export const ImageUploadModal: FC<
  DialogModalProps & { location: ImageLocation }
> = ({ onClose, location }) => {
  const { src: oldSrc } = useAppSelector((state) =>
    selectImageInfo(state, location),
  );
  const intl = useIntl();
  const title = intl.formatMessage(
    oldSrc ? messages[`${location}Replace`] : messages[`${location}Add`],
  );

  // State for individual steps.
  const [step, setStep] = useState<'select' | 'crop' | 'alt' | 'save'>(
    'select',
  );
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      try {
        // If the image is animated, skip cropping and go straight to alt text
        // (or directly to save for locations without alt text).
        if (file.type === 'image/gif') {
          setImageBlob(file);
          if (location === 'background_image') {
            setStep('save');
          } else {
            setStep('alt');
          }
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const dataUri = reader.result;
          if (typeof dataUri !== 'string') {
            throw new Error('Expected a string');
          }
          setImageSrc(dataUri);
          setStep('crop');
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.warn('Error with image parsing:', error);
        setStep('select');
      }
    },
    [location],
  );

  const handleCrop = useCallback(
    (crop: Area) => {
      if (!imageSrc) {
        setStep('select');
        return;
      }
      void calculateCroppedImage(imageSrc, crop, location).then((blob) => {
        setImageBlob(blob);
        if (location === 'background_image') {
          setStep('save');
        } else {
          setStep('alt');
        }
      });
    },
    [imageSrc, location],
  );

  const dispatch = useAppDispatch();
  const handleSave = useCallback(
    (altText: string) => {
      if (!imageBlob) {
        setStep('crop');
        return;
      }
      void dispatch(uploadImage({ location, imageBlob, altText })).then(
        onClose,
      );
    },
    [dispatch, imageBlob, location, onClose],
  );

  // When a location has no alt text (e.g. background_image), skip the alt step
  // and save immediately with empty alt text.
  useEffect(() => {
    if (step === 'save' && imageBlob) {
      void dispatch(uploadImage({ location, imageBlob, altText: '' })).then(
        onClose,
      );
    }
  }, [step, imageBlob, dispatch, location, onClose]);

  const handleCancel = useCallback(() => {
    if (step === 'crop') {
      setImageSrc(null);
      setStep('select');
    } else if (step === 'alt') {
      setImageBlob(null);
      if (imageSrc) {
        setStep('crop');
      } else {
        setStep('select');
      }
    } else {
      onClose();
    }
  }, [imageSrc, onClose, step]);

  return (
    <DialogModal
      title={title}
      onClose={onClose}
      wrapperClassName={classes.uploadWrapper}
      noCancelButton
    >
      {step === 'select' && (
        <StepUpload location={location} onFile={handleFile} />
      )}
      {step === 'crop' && imageSrc && (
        <StepCrop
          src={imageSrc}
          location={location}
          onCancel={handleCancel}
          onComplete={handleCrop}
        />
      )}
      {step === 'alt' && imageBlob && (
        <StepAlt
          location={location}
          imageBlob={imageBlob}
          onCancel={handleCancel}
          onComplete={handleSave}
        />
      )}
    </DialogModal>
  );
};

// Taken from app/models/concerns/account/header.rb and app/models/concerns/account/avatar.rb
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const UPLOAD_SIZE_HINT: Record<
  ImageLocation,
  { width: number; height: number }
> = {
  avatar: { width: 400, height: 400 },
  header: { width: 1500, height: 500 },
  custom_logo: { width: 1044, height: 696 },
  background_image: { width: 3840, height: 2160 },
};

const StepUpload: FC<{
  location: ImageLocation;
  onFile: (file: File) => void;
}> = ({ location, onFile }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleUploadClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file || !ALLOWED_MIME_TYPES.includes(file.type)) {
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  // Handle drag and drop
  const [isDragging, setDragging] = useState(false);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    if (!event.dataTransfer?.types.includes('Files')) {
      return;
    }

    const items = Array.from(event.dataTransfer.items);
    if (
      !items.some(
        (item) =>
          item.kind === 'file' && ALLOWED_MIME_TYPES.includes(item.type),
      )
    ) {
      return;
    }

    setDragging(true);
  }, []);
  const handleDragDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);

      if (!event.dataTransfer?.files) {
        return;
      }

      const file = Array.from(event.dataTransfer.files).find((f) =>
        ALLOWED_MIME_TYPES.includes(f.type),
      );
      if (!file) {
        return;
      }

      onFile(file);
    },
    [onFile],
  );
  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
  }, []);

  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setDragUploadEnabled(false));
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDragDrop);
    document.addEventListener('dragleave', handleDragLeave);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDragDrop);
      document.removeEventListener('dragleave', handleDragLeave);
      dispatch(setDragUploadEnabled(true));
    };
  }, [handleDragLeave, handleDragDrop, handleDragOver, dispatch]);

  if (isDragging) {
    return (
      <div className={classes.uploadStepSelect}>
        <FormattedMessage
          id='account_edit.upload_modal.step_upload.dragging'
          defaultMessage='Drop to upload'
          tagName='h2'
        />
      </div>
    );
  }

  return (
    <div className={classes.uploadStepSelect}>
      <FormattedMessage
        id='account_edit.upload_modal.step_upload.header'
        defaultMessage='Choose an image'
        tagName='h2'
      />
      <FormattedMessage
        id='account_edit.upload_modal.step_upload.hint'
        defaultMessage='WEBP, PNG, GIF or JPG format, up to {limit}MB.{br}Image will be scaled to {width}x{height}px.'
        description='Guideline for avatar and header images.'
        values={{
          br: <br />,
          limit: 8,
          width: UPLOAD_SIZE_HINT[location].width,
          height: UPLOAD_SIZE_HINT[location].height,
        }}
        tagName='p'
      />
      <Button onClick={handleUploadClick} autoFocus>
        <FormattedMessage
          id='account_edit.upload_modal.step_upload.button'
          defaultMessage='Browse files'
        />
      </Button>

      <input
        hidden
        type='file'
        ref={inputRef}
        accept={ALLOWED_MIME_TYPES.join(',')}
        onChange={handleFileChange}
      />
    </div>
  );
};

const CROP_ASPECT: Record<ImageLocation, number> = {
  avatar: 1,
  header: 3 / 1,
  custom_logo: 3 / 2,
  background_image: 16 / 9,
};

const StepCrop: FC<{
  src: string;
  location: ImageLocation;
  onCancel: () => void;
  onComplete: (crop: Area) => void;
}> = ({ src, location, onCancel, onComplete }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [zoom, setZoom] = useState(1);
  const intl = useIntl();

  const handleZoomChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      setZoom(event.currentTarget.valueAsNumber);
    },
    [],
  );
  const handleCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleNext = useCallback(() => {
    if (croppedArea) {
      onComplete(croppedArea);
    }
  }, [croppedArea, onComplete]);

  return (
    <>
      <div className={classes.cropContainer}>
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          onCropChange={setCrop}
          onCropComplete={handleCropComplete}
          aspect={CROP_ASPECT[location]}
          disableAutomaticStylesInjection
        />
      </div>

      <div className={classes.cropActions}>
        <RangeInputField
          label={intl.formatMessage(messages.zoomLabel)}
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={handleZoomChange}
          wrapperClassName={classes.zoomControl}
          inputPlacement='inline-end'
        />
        <Button onClick={onCancel} secondary>
          <FormattedMessage
            id='account_edit.upload_modal.back'
            defaultMessage='Back'
          />
        </Button>
        <Button onClick={handleNext} disabled={!croppedArea}>
          <FormattedMessage
            id='account_edit.upload_modal.next'
            defaultMessage='Next'
          />
        </Button>
      </div>
    </>
  );
};

const StepAlt: FC<{
  imageBlob: Blob;
  onCancel: () => void;
  onComplete: (altText: string) => void;
  location: ImageLocation;
}> = ({ imageBlob, onCancel, onComplete, location }) => {
  const [altText, setAltText] = useState('');

  const handleComplete = useCallback(() => {
    onComplete(altText);
  }, [altText, onComplete]);

  const imageSrc = useMemo(() => URL.createObjectURL(imageBlob), [imageBlob]);

  return (
    <>
      <ImageAltTextField
        imageSrc={imageSrc}
        altText={altText}
        onChange={setAltText}
        hideTip={location === 'header' || location === 'background_image'}
      />

      <div className={classes.cropActions}>
        <Button onClick={onCancel} secondary>
          <FormattedMessage
            id='account_edit.upload_modal.back'
            defaultMessage='Back'
          />
        </Button>

        <Button onClick={handleComplete}>
          <FormattedMessage
            id='account_edit.upload_modal.done'
            defaultMessage='Done'
          />
        </Button>
      </div>
    </>
  );
};

async function calculateCroppedImage(
  imageSrc: string,
  crop: Area,
  location: ImageLocation,
): Promise<Blob> {
  const image = await dataUriToImage(imageSrc);
  const maxWidth = location === 'avatar' ? 400 : 1500;
  const scale = Math.min(1, maxWidth / crop.width);
  const width = Math.round(crop.width * scale);
  const height = Math.round(crop.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.imageSmoothingQuality = 'high';

  // Draw the image
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  );

  return canvas.convertToBlob();
}

function dataUriToImage(dataUri: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', (event) => {
      if (event.error instanceof Error) {
        reject(event.error);
      } else {
        reject(new Error('Failed to load image'));
      }
    });
    image.src = dataUri;
  });
}
